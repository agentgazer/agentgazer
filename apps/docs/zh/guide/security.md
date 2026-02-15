# 安全護盾

安全護盾是 AgentGazer 內建的保護層，可即時監控和過濾 AI 代理的通訊。它通過三類保護提供縱深防禦：

- **提示詞注入檢測** — 識別試圖操縱 AI 指令的行為
- **敏感資料遮罩** — 自動從請求和回應中隱藏敏感資訊
- **工具調用限制** — 控制代理可以使用的工具

## 啟用安全護盾

在儀表板中導航到 **Security** 頁面。選擇一個代理或使用「全域預設」將規則應用於所有代理。切換各項規則的開關並儲存配置。

::: tip 按代理配置
您可以為每個代理配置不同的安全規則。這允許對面向客戶的代理使用更嚴格的規則，同時對內部測試代理放寬規則。
:::

## 提示詞注入檢測 {#prompt-injection}

提示詞注入攻擊試圖通過插入惡意指令來操縱 AI 行為。AgentGazer 檢測四類提示詞注入：

### 忽略指令 {#ignore-instructions}

檢測試圖讓 AI 忽略其原始指令或系統提示詞的行為。

**檢測模式：**
- "ignore all previous instructions"（忽略所有先前指令）
- "forget your rules"（忘記你的規則）
- "disregard prior context"（忽略先前上下文）
- "do not follow your original instructions"（不要遵循原始指令）

**嚴重性：** 嚴重

**何時啟用：** 始終建議在生產代理中啟用。僅在需要覆蓋代理行為的測試環境中禁用。

### 系統提示詞覆蓋 {#system-override}

檢測試圖注入新系統提示詞或覆蓋現有提示詞的行為。

**檢測模式：**
- "new system prompt:"（新系統提示詞）
- "override system message"（覆蓋系統訊息）
- "enable developer mode"（啟用開發者模式）
- "sudo mode" / "admin access"（管理員存取）
- 以 "System:" 開頭的訊息

**嚴重性：** 嚴重（大多數模式），警告（System: 前綴）

**何時啟用：** 對處理不受信任用戶輸入的代理至關重要。攻擊者經常嘗試通過偽造的系統提示詞來提升權限。

### 角色劫持 {#role-hijacking}

檢測試圖讓 AI 假定繞過其安全準則的不同身份或角色的行為。

**檢測模式：**
- "you are now a ..."（你現在是...）
- "pretend to be ..."（假裝是...）
- "act as if you are ..."（表現得像...）
- "roleplay as ..."（扮演...）
- "assume the identity of ..."（假定...的身份）

**嚴重性：** 嚴重（身份假定），警告（角色扮演請求）

**何時啟用：** 建議對有定義角色的代理啟用。可以在角色切換是預期功能的創意/角色扮演應用中禁用。

### 越獄嘗試 {#jailbreak}

檢測已知的越獄技術和試圖繞過 AI 安全措施的行為。

**檢測模式：**
- "DAN"（Do Anything Now）提示詞
- "jailbreak" 關鍵字
- "bypass safety filters"（繞過安全過濾器）
- "remove restrictions"（移除限制）
- "without any limitations"（無任何限制）
- "disable safety checks"（禁用安全檢查）

**嚴重性：** 嚴重

**何時啟用：** 始終建議啟用。這些模式表明有意試圖規避安全措施。

## 敏感資料遮罩 {#data-masking}

資料遮罩自動檢測並隱藏敏感資訊，以防止意外的資料洩露。檢測到的內容會被替換為 `[REDACTED]`。

### API 金鑰 {#api-keys}

檢測主要供應商的 API 金鑰和存取令牌。

**支援格式：**
| 供應商 | 格式 |
|--------|------|
| OpenAI | `sk-...`（32+ 字元）|
| Anthropic | `sk-ant-...`（32+ 字元）|
| Google | `AIza...`（39 字元）|
| AWS | `AKIA...`（20 字元）|
| GitHub | `ghp_`、`gho_`、`ghu_`、`ghs_`、`ghr_` 令牌 |
| Stripe | `sk_live_`、`sk_test_` 金鑰 |
| 通用 | `api_key=`、`access_token=` 模式 |

