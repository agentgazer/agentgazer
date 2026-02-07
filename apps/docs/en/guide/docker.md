# Deployment

## Using Docker Compose

```bash
docker compose up -d
```

## Port Mapping

| Port | Service |
|------|---------|
| 8080 | Dashboard + REST API |
| 4000 | LLM Proxy |

## Data Persistence

Docker uses an `agentgazer-data` volume to persist the `~/.agentgazer/` directory, ensuring the SQLite database, configuration files, and encrypted keystore are retained across container restarts.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | When set to `production`, uses JSON-formatted logs | — |
| `LOG_LEVEL` | Log level: `debug` / `info` / `warn` / `error` | `info` |
| `SMTP_HOST` | SMTP server address | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender email address | `alerts@agentgazer.com` |
| `SMTP_SECURE` | Whether to use TLS | `false` |
| `AGENTGAZER_SECRET_BACKEND` | Manually specify the keystore backend | Auto-detected |

### Email Alert Configuration Example

To enable email alerts, configure the SMTP environment variables:

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
export SMTP_FROM=alerts@your-domain.com
export SMTP_SECURE=false
```
