# Docker Deployment

## Quick Start

The fastest way to run AgentGazer:

```bash
docker pull ghcr.io/agentgazer/agentgazer
docker run -d \
  --name agentgazer \
  -p 8080:8080 \
  -p 4000:4000 \
  -v agentgazer-data:/app/data \
  ghcr.io/agentgazer/agentgazer
```

Then open http://localhost:8080 in your browser.

## Using Docker Compose

For easier management, use Docker Compose:

```bash
# Download the example file
curl -O https://raw.githubusercontent.com/agentgazer/agentgazer/main/docker-compose.example.yml

# Start the service
docker compose -f docker-compose.example.yml up -d
```

Or create your own `docker-compose.yml`:

```yaml
services:
  agentgazer:
    image: ghcr.io/agentgazer/agentgazer:latest
    ports:
      - "8080:8080"  # Dashboard + API
      - "4000:4000"  # LLM Proxy
    volumes:
      - agentgazer-data:/app/data
    restart: unless-stopped

volumes:
  agentgazer-data:
```

## Port Mapping

| Port | Service |
|------|---------|
| 8080 | Dashboard + REST API |
| 4000 | LLM Proxy |

## Data Persistence

Docker uses an `agentgazer-data` volume to persist the `~/.agentgazer/` directory, ensuring the SQLite database, configuration files, and encrypted keystore are retained across container restarts.

## Image Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `1.0.0` | Specific version |
| `1.0` | Latest patch of minor version |

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

```yaml
services:
  agentgazer:
    image: ghcr.io/agentgazer/agentgazer:latest
    ports:
      - "8080:8080"
      - "4000:4000"
    volumes:
      - agentgazer-data:/app/data
    environment:
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_USER=your-email@gmail.com
      - SMTP_PASS=your-app-password
      - SMTP_FROM=alerts@your-domain.com
```

## Building from Source

If you need to build the image locally:

```bash
git clone https://github.com/agentgazer/agentgazer.git
cd agentgazer
docker compose up -d
```

This uses the `Dockerfile` in the repository to build from source.
