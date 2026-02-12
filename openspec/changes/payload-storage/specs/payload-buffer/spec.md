# Spec: Payload Buffer

## Overview

記憶體中的 per-agent rolling buffer，用於 kill switch 的 loop detection。

## Location

`packages/proxy/src/payload-buffer.ts`

## Interface

```typescript
export interface BufferedPayload {
  eventId: string;
  agentId: string;
  requestBody: string;
  responseBody: string;
  timestamp: number;
}

export interface PayloadBufferOptions {
  windowSize?: number;  // 預設 50
}

export function pushPayload(agentId: string, payload: BufferedPayload): void;
export function getPayloads(agentId: string): BufferedPayload[];
export function extractPayloads(agentId: string): BufferedPayload[];
export function clearPayloads(agentId: string): void;
export function getBufferSize(agentId: string): number;
export function setWindowSize(size: number): void;
```

## Behavior

1. `pushPayload`: 加入新 payload，如果超過 windowSize 則移除最舊的
2. `getPayloads`: 取得 buffer 但不清空（唯讀）
3. `extractPayloads`: 取得並清空 buffer（給 kill switch 用）
4. Rolling window: FIFO，最多保留 windowSize 筆

## Integration

在 `proxy-server.ts` 的 request handler 中，成功取得 response 後：

```typescript
import { pushPayload } from "./payload-buffer.js";

// After successful response
pushPayload(agentId, {
  eventId,
  agentId,
  requestBody: JSON.stringify(requestBody),
  responseBody: JSON.stringify(responseBody),
  timestamp: Date.now(),
});
```

## Tests

- push 超過 window size 時自動移除最舊
- extract 後 buffer 應為空
- 不同 agent 的 buffer 互不影響