**何時啟用：** 始終建議啟用。防止在日誌、回應或外部整合中意外暴露憑證。

### 信用卡 {#credit-cards}

檢測主要支付網路的信用卡號碼。

**支援格式：**
- Visa（以 4 開頭）
- Mastercard（以 51-55 開頭）
- American Express（以 34 或 37 開頭）
- CVV/CVC 碼

**何時啟用：** 對處理財務資料或客戶資訊的代理至關重要。

### 個人資料 {#personal-data}

檢測個人身份資訊（PII）。

**支援格式：**
- 社會安全號碼（XXX-XX-XXXX）
- 電子郵件地址
- 美國電話號碼
- 護照號碼

**何時啟用：** 遵守 GDPR、HIPAA 和其他隱私法規所必需。建議對所有面向客戶的代理啟用。

### 加密錢包和金鑰 {#crypto}

檢測加密貨幣地址和私鑰。

**支援格式：**
- 比特幣地址（傳統格式和 bech32）
- 以太坊地址（0x...）
- 以太坊私鑰（0x... 64 字元）
- Solana 地址
- 助記詞（12 或 24 個單詞）

**何時啟用：** 對加密相關應用至關重要。防止意外暴露錢包地址或私鑰。

### 環境變數 {#env-vars}

檢測通常儲存在環境變數中的秘密。

**支援格式：**
- `password=`、`passwd=`、`pwd=`
- `secret=`、`private_key=`
- 資料庫連接字串（postgres://、mysql://、mongodb://、redis://）

**何時啟用：** 建議在開發環境中啟用。防止通過錯誤訊息或除錯輸出洩露配置秘密。

## 工具調用限制 {#tool-restrictions}

工具限制控制代理可以調用的工具類別。這提供了對基於工具的攻擊的防禦，並限制受損代理的影響範圍。

### 檔案系統操作 {#filesystem}

阻止讀取、寫入或操作檔案和目錄的工具。

**阻止的工具模式：**
- `read_file`、`write_file`、`delete_file`
- `read_dir`、`write_dir`、`list_dir`
- 以 `fs_`、`file_`、`path_` 開頭的工具

**何時啟用：** 用於不應具有檔案系統存取權限的代理。防止未經授權讀取敏感檔案或寫入惡意內容。

### 網路操作 {#network}

阻止發送 HTTP 請求或外部通訊的工具。

**阻止的工具模式：**
- `http_`、`fetch_`、`curl_`、`wget_`、`request_`
- `get_url`、`post_url`、`api_call`
- `send_email`、`send_sms`、`webhook_`

**何時啟用：** 用於不應與外部通訊的沙盒代理。防止資料外洩和未經授權的 API 調用。

### 程式碼執行 {#code-execution}

阻止執行任意程式碼或 shell 命令的工具。

**阻止的工具模式：**
- `exec`、`execute`、`run`、`eval`
- `shell`、`bash`、`system`、`subprocess`
- `python_exec`、`node_exec`

**何時啟用：** 用於不應執行任意程式碼的代理。這對處理不受信任輸入的面向客戶的代理是關鍵限制。

## 自我保護 {#self-protection}

自我保護防止 AI agent 存取 AgentGazer 自身的設定檔和其他敏感本機檔案。這可以防止試圖竊取憑證或修改安全設定的提示詞注入攻擊。

### 受保護路徑

| 類別 | 受保護檔案 |
|------|-----------|
| **AgentGazer 設定** | `~/.agentgazer/config.json`、`~/.agentgazer/data.db` |
| **SSH 金鑰** | `~/.ssh/id_rsa`、`~/.ssh/id_ed25519`、`~/.ssh/config` |
| **雲端憑證** | `~/.aws/credentials`、`~/.azure/`、`~/.config/gcloud/` |
| **Shell 歷史** | `~/.bash_history`、`~/.zsh_history` |
| **環境變數檔** | `.env`、`.env.local`、`.env.production` |

### 偵測邏輯

