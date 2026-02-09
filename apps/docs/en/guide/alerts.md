# Alerts

## Alert Rule Types

| Type | Description | Configurable Parameters | Default |
|------|-------------|------------------------|---------|
| **agent_down** | Agent has not sent a heartbeat for an extended period | `duration_minutes`: minutes before considered down | 10 minutes |
| **error_rate** | Error rate exceeds threshold | `threshold`: percentage; `window_minutes`: rolling window | 20%, 5 minutes |
| **budget** | Daily spend exceeds budget | `threshold`: amount limit in USD | — |
| **kill_switch** | Agent was auto-deactivated by Kill Switch loop detection | — (triggered automatically) | — |

::: tip Kill Switch Alerts
Kill Switch alerts are generated automatically when an agent is deactivated due to detected infinite loops. Unlike other alert types, you don't configure a "kill_switch" alert rule — instead, enable Kill Switch on the agent and configure your notification channels (webhook/email) to receive deactivation alerts.

See [Kill Switch](/en/guide/kill-switch) for details on loop detection configuration.
:::

## Notification Channels

Each alert rule can be configured with the following notification methods:

**Webhook**

- Sends a JSON payload via POST to a specified URL
- Automatically retries up to 3 times on failure with exponential backoff (1s, 4s, 16s)

**Email (SMTP)**

- Sends alert notifications via an SMTP server
- Requires SMTP environment variables to be configured (see the [Deployment](/en/guide/docker) section)

**Telegram**

- Sends alert notifications via Telegram Bot API
- Requires `bot_token` and `chat_id` configuration
- Can be configured per-rule or as defaults in Settings

## Cooldown Mechanism

After a rule fires, it enters a **15-minute** cooldown period during which the same rule will not fire again. This prevents alert fatigue.

## Repeat Alerts

Enable repeat alerts to receive ongoing notifications while an issue persists:

| Setting | Description |
|---------|-------------|
| **repeat_enabled** | When `true`, alert will re-fire at the specified interval while condition remains |
| **repeat_interval_minutes** | How often to re-send the alert (default: 60 minutes) |

## Recovery Notifications

Enable recovery notifications to be notified when an issue is resolved:

| Setting | Description |
|---------|-------------|
| **recovery_notify** | When `true`, sends a notification when the alert condition clears |

The alert state machine tracks: `normal` → `alerting` → `normal`. A recovery notification is sent when transitioning from `alerting` back to `normal`.

## Budget Periods

For budget alerts, you can configure the budget period:

| Period | Description |
|--------|-------------|
| **daily** | Budget resets at midnight UTC each day (default) |
| **weekly** | Budget resets at midnight UTC each Monday |
| **monthly** | Budget resets at midnight UTC on the 1st of each month |

## Management Methods

Alert rules can be managed in two ways:

1. **Dashboard UI**: Create, edit, enable/disable, and delete rules on the Alerts page, and view alert history
2. **REST API**: Manage programmatically via the `/api/alerts` endpoint (see the [API Reference](/en/reference/api) section)

## Creating Alert Rules (Dashboard)

1. Navigate to the Alerts page
2. Click "New Alert Rule"
3. Select the target Agent
4. Choose the rule type (agent_down / error_rate / budget)
5. Configure the relevant parameters
6. Enter a Webhook URL and/or Email address
7. Save the rule

## Alert History

Switch to the "History" tab to view all triggered alert records, including trigger time, target Agent, rule type, alert message, and delivery method.
