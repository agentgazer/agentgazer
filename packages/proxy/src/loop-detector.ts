/**
 * Loop Detector - Detects AI agent infinite loops using SimHash.
 *
 * Uses multi-signal scoring:
 * - Prompt similarity (SimHash Hamming distance)
 * - Response similarity (SimHash Hamming distance)
 * - Tool call repetition
 *
 * Includes TTL-based cleanup to prevent memory leaks for long-running servers.
 */

import {
  computeSimHash,
  isSimilar,
  extractAndNormalizePrompt,
  extractToolCalls,
  normalizePrompt,
} from "@agentgazer/shared";

export interface RequestFingerprint {
  promptHash: bigint;
  responseHash: bigint | null;
  toolCalls: string[];
  timestamp: number;
}

export interface LoopCheckResult {
  isLoop: boolean;
  score: number;
  details: {
    similarPrompts: number;
    similarResponses: number;
    repeatedToolCalls: number;
  };
}

export interface KillSwitchConfig {
  enabled: boolean;
  windowSize: number;
  threshold: number;
}

const DEFAULT_CONFIG: KillSwitchConfig = {
  enabled: false,
  windowSize: 20,
  threshold: 10.0,
};

// TTL settings
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

interface AgentState {
  window: CircularBuffer<RequestFingerprint>;
  config: KillSwitchConfig;
  lastActivity: number;
}

// Scoring weights
const WEIGHTS = {
  promptSimilarity: 1.0,
  responseSimilarity: 2.0,
  toolCallRepetition: 1.5,
};

// Hamming distance threshold for similarity (lower = stricter, must be nearly identical)
const SIMILARITY_THRESHOLD = 2;

