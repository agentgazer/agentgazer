/**
 * Payload Buffer - In-memory rolling buffer for request/response bodies.
 *
 * Used by kill switch to detect loops. Each agent has its own buffer
 * with a fixed window size. When kill switch triggers, the buffer
 * contents are extracted and saved as evidence.
 */

export interface BufferedPayload {
  eventId: string;
  agentId: string;
  requestBody: string;
  responseBody: string;
  timestamp: number;
}

// Per-agent buffers
const buffers: Map<string, BufferedPayload[]> = new Map();

// Default window size
let windowSize = 50;

/**
 * Set the buffer window size (number of payloads to keep per agent).
 */
export function setBufferWindowSize(size: number): void {
  if (size < 1) throw new Error("Window size must be at least 1");
  windowSize = size;
}

/**
 * Get the current buffer window size.
 */
export function getBufferWindowSize(): number {
  return windowSize;
}

/**
 * Push a new payload to the buffer.
 * If buffer exceeds window size, the oldest entry is removed.
 */
export function pushPayload(agentId: string, payload: BufferedPayload): void {
  let buffer = buffers.get(agentId);
  if (!buffer) {
    buffer = [];
    buffers.set(agentId, buffer);
  }

  buffer.push(payload);

  // Rolling window: remove oldest if exceeds size
  while (buffer.length > windowSize) {
    buffer.shift();
  }
}

/**
 * Get all payloads in the buffer for an agent (read-only copy).
 */
export function getPayloads(agentId: string): BufferedPayload[] {
  const buffer = buffers.get(agentId);
  return buffer ? [...buffer] : [];
}

/**
 * Extract and clear the buffer for an agent.
 * Used when kill switch triggers to get evidence.
 */
export function extractPayloads(agentId: string): BufferedPayload[] {
  const buffer = buffers.get(agentId);
  if (!buffer) return [];

  const payloads = [...buffer];
  buffer.length = 0; // Clear the array
  return payloads;
}

/**
 * Clear the buffer for an agent.
 */
export function clearPayloads(agentId: string): void {
  const buffer = buffers.get(agentId);
  if (buffer) {
    buffer.length = 0;
  }
}

/**
 * Get the number of payloads in the buffer for an agent.
 */
export function getBufferSize(agentId: string): number {
  const buffer = buffers.get(agentId);
  return buffer?.length ?? 0;
}

/**
 * Get all agent IDs with buffers.
 */
export function getBufferedAgents(): string[] {
  return Array.from(buffers.keys());
}

/**
 * Clear all buffers (for testing).
 */
export function clearAllBuffers(): void {
  buffers.clear();
}
