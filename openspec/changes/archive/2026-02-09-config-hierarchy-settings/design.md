# Design: Config Hierarchy & Settings

## Config Schema

### New Structure

```typescript
interface AgentGazerConfig {
  token: string;

  server?: {
    port?: number;           // default: 18800
    proxyPort?: number;      // default: 18900
    autoOpen?: boolean;      // default: true
  };

  data?: {
    retentionDays?: number;  // default: 30
  };

  alerts?: {
    defaults?: {
      telegram?: {
        botToken?: string;
        chatId?: string;
      };
      webhook?: {
        url?: string;
      };
    };
  };

  providers?: Record<string, ProviderConfig>;
}
```

### Migration

讀取舊格式時自動轉換並寫回：

```
舊格式                          新格式
─────────                       ─────────
port: 18800              →      server.port: 18800
proxyPort: 18900         →      server.proxyPort: 18900
autoOpen: true           →      server.autoOpen: true
retentionDays: 30        →      data.retentionDays: 30
```

## API Design

### GET /api/settings

回傳 config（不含 token 和 providers）：

```json
{
  "server": { "port": 18800, "proxyPort": 18900, "autoOpen": true },
  "data": { "retentionDays": 30 },
  "alerts": {
    "defaults": {
      "telegram": { "botToken": "123:ABC", "chatId": "-100123" },
      "webhook": { "url": "https://..." }
    }
  }
}
```

### PUT /api/settings

Partial merge 更新，回傳更新後的完整 settings。

Request body 範例：
```json
{
  "alerts": {
    "defaults": {
      "telegram": { "botToken": "new-token", "chatId": "-999" }
    }
  }
}
```

## Dashboard Settings Page

路由：`/settings`

表單區塊：
1. **Server** - port, proxyPort, autoOpen（checkbox）
2. **Data** - retentionDays
3. **Alert Defaults**
   - Telegram: botToken, chatId
   - Webhook: url

儲存邏輯：
- PUT /api/settings
- 如果 port 或 proxyPort 改變，顯示 "Restart required for port changes to take effect"

## CLI Integration

`agent <name> alert add` 讀取 defaults：

1. 讀取 config.alerts.defaults
2. 如果 user 沒給 `--webhook`，檢查是否有 `defaults.webhook.url`
3. 如果 user 沒給 `--telegram`，檢查是否有 `defaults.telegram`
4. 建立 alert 後，如果使用了新的 telegram/webhook 值，更新 defaults

## File Changes

```
packages/cli/src/config.ts        - 新 schema + migration
packages/server/src/server.ts     - 接收 configPath
packages/server/src/routes/       - 新增 settings.ts
apps/dashboard-local/src/pages/   - 新增 Settings.tsx
apps/dashboard-local/src/App.tsx  - 新增 /settings route
packages/cli/src/commands/agent.ts - 讀取/更新 defaults
```
