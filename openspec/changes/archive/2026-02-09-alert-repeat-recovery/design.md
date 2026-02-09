## Context

現有 alert 系統使用 hardcoded 15 分鐘 cooldown，沒有狀態追蹤。需要更靈活的重複通知控制和恢復通知功能。

## Goals / Non-Goals

**Goals:**
- 可配置的重複通知間隔
- 一次性 vs 持續通知選項
- 恢復通知
- 明確的 alert state 追蹤
- CLI alert 管理命令

**Non-Goals:**
- Dashboard UI 更新（後續處理）
- Alert 升級機制（escalation）

## Decisions

### 1. Alert State Machine

```
NORMAL ──(條件符合)──▶ ALERTING ──(條件恢復)──▶ NORMAL
                          │                        ▲
                          │ (一次性通知)            │
                          ▼                        │
                       FIRED ────(條件恢復)────────┘
```

三種狀態：
- `normal`: 正常狀態，等待觸發
- `alerting`: 持續通知中，每 N 分鐘發送
- `fired`: 一次性已發送，等待恢復

### 2. Schema 變更

```sql
ALTER TABLE alert_rules ADD COLUMN repeat_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE alert_rules ADD COLUMN repeat_interval_minutes INTEGER NOT NULL DEFAULT 15;
ALTER TABLE alert_rules ADD COLUMN recovery_notify INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alert_rules ADD COLUMN state TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE alert_rules ADD COLUMN last_triggered_at TEXT;
ALTER TABLE alert_rules ADD COLUMN budget_period TEXT;
```

### 3. 各 Alert Type 恢復條件

| Type | 恢復條件 | deactive 時 |
|------|---------|-------------|
| agent_down | 收到心跳 | 不評估 |
| error_rate | 錯誤率 ≤ 門檻 | 不評估 |
| budget | 手動 reset 或新週期開始 | 不評估 |
| kill_switch | agent re-activate | 已被關閉 |

### 4. CLI 命令結構

```bash
agentgazer agent <name> alerts              # 列出
agentgazer agent <name> alert add <type>    # 新增
agentgazer agent <name> alert delete <id>   # 刪除
agentgazer agent <name> alert reset <id>    # 重置狀態
```

### 5. 評估邏輯變更

```
for each rule:
  if agent is inactive and type != kill_switch:
    skip

  condition_met = evaluate_condition(rule)

  if condition_met:
    if state == 'normal':
      send_alert()
      state = 'alerting' if repeat_enabled else 'fired'
      last_triggered_at = now
    elif state == 'alerting' and repeat_enabled:
      if now - last_triggered_at >= repeat_interval:
        send_alert()
        last_triggered_at = now
  else:  # condition recovered
    if state in ('alerting', 'fired'):
      if recovery_notify:
        send_recovery_notification()
      state = 'normal'
```

## Risks / Trade-offs

**[Risk] Migration** → 既有 rules 預設 repeat_enabled=1, state='normal'，行為與現有相同

**[Trade-off] Budget reset** → 需要手動 reset 或設定週期，增加複雜度但提供彈性
