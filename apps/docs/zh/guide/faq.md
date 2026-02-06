# 常見問題排除

## 事件沒有出現在儀表板

1. **檢查 Token 是否正確**：確認 SDK 或 Proxy 使用的 Token 與 `~/.agentgazer/config.json` 中的一致
2. **檢查端點設定**：確認 endpoint 指向 `http://localhost:8080/api/events`
3. **確認 Buffer 已 Flush**：事件可能還在 buffer 中。呼叫 `at.shutdown()` 強制送出，或等待 5 秒的自動 flush 週期
4. **查看 console 警告**：SDK 的網路錯誤不會拋出例外，但會在 console 記錄 warning

## Proxy 無法偵測 Provider

1. **使用路徑前綴路由**：這是最可靠的方式。例如將 base URL 設為 `http://localhost:4000/openai/v1`
2. **使用 x-target-url**：在請求中加入 `x-target-url` header 明確指定目標
3. **檢查 Provider 偵測順序**：路徑前綴 → Host header → 路徑模式 → x-target-url
4. **查看 Proxy 日誌**：Proxy 會在 console 輸出偵測結果與警告訊息

## 收到 429 Too Many Requests

1. **速率限制**：每分鐘最多 1000 個事件
2. **增加 Buffer 大小**：增大 `maxBufferSize` 可以減少 flush 次數
3. **查看 Retry-After**：回應 header 中的 `Retry-After` 會告訴你需要等待多少秒

## Agent 狀態顯示為 "unknown"

1. **確認有發送心跳**：使用 `at.heartbeat()` 定期發送心跳（建議每 30 秒一次）
2. **超時判定**：超過 10 分鐘未收到心跳，Agent 會被標記為 "down"

## 儀表板登入失敗

1. **確認 Token**：查看 `~/.agentgazer/config.json` 中的 Token
2. **重新產生 Token**：執行 `agentgazer reset-token` 產生新的 Token
3. **確認伺服器已啟動**：執行 `agentgazer doctor` 檢查伺服器狀態

## 成本計算不正確

1. **確認模型名稱**：成本計算依賴 `@agentgazer/shared` 中的定價表，模型名稱查詢不區分大小寫（例如 `GPT-4o` 和 `gpt-4o` 皆可匹配）
2. **負數 token 值**：若傳入負數的 token 數量，成本計算會回傳 `null`
3. **手動指定 cost_usd**：如果自動計算不準確，可在 `track()` 中手動傳入 `cost_usd` 欄位

## 連接埠衝突

如果預設連接埠已被佔用，可使用自訂連接埠啟動：

```bash
agentgazer start --port 9090 --proxy-port 5000
```

## 資料庫問題

SQLite 資料庫位於 `~/.agentgazer/data.db`。如需重置：

```bash
# 停止服務後刪除資料庫檔案
rm ~/.agentgazer/data.db

# 重新啟動，系統會自動建立新的資料庫
agentgazer start
```
