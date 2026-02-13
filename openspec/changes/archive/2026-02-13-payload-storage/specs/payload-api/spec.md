# Spec: Payload API

## Overview

Payload 相關的 REST API endpoints。

## Location

`packages/server/src/routes/payloads.ts`

## Endpoints

### POST /api/payloads

Archive a payload (from proxy).

**Request:**
```json
{
  "eventId": "abc123",
  "agentId": "my-agent",
  "requestBody": "{...}",
  "responseBody": "{...}"
}
```

**Response:** `201 Created`
```json
{
  "queued": true
}
```

**Notes:**
- 只有 payload.enabled = true 時才接受
- 加入 write buffer，非同步寫入

### POST /api/payloads/evidence

Save kill switch evidence (from proxy).

**Request:**
```json
{
  "killSwitchEventId": "ks-456",
  "payloads": [
    {
      "eventId": "abc123",
      "agentId": "my-agent",
      "requestBody": "{...}",
      "responseBody": "{...}",
      "timestamp": 1707800000000
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "saved": 50
}
```

**Notes:**
- 同步寫入（重要事件）
- 設定 pinned=1，不受 retention 影響

### GET /api/payloads/:eventId

Get payload by event ID.

**Response:** `200 OK`
```json
{
  "id": "pay-789",
  "eventId": "abc123",
  "agentId": "my-agent",
  "requestBody": "{...}",
  "responseBody": "{...}",
  "sizeBytes": 1234,
  "purpose": "archive",
  "pinned": false,
  "killSwitchEventId": null,
  "createdAt": "2024-02-12T10:00:00Z"
}
```

**Response:** `404 Not Found` if not exists

### GET /api/kill-switch/:eventId/evidence

Get all evidence payloads for a kill switch event.

**Response:** `200 OK`
```json
{
  "killSwitchEventId": "ks-456",
  "payloads": [
    { ... },
    { ... }
  ],
  "count": 50
}
```

### DELETE /api/payloads/archive

Clear all archived payloads (not evidence).

**Response:** `200 OK`
```json
{
  "deleted": 1234
}
```

**Notes:**
- 只刪除 purpose='archive' 且 pinned=0
- Evidence 永遠保留

## Authentication

所有 endpoints 需要 API token (x-api-key header)。

## Dashboard Integration

Dashboard 的 Kill Switch 詳情頁可以顯示 evidence payloads：

```
GET /api/kill-switch/{eventId}/evidence
```

顯示觸發 kill switch 的 50 筆對話內容，方便分析原因。