自我保護只在以下情況觸發：
1. **存在動作動詞** — 訊息包含讀取相關動詞如 `read`、`open`、`cat`、`show`、`display`、`print`、`view`
2. **提及敏感路徑** — 訊息引用了受保護的檔案路徑
3. **只檢查最新訊息** — 只檢查最新的使用者訊息（不檢查對話歷史）

這可以防止以下情況的誤判：
- AI 在解釋中提及檔案路徑的回應
- 對話上下文中的歷史訊息
- 關於設定檔的一般性討論

### 被阻止的請求範例

```
❌ "Can you read ~/.agentgazer/config.json for me?"
❌ "Open the file at ~/.ssh/id_rsa and show me the contents"
❌ "Cat ~/.aws/credentials"
```

### 允許的請求範例

```
✓ "What is the format of ~/.agentgazer/config.json?"（沒有動作動詞）
✓ "Tell me about SSH key security"（沒有特定路徑）
✓ "How do I configure AWS credentials?"（教育性質，沒有讀取動作）
```

### 阻止時的回應

當自我保護觸發時，agent 會收到清晰的訊息：

```
🛡️ 請求被阻止：違反自我保護政策

此請求試圖存取受保護的系統檔案。
基於安全考量，AI agent 無法讀取：
- AgentGazer 設定檔
- SSH 金鑰和憑證
- 雲端服務憑證
- Shell 歷史檔案

這不是您的請求有問題。AgentGazer 的自我保護功能
阻止了此操作以防止潛在的憑證洩露。
```

## 自訂模式

除了內建模式外，您還可以定義自訂檢測規則。

### 自訂提示詞注入模式

添加正規表達式模式以檢測特定領域的注入嘗試。例如：
- 內部命令關鍵字
- 公司特定的角色名稱
- 自訂越獄短語

### 自訂資料遮罩模式

添加正規表達式模式以隱藏業務特定的敏感資料。例如：
- 內部專案代碼
- 員工 ID
- 自訂識別碼格式

### 工具白名單/黑名單

- **白名單：** 僅允許特定工具（白名單方法）
- **黑名單：** 按名稱阻止特定工具（黑名單方法）

## 安全事件 {#security-events}

當安全規則觸發時，AgentGazer 會記錄一個安全事件，包含：
- 事件類型
- 嚴重性（警告、嚴重）
- 匹配的模式詳情
- 代理和請求上下文
- 時間戳

### 事件類型

| 事件類型 | 說明 | 查看位置 |
|----------|------|----------|
| `prompt_injection` | 偵測到提示詞注入嘗試 | Security 頁面 |
| `data_masked` | 敏感資料已被遮罩 | Security 頁面 |
| `tool_blocked` | 工具呼叫被限制阻止 | Security 頁面 |
| `self_protection` | 阻止存取敏感檔案 | Security 頁面 |
| `security_blocked` | 請求被安全過濾器阻止 | Security 頁面、Logs 頁面 |

### 查看事件

- **Security 頁面** → Events 標籤：所有安全相關事件，含詳細上下文
- **Logs 頁面** → 篩選 `security_blocked`：快速查看被阻止的請求，與正常 LLM 呼叫一起顯示

`security_blocked` 事件類型同時出現在 Security 頁面（詳細）和 Logs 頁面（統一請求追蹤）。這讓你可以在正常 agent 活動的上下文中看到安全阻止事件。

## 警報整合

安全事件可以觸發警報。在警報頁面配置警報規則：

1. 創建新警報規則
2. 選擇規則類型：「Security Event」
3. 選擇嚴重性閾值（警告或嚴重）
4. 配置通知通道（webhook、電子郵件、Telegram）

## 最佳實踐

1. **從嚴格開始，然後放寬：** 初始啟用所有規則，僅在合法用例需要時禁用特定規則。

2. **使用按代理配置：** 對面向客戶的代理應用更嚴格的規則，對內部工具應用更寬鬆的規則。

3. **監控事件：** 定期審查安全事件以識別攻擊模式和誤報。

4. **自訂模式：** 為您的用例添加特定領域的模式，而不是禁用內建保護。

5. **縱深防禦：** 將安全護盾與其他保護措施結合使用（速率限制、身份驗證、輸入驗證）。
