## ADDED Requirements

### Requirement: Agent ID is clickable link
Agent ID 欄位 SHALL 為可點擊連結，點擊後導航至該 agent 的詳細頁面。

#### Scenario: Click agent ID navigates to detail
- **WHEN** 使用者點擊 Agent ID
- **THEN** 頁面導航至 `/agents/{agent_id}` 詳細頁

### Requirement: Active toggle in list
Agents 列表 SHALL 顯示 Active toggle，允許直接切換 agent 的 active 狀態。

#### Scenario: Toggle agent active state
- **WHEN** 使用者點擊 Active toggle
- **THEN** 系統呼叫 API 更新 agent 的 active 狀態
- **AND** toggle 狀態即時反映新狀態

### Requirement: Display total tokens
Agents 列表 SHALL 顯示每個 agent 的總 token 用量（tokens_total 加總）。

#### Scenario: Show total tokens column
- **WHEN** Agents 列表載入
- **THEN** 顯示 Total Tokens 欄位，數值為該 agent 所有事件的 tokens_total 加總

### Requirement: Display total cost
Agents 列表 SHALL 顯示每個 agent 的累計總成本。

#### Scenario: Show total cost column
- **WHEN** Agents 列表載入
- **THEN** 顯示 Total Cost 欄位，格式為 $X.XX

### Requirement: Display today cost
Agents 列表 SHALL 顯示每個 agent 今日的成本。

#### Scenario: Show today cost column
- **WHEN** Agents 列表載入
- **THEN** 顯示 Today Cost 欄位，計算當日 UTC 00:00 至今的 cost_usd 加總

## REMOVED Requirements

### Requirement: Status badge display
**Reason**: status 欄位無法可靠計算，移除以簡化資料模型
**Migration**: 使用 Last Activity 時間判斷 agent 活動狀態

### Requirement: Status filter
**Reason**: 隨 status 欄位一起移除
**Migration**: 無替代方案，不再支援依狀態篩選

### Requirement: Actions column with View Details link
**Reason**: Agent ID 已改為可點擊連結，Actions 欄位變得多餘
**Migration**: 點擊 Agent ID 進入詳細頁
