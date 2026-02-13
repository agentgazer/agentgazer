/**
 * Security filter module for proxy.
 * Checks requests and responses against configured security rules.
 */

import {
  checkPromptInjection,
  maskSensitiveData,
  checkToolCategory,
  isToolAllowed,
  isToolBlocked,
  type PromptInjectionMatch,
  type SensitiveDataMatch,
} from "@agentgazer/shared";
import {
  getSecurityConfig,
  insertSecurityEvent,
  type SecurityConfig,
  type InsertSecurityEvent,
} from "@agentgazer/server";
import type Database from "better-sqlite3";
import { createLogger } from "@agentgazer/shared";

const log = createLogger("security");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecurityCheckResult {
  allowed: boolean;
  events: SecurityEventData[];
  modifiedContent?: string;
  blockReason?: string;
}

export interface SecurityEventData {
  event_type: "prompt_injection" | "data_masked" | "tool_blocked";
  severity: "info" | "warning" | "critical";
  action_taken: "logged" | "alerted" | "blocked" | "masked";
  rule_name: string;
  matched_pattern?: string;
  snippet?: string;
}

interface ToolCall {
  id?: string;
  type?: string;
  function?: {
    name: string;
    arguments?: string;
  };
  name?: string;  // Alternative format
}

// ---------------------------------------------------------------------------
// Config Cache
// ---------------------------------------------------------------------------

const CONFIG_CACHE_TTL_MS = 5_000; // 5 seconds

interface CachedConfig {
  config: SecurityConfig;
  expiresAt: number;
}

const configCache: Map<string, CachedConfig> = new Map();

function getCachedConfig(db: Database.Database | undefined, agentId: string): SecurityConfig | null {
  if (!db) return null;

  const cacheKey = agentId || "__global__";
  const cached = configCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  // Fetch from DB
  const config = getSecurityConfig(db, agentId || null);

  // Cache it
  configCache.set(cacheKey, {
    config,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
  });

  return config;
}

/**
 * Clear the security config cache.
 */
export function clearSecurityConfigCache(agentId?: string): void {
  if (agentId) {
    configCache.delete(agentId);
  } else {
    configCache.clear();
  }
}

// ---------------------------------------------------------------------------
// Security Filter Class
// ---------------------------------------------------------------------------

export class SecurityFilter {
  private db: Database.Database | undefined;
  private serverEndpoint: string | undefined;
  private apiKey: string | undefined;

  constructor(options: {
    db?: Database.Database;
    serverEndpoint?: string;
    apiKey?: string;
  }) {
    this.db = options.db;
    this.serverEndpoint = options.serverEndpoint;
    this.apiKey = options.apiKey;
  }

  /**
   * Check request content before forwarding to the provider.
   * Performs data masking and tool restriction checks.
   */
  async checkRequest(
    agentId: string,
    requestBody: string,
    requestId?: string,
  ): Promise<SecurityCheckResult> {
    const config = getCachedConfig(this.db, agentId);
    if (!config) {
      return { allowed: true, events: [] };
    }

    const events: SecurityEventData[] = [];
    let modifiedContent = requestBody;

    try {
      const bodyJson = JSON.parse(requestBody);

      // 1. Data masking on messages/prompts
      const { maskedBody, maskEvents } = this.maskRequestData(bodyJson, config);
      if (maskEvents.length > 0) {
        events.push(...maskEvents);
        modifiedContent = JSON.stringify(maskedBody);
      }

      // 2. Tool restriction checks
      const toolEvents = this.checkToolRestrictionsInRequest(bodyJson, config);
      events.push(...toolEvents);

      // Check if any event requires blocking
      const blockEvent = toolEvents.find(e =>
        e.action_taken === "blocked" && config.tool_restrictions.action === "block"
      );

      if (blockEvent) {
        // Record events to server
        await this.recordEvents(agentId, events, requestId);
        return {
          allowed: false,
          events,
          blockReason: `Tool restriction: ${blockEvent.rule_name}`,
        };
      }

      // Record events to server (non-blocking)
      if (events.length > 0) {
        await this.recordEvents(agentId, events, requestId);
      }

      return {
        allowed: true,
        events,
        modifiedContent: maskEvents.length > 0 ? modifiedContent : undefined,
      };
    } catch {
      // Non-JSON body, skip security checks
      return { allowed: true, events: [] };
    }
  }