/**
 * Circular buffer for sliding window storage
 */
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private size = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  getAll(): T[] {
    const result: T[] = [];
    const start = this.size < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.size; i++) {
      const idx = (start + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  getLatest(): T | undefined {
    if (this.size === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }

  resize(newCapacity: number): void {
    const items = this.getAll();
    this.capacity = newCapacity;
    this.buffer = new Array(newCapacity);
    this.head = 0;
    this.size = 0;
    // Re-add items (may lose some if shrinking)
    for (const item of items.slice(-newCapacity)) {
      this.push(item);
    }
  }

  getSize(): number {
    return this.size;
  }
}

/**
 * Loop Detector class - manages per-agent sliding windows
 * with TTL-based cleanup for long-running servers.
 */
export class LoopDetector {
  private agents = new Map<string, AgentState>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Start periodic cleanup timer
   */
  startCleanup(intervalMs: number = CLEANUP_INTERVAL_MS): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupInactiveAgents(), intervalMs);
    // Don't block process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove agents that haven't been active within TTL
   */
  cleanupInactiveAgents(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [agentId, state] of this.agents) {
      if (now - state.lastActivity > this.ttlMs) {
        this.agents.delete(agentId);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Get current agent count (for monitoring)
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Get or create agent state
   */
  private getOrCreateAgent(agentId: string): AgentState {
    let state = this.agents.get(agentId);
    if (!state) {
      state = {
        window: new CircularBuffer(DEFAULT_CONFIG.windowSize),
        config: { ...DEFAULT_CONFIG },
        lastActivity: Date.now(),
      };
      this.agents.set(agentId, state);
    }
    return state;
  }

  /**
   * Update lastActivity timestamp
   */
  private touch(agentId: string): void {
    const state = this.agents.get(agentId);
    if (state) {
      state.lastActivity = Date.now();
    }
  }

  /**
   * Set kill switch configuration for an agent
   */
  setConfig(agentId: string, config: Partial<KillSwitchConfig>): void {
    const state = this.getOrCreateAgent(agentId);
    state.config = { ...state.config, ...config };
    state.lastActivity = Date.now();

    // Resize window if needed
    if (config.windowSize && state.window.getSize() !== config.windowSize) {
      state.window.resize(config.windowSize);
    }
  }

  /**
   * Get kill switch configuration for an agent
   */
  getConfig(agentId: string): KillSwitchConfig {
    const state = this.agents.get(agentId);
    return state?.config ?? { ...DEFAULT_CONFIG };
  }

  /**
   * Get window for an agent
   */
  private getWindow(agentId: string): CircularBuffer<RequestFingerprint> {
    return this.getOrCreateAgent(agentId).window;
  }

  /**
   * Record a request (called before forwarding to LLM)
   */
  recordRequest(
    agentId: string,
    body: Record<string, unknown>,
  ): { promptHash: bigint; toolCalls: string[] } {
    const normalizedPrompt = extractAndNormalizePrompt(body);
    const promptHash = computeSimHash(normalizedPrompt);
    const toolCalls = extractToolCalls(body);

    const fingerprint: RequestFingerprint = {
      promptHash,
      responseHash: null,
      toolCalls,
      timestamp: Date.now(),
    };

    const window = this.getWindow(agentId);
    window.push(fingerprint);
    this.touch(agentId);

    return { promptHash, toolCalls };
  }

  /**
   * Record a response (called after receiving LLM response)
   */
  recordResponse(agentId: string, responseText: string): void {
    const state = this.agents.get(agentId);
    if (!state) return;

    const latest = state.window.getLatest();
    if (latest && latest.responseHash === null) {
      const normalized = normalizePrompt(responseText);
      latest.responseHash = computeSimHash(normalized);
    }
    this.touch(agentId);
  }

  /**
   * Check if current request indicates a loop
   */
  checkLoop(
    agentId: string,
    promptHash: bigint,
    toolCalls: string[],
  ): LoopCheckResult {
    const config = this.getConfig(agentId);

    if (!config.enabled) {
      return {
        isLoop: false,
        score: 0,
        details: { similarPrompts: 0, similarResponses: 0, repeatedToolCalls: 0 },
      };
    }

    const window = this.getWindow(agentId);
    const history = window.getAll();

    // Don't include the just-added current request in comparison
    const pastRequests = history.slice(0, -1);

    if (pastRequests.length === 0) {
      return {
        isLoop: false,
        score: 0,
        details: { similarPrompts: 0, similarResponses: 0, repeatedToolCalls: 0 },
      };
    }

    // Count similar prompts
    let similarPrompts = 0;
    for (const req of pastRequests) {
      if (isSimilar(promptHash, req.promptHash, SIMILARITY_THRESHOLD)) {
        similarPrompts++;
      }
    }

    // Count similar responses: compare most recent response with older responses (O(n) instead of O(n²))
    let similarResponses = 0;
    const responsesWithHash = pastRequests.filter((r) => r.responseHash !== null);
    if (responsesWithHash.length >= 2) {
      // Compare the most recent response with all older ones
      const latestResponse = responsesWithHash[responsesWithHash.length - 1];
      for (let i = 0; i < responsesWithHash.length - 1; i++) {
        if (
          isSimilar(
            latestResponse.responseHash!,
            responsesWithHash[i].responseHash!,
            SIMILARITY_THRESHOLD,
          )
        ) {
          similarResponses++;
        }
      }
    }

    // Count repeated tool calls
    let repeatedToolCalls = 0;
    const toolCallSignature = toolCalls.sort().join(",");
    for (const req of pastRequests) {
      const pastSignature = req.toolCalls.sort().join(",");
      if (toolCallSignature && toolCallSignature === pastSignature) {
        repeatedToolCalls++;
      }
    }

    // Calculate score
    const score =
      similarPrompts * WEIGHTS.promptSimilarity +
      similarResponses * WEIGHTS.responseSimilarity +
      repeatedToolCalls * WEIGHTS.toolCallRepetition;

    return {
      isLoop: score >= config.threshold,
      score,
      details: {
        similarPrompts,
        similarResponses,
        repeatedToolCalls,
      },
    };
  }

  /**
   * Clear all state for an agent
   */
  clearAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.agents.clear();
  }

  /**
   * Set TTL for inactive agent cleanup
   */
  setTtl(ttlMs: number): void {
    this.ttlMs = ttlMs;
  }

  /**
   * Get TTL setting
   */
  getTtl(): number {
    return this.ttlMs;
  }
}

// Singleton instance
export const loopDetector = new LoopDetector();
