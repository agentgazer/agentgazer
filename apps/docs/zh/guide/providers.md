# Provider 金鑰管理

## 加密儲存

Provider 的 API Key **不會以明文形式**儲存在設定檔中。AgentGazer 使用 **AES-256-GCM** 加密金鑰庫來保護你的 API Key。

## 儲存與管理

```bash
# 儲存 OpenAI API Key（安全加密）
agentgazer providers set openai sk-xxxxxxxxxxxxx

# 儲存 Anthropic API Key
agentgazer providers set anthropic sk-ant-xxxxxxxxxxxxx

# 列出已設定的 Provider
agentgazer providers list

# 移除 Provider
agentgazer providers remove openai
```

## 金鑰庫後端

AgentGazer 支援多種金鑰庫後端，依以下優先順序自動偵測：

| 優先順序 | 後端 | 說明 |
|----------|------|------|
| 1 | 環境變數指定 | 透過 `AGENTGAZER_SECRET_BACKEND` 手動指定 |
| 2 | macOS Keychain | 在有 GUI 的 macOS 環境下自動使用 |
| 3 | Linux libsecret | 在 Linux 環境下自動使用 |
| 4 | MachineKeyStore（預設） | 基於 machine-id + 使用者名稱的 AES-256-GCM 加密 |

## 自動遷移

如果 `config.json` 中存在舊版的明文 API Key，AgentGazer 會在啟動時**自動**將其遷移到加密金鑰庫。

## 安全注入機制

Proxy 在轉發請求時，僅在 hostname 與已知 Provider 匹配時才會注入 API Key，防止金鑰洩漏到未知的第三方服務。