  /**
   * Check response content before returning to the client.
   * Performs prompt injection detection only.
   * Note: Data masking is intentionally NOT applied to responses - if sensitive data
   * appears in an LLM response, it's either fictional or already leaked.
   */
  async checkResponse(
    agentId: string,
    responseBody: string,
    requestId?: string,
  ): Promise<SecurityCheckResult> {
    const config = getCachedConfig(this.db, agentId);
    if (!config) {
      return { allowed: true, events: [] };
    }

    const events: SecurityEventData[] = [];

    try {
      const bodyJson = JSON.parse(responseBody);

      // Prompt injection detection on assistant content
      const injectionEvents = this.checkPromptInjectionInResponse(bodyJson, config);
      events.push(...injectionEvents);

      // Check if any event requires blocking
      const blockEvent = injectionEvents.find(e =>
        e.action_taken === "blocked" && config.prompt_injection.action === "block"
      );

      if (blockEvent) {
        // Record events to server
        await this.recordEvents(agentId, events, requestId);
        return {
          allowed: false,
          events,
          blockReason: `Prompt injection detected: ${blockEvent.rule_name}`,
        };
      }

      // Record events to server (non-blocking)
      if (events.length > 0) {
        await this.recordEvents(agentId, events, requestId);
      }

      return { allowed: true, events };
    } catch {
      // Non-JSON body, skip security checks
      return { allowed: true, events: [] };
    }
  }

  // ---------------------------------------------------------------------------
  // Request Checks
  // ---------------------------------------------------------------------------

