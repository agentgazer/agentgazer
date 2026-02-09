# Provider 金鑰管理

## 作業系統層級安全儲存

Provider 的 API Key **不會以明文形式**儲存。AgentGazer 使用作業系統層級的安全儲存後端：

| 平台 | 儲存後端 | 安全性 |
|------|----------|--------|
| **macOS** | Keychain | 透過 Secure Enclave 硬體加密 |
| **Linux（桌面）** | libsecret / GNOME Keyring | 工作階段鎖定加密 |
| **Linux（無 GUI）** | AES-256-GCM 加密檔案 | 基於機器特徵的金鑰衍生 |

金鑰在靜態時加密，僅在需要進行 API 呼叫時才在記憶體中解密。

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
| 1 | macOS Keychain | 在有 GUI 的 macOS 環境下自動使用 |
| 2 | Linux libsecret | 在 Linux 桌面環境下自動使用 |
| 3 | MachineKeyStore（預設） | 基於 machine-id + 使用者名稱的 AES-256-GCM 加密 |

### 手動指定後端

如需覆蓋自動偵測，可設定環境變數：

```bash
export AGENTGAZER_SECRET_BACKEND=machine
```

有效值：
- `keychain` — 強制使用 macOS Keychain
- `libsecret` — 強制使用 Linux libsecret
- `machine` — 強制使用 AES-256-GCM 加密檔案

## 自動遷移

如果 `config.json` 中存在舊版的明文 API Key，AgentGazer 會在啟動時**自動**將其遷移到加密金鑰庫。

## 安全注入機制

Proxy 在轉發請求時，僅在 hostname 與已知 Provider 匹配時才會注入 API Key，防止金鑰洩漏到未知的第三方服務。
