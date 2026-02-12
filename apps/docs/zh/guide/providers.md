# Provider 金鑰管理

AgentGazer 支援兩種 LLM Provider 認證方式：

- **API Key** — 傳統 API 金鑰認證（大多數 Provider）
- **OAuth** — 瀏覽器登入訂閱服務（OpenAI Codex、智譜 Coding Plan）

## 支援的 Provider

| Provider | 認證方式 | 端點 |
|----------|----------|------|
| OpenAI | API Key | api.openai.com |
| OpenAI Codex | **OAuth** | api.openai.com |
| Anthropic | API Key | api.anthropic.com |
| Google (Gemini) | API Key | generativelanguage.googleapis.com |
| Mistral | API Key | api.mistral.ai |
| Cohere | API Key | api.cohere.com |
| DeepSeek | API Key | api.deepseek.com |
| Moonshot | API Key | api.moonshot.cn |
| 智譜 (GLM-4) | API Key | api.z.ai |
| 智譜 Coding Plan | **OAuth** | api.z.ai |
| MiniMax | API Key | api.minimax.chat |
| 百川 | API Key | api.baichuan-ai.com |
| 零一萬物 | API Key | api.lingyiwanwu.com |

## OAuth 認證

對於訂閱制的 Provider（OpenAI Codex、智譜 Coding Plan），使用 OAuth 登入：

```bash
# 透過瀏覽器登入（推薦）
agentgazer login openai-oauth

# 或使用設備碼流程（適用於無頭伺服器）
agentgazer login openai-oauth --device

# 檢查登入狀態
agentgazer providers list

# 登出
agentgazer logout openai-oauth
```

### OAuth 運作原理

1. **瀏覽器流程**：開啟瀏覽器前往 Provider 的登入頁面
2. **PKCE 安全性**：使用 Proof Key for Code Exchange 確保 Token 取得的安全性
3. **自動刷新**：Token 會在到期前自動刷新
4. **安全儲存**：OAuth Token 與 API Key 儲存在同一個安全金鑰庫

### 可用的 OAuth Provider

| Provider | 指令 | 說明 |
|----------|------|------|
| OpenAI Codex | `agentgazer login openai-oauth` | OpenAI 訂閱（ChatGPT Plus/Pro） |
| 智譜 Coding Plan | `agentgazer login zhipu-coding-plan` | 智譜 GLM 訂閱 |

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