  private maskRequestData(
    body: Record<string, unknown>,
    config: SecurityConfig,
  ): { maskedBody: Record<string, unknown>; maskEvents: SecurityEventData[] } {
    const events: SecurityEventData[] = [];
    const maskedBody = JSON.parse(JSON.stringify(body)); // Deep clone

    // Check messages array (OpenAI/Anthropic format)
    const messages = maskedBody.messages as Array<{ content?: string | unknown[] }> | undefined;
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (typeof msg.content === "string") {
          const result = maskSensitiveData(
            msg.content,
            config.data_masking.replacement,
            config.data_masking.rules,
            config.data_masking.custom,
          );
          if (result.matches.length > 0) {
            msg.content = result.masked;
            for (const match of result.matches) {
              events.push({
                event_type: "data_masked",
                severity: "info",
                action_taken: "masked",
                rule_name: match.pattern.name,
                matched_pattern: match.pattern.pattern.source,
                snippet: this.truncateSnippet(match.match),
              });
            }
          }
        } else if (Array.isArray(msg.content)) {
          // Handle content blocks (e.g., Anthropic format)
          for (const block of msg.content) {
            if (typeof block === "object" && block !== null && "text" in block) {
              const textBlock = block as { text: string };
              const result = maskSensitiveData(
                textBlock.text,
                config.data_masking.replacement,
                config.data_masking.rules,
                config.data_masking.custom,
              );
              if (result.matches.length > 0) {
                textBlock.text = result.masked;
                for (const match of result.matches) {
                  events.push({
                    event_type: "data_masked",
                    severity: "info",
                    action_taken: "masked",
                    rule_name: match.pattern.name,
                    matched_pattern: match.pattern.pattern.source,
                    snippet: this.truncateSnippet(match.match),
                  });
                }
              }
            }
          }
        }
      }
    }

    // Check prompt field (some APIs)
    if (typeof maskedBody.prompt === "string") {
      const result = maskSensitiveData(
        maskedBody.prompt,
        config.data_masking.replacement,
        config.data_masking.rules,
        config.data_masking.custom,
      );
      if (result.matches.length > 0) {
        maskedBody.prompt = result.masked;
        for (const match of result.matches) {
          events.push({
            event_type: "data_masked",
            severity: "info",
            action_taken: "masked",
            rule_name: match.pattern.name,
            matched_pattern: match.pattern.pattern.source,
            snippet: this.truncateSnippet(match.match),
          });
        }
      }
    }

    return { maskedBody, maskEvents: events };
  }

  private checkToolRestrictionsInRequest(
    body: Record<string, unknown>,
    config: SecurityConfig,
  ): SecurityEventData[] {
    const events: SecurityEventData[] = [];
    const rules = config.tool_restrictions.rules;
    const action = config.tool_restrictions.action;
    const actionTaken = action === "block" ? "blocked" : action === "alert" ? "alerted" : "logged";

    // Extract tool calls from request
    const toolCalls = this.extractToolCallsFromRequest(body);

    // Check max per request
    if (rules.max_per_request !== null && toolCalls.length > rules.max_per_request) {
      events.push({
        event_type: "tool_blocked",
        severity: "warning",
        action_taken: actionTaken,
        rule_name: "max_per_request",
        snippet: `${toolCalls.length} tools (max: ${rules.max_per_request})`,
      });
    }

    // Check each tool
    for (const toolName of toolCalls) {
      // Check blocklist
      if (isToolBlocked(toolName, config.tool_restrictions.blocklist)) {
        events.push({
          event_type: "tool_blocked",
          severity: "critical",
          action_taken: actionTaken,
          rule_name: "blocklist",
          matched_pattern: toolName,
        });
        continue;
      }

      // Check allowlist (if not empty, only allow listed tools)
      if (!isToolAllowed(toolName, config.tool_restrictions.allowlist)) {
        events.push({
          event_type: "tool_blocked",
          severity: "warning",
          action_taken: actionTaken,
          rule_name: "allowlist",
          matched_pattern: toolName,
        });
        continue;
      }

      // Check category restrictions
      const blockedCategory = checkToolCategory(toolName, {
        filesystem: rules.block_filesystem,
        network: rules.block_network,
        code_execution: rules.block_code_execution,
      });

      if (blockedCategory) {
        events.push({
          event_type: "tool_blocked",
          severity: "warning",
          action_taken: actionTaken,
          rule_name: `block_${blockedCategory}`,
          matched_pattern: toolName,
        });
      }
    }

    return events;
  }

  private extractToolCallsFromRequest(body: Record<string, unknown>): string[] {
    const tools: string[] = [];

    // OpenAI format: tool_calls in assistant message
    const messages = body.messages as Array<{ role?: string; tool_calls?: ToolCall[] }> | undefined;
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            const name = tc.function?.name || tc.name;
            if (name) tools.push(name);
          }
        }
      }
    }

    // Anthropic format: tool_use in content blocks
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        const content = (msg as { content?: unknown[] }).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (typeof block === "object" && block !== null) {
              const b = block as { type?: string; name?: string };
              if (b.type === "tool_use" && b.name) {
                tools.push(b.name);
              }
            }
          }
        }
      }
    }

    // OpenAI: tools array in request (available tools)
    const requestTools = body.tools as Array<{ function?: { name?: string } }> | undefined;
    if (Array.isArray(requestTools)) {
      for (const tool of requestTools) {
        const name = tool.function?.name;
        if (name) tools.push(name);
      }
    }

    return tools;
  }

  // ---------------------------------------------------------------------------
  // Response Checks
  // ---------------------------------------------------------------------------

  private checkPromptInjectionInResponse(
    body: Record<string, unknown>,
    config: SecurityConfig,
  ): SecurityEventData[] {
    const events: SecurityEventData[] = [];
    const action = config.prompt_injection.action;
    const actionTaken = action === "block" ? "blocked" : action === "alert" ? "alerted" : "logged";

    // Extract assistant content from response
    const assistantContent = this.extractAssistantContent(body);

    for (const content of assistantContent) {
      const matches = checkPromptInjection(
        content,
        config.prompt_injection.rules,
        config.prompt_injection.custom,
      );

      for (const match of matches) {
        events.push({
          event_type: "prompt_injection",
          severity: match.pattern.severity,
          action_taken: actionTaken,
          rule_name: match.pattern.name,
          matched_pattern: match.pattern.pattern.source,
          snippet: this.truncateSnippet(match.match),
        });
      }
    }

    return events;
  }

  private extractAssistantContent(body: Record<string, unknown>): string[] {
    const content: string[] = [];

    // OpenAI format: choices[].message.content
    const choices = body.choices as Array<{ message?: { content?: string } }> | undefined;
    if (Array.isArray(choices)) {
      for (const choice of choices) {
        if (choice.message?.content) {
          content.push(choice.message.content);
        }
      }
    }

    // Anthropic format: content[].text
    const anthropicContent = body.content as Array<{ type?: string; text?: string }> | undefined;
    if (Array.isArray(anthropicContent)) {
      for (const block of anthropicContent) {
        if (block.type === "text" && block.text) {
          content.push(block.text);
        }
      }
    }

    return content;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private truncateSnippet(text: string, maxLength = 100): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  }

  private async recordEvents(
    agentId: string,
    events: SecurityEventData[],
    requestId?: string,
  ): Promise<void> {
    // Record to DB if available
    if (this.db) {
      for (const event of events) {
        try {
          insertSecurityEvent(this.db, {
            agent_id: agentId,
            event_type: event.event_type,
            severity: event.severity,
            action_taken: event.action_taken,
            rule_name: event.rule_name,
            matched_pattern: event.matched_pattern,
            snippet: event.snippet,
            request_id: requestId,
          });
        } catch (err) {
          log.error("Failed to record security event", { err: String(err) });
        }
      }
      return;
    }

    // Fall back to HTTP API if no direct DB access
    if (this.serverEndpoint && this.apiKey) {
      for (const event of events) {
        try {
          await fetch(`${this.serverEndpoint}/api/security/events`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              agent_id: agentId,
              ...event,
              request_id: requestId,
            }),
          });
        } catch (err) {
          log.error("Failed to record security event via API", { err: String(err) });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Exported helper functions
// ---------------------------------------------------------------------------

/**
 * Generate a blocked response in OpenAI format for security blocks.
 */
export function generateSecurityBlockedResponse(
  reason: string,
  provider: string,
): Record<string, unknown> {
  return {
    id: `chatcmpl-security-blocked-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "security-filter",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `[Security] Request blocked: ${reason}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}
