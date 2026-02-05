# Dashboard

## Login

The dashboard uses **Token authentication**. After starting the service, enter your authentication Token on the login page. Token sources:

- Generated on first run of `agenttrace onboard`
- Stored in `~/.agenttrace/config.json`
- Can be regenerated via `agenttrace reset-token`

## Page Overview

| Page | Description |
|------|-------------|
| **Overview** | Key metrics overview across all Agents |
| **Agents** (Agent List) | List of all Agents with status indicators (healthy / degraded / down), with search, filtering, and pagination |
| **Agent Detail** | Detailed statistics and charts for a single Agent |
| **Costs** | Cost analysis and charts by Provider / Model |
| **Alerts** | Alert rule management and alert history |

## Agent Detail Page

The Agent detail page provides the following information:

**Stats Cards**

| Metric | Description |
|--------|-------------|
| Total Requests | Total number of requests |
| Total Errors | Number of errors |
| Error Rate | Error rate percentage |
| Total Cost | Total spend (USD) |
| Tokens Used | Total token usage |
| P50 Latency | Median latency (milliseconds) |
| P99 Latency | 99th percentile latency (milliseconds) |

**Charts** (rendered with Recharts)

- Token usage trend chart (Input / Output tokens over time)
- Cost breakdown chart (by Provider / Model)

**Time Range Filter**

Supports the following preset ranges:

- 1 hour (1h)
- 24 hours (24h)
- 7 days (7d)
- 30 days (30d)

## Cost Analysis

The cost page provides aggregated spend across Providers and Models:

- Cost trend chart
- Cost breakdown by Provider
- Cost breakdown by Model
