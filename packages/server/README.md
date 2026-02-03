# @agenttrace/server

Local AgentTrace server — Express API backed by SQLite. Receives events from the SDK and proxy, stores them locally, and serves the dashboard API.

## Install

```bash
npm install @agenttrace/server
```

## Programmatic usage

```typescript
import { startServer } from "@agenttrace/server";

const { app, cleanup } = await startServer({
  port: 3274,
  dbPath: "~/.agenttrace/data.db",
  bearerToken: "your-token",
});
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/events` | Ingest agent events |
| GET | `/api/agents` | List known agents |
| GET | `/api/events` | Query events (with filters) |
| GET | `/api/stats` | Aggregated statistics |
| GET | `/api/health` | Health check |

## License

Apache-2.0 — see [LICENSE](./LICENSE).

Part of the [AgentTrace](https://github.com/agenttrace/agenttrace) monorepo.
