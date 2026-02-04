# Provider 金鑰管理

AgentTrace 可以代管你的 LLM provider API key，讓你的應用程式不需要知道金鑰。代理會自動為每個 provider 注入正確的 auth header。

## 在 Onboard 時設定

```bash
agenttrace onboard
```

Onboard 精靈會逐一詢問各 provider 的 API key。按 Enter 可跳過任何 provider。

## 用 CLI 管理

```bash
# 列出已設定的 provider
agenttrace providers list

# 設定或更新 provider key
agenttrace providers set openai sk-proj-...
agenttrace providers set anthropic sk-ant-...

# 移除 provider
agenttrace providers remove openai
```

## 支援的 Provider

| Provider | 注入的 Auth Header |
|----------|--------------------|
| `openai` | `Authorization: Bearer <key>` |
| `anthropic` | `x-api-key: <key>` |
| `google` | `x-goog-api-key: <key>` |
| `mistral` | `Authorization: Bearer <key>` |
| `cohere` | `Authorization: Bearer <key>` |

## 運作原理

1. 透過 `agenttrace providers set` 或 `agenttrace onboard` 設定 API key
2. 金鑰安全存放——永遠不會以明文寫入設定檔：
   - **macOS**：系統鑰匙圈（需有 GUI 登入階段）
   - **Linux 桌面**：libsecret / GNOME Keyring
   - **SSH / 無頭環境 / Docker**：AES-256-GCM 加密檔案（`~/.agenttrace/secrets.enc`）
3. `agenttrace start` 啟動時，金鑰在記憶體中載入並傳給代理
4. 每次請求，代理偵測 provider 後注入對應的 auth header
5. 如果 client 已經帶了自己的 auth header，代理**不會**覆蓋

這代表你的應用程式可以不帶任何 API key 送請求：

```bash
# 不需要 Authorization header — 代理會自動注入
curl http://localhost:4000/v1/chat/completions \
  -H "Host: api.openai.com" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
```

## 金鑰存放方式

API 金鑰**永遠不會**存在 `config.json` 中。它們由作業系統鑰匙圈保護或以加密方式靜態存放。

你可以檢查目前使用的後端：

```bash
agenttrace doctor
```

用 `AGENTTRACE_SECRET_BACKEND` 環境變數覆寫後端：

| 值 | 後端 |
|----|------|
| `keychain` | macOS 鑰匙圈 |
| `libsecret` | Linux libsecret |
| `machine` | 加密檔案（機器衍生金鑰） |

## 安全架構

各後端的信任邊界不同：

| 後端 | 誰負責加密 | 誰能解密 | 保護等級 |
|------|-----------|---------|---------|
| macOS 鑰匙圈 | 作業系統（Security framework） | 當前使用者登入階段 + 授權的應用程式 | 作業系統管理——最強 |
| Linux libsecret | 桌面環境（GNOME Keyring / KDE Wallet） | 當前使用者的 D-Bus session | 作業系統管理——強 |
| 加密檔案（`machine`） | AgentTrace（AES-256-GCM，透過 `crypto.scryptSync`） | 同一台機器上相同 OS 使用者的任何程序 | 應用程式管理——優於明文 |

加密檔案後端（MachineKeyStore）從 `machine-id` 和 `username` 透過 scrypt 衍生金鑰。這些不是機密輸入，因此以相同使用者身分在同一台機器上執行的程序理論上可以推導出相同的金鑰。此後端定位為 SSH、無頭環境和 Docker 中「優於明文」的備用方案，而非作業系統鑰匙圈的替代品。

**執行期生命週期：** 金鑰在 `agenttrace start` 啟動時解密一次，在程序存活期間保存於記憶體中，永遠不會寫回磁碟。更改金鑰需要重新啟動 `agenttrace start`。

## 速率限制

每個 provider 可以設定可選的速率限制。設定後，代理會執行滑動視窗限制，超過時回傳 `429 Too Many Requests` 和 `Retry-After` header。

在 onboard 時設定（例如 `100/60` 代表每 60 秒 100 次請求），或直接編輯設定檔。
