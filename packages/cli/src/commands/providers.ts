import { apiGet, handleApiError } from "../utils/api.js";
import { formatCurrency } from "../utils/format.js";

interface ProviderRecord {
  name: string;
  active: boolean;
  configured: boolean;
  authType?: "oauth" | "apikey";
  total_cost?: number;
  today_cost?: number;
  total_tokens?: number;
  agent_count?: number;
}

interface ProvidersResponse {
  providers: ProviderRecord[];
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export async function cmdProviders(port: number = 18880): Promise<void> {
  try {
    const resp = await apiGet<ProvidersResponse>("/api/providers", port);
    const providers = resp.providers;

    if (!providers || providers.length === 0) {
      console.log("\n  No providers configured. Use 'agentgazer provider add' to add one.\n");
      return;
    }

    const c = colors;

    console.log(`
${c.bold}  AgentGazer — Providers${c.reset}
  ───────────────────────────────────────────────────────────────
`);

    // Header
    const header = `  ${"Provider".padEnd(14)}${"Status".padEnd(12)}${"Auth".padEnd(14)}${"Tokens".padStart(10)}  ${"Today".padStart(8)}  ${"Total".padStart(8)}`;
    console.log(`${c.dim}${header}${c.reset}`);
    console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);

    for (const p of providers) {
      const name = p.name.padEnd(14);
      const isOAuth = p.authType === "oauth";

      // Status with color
      let status: string;
      if (!p.active) {
        status = `${c.gray}inactive${c.reset}`.padEnd(12 + 9); // Account for ANSI codes
      } else {
        status = `${c.green}● active${c.reset}`.padEnd(12 + 9);
      }

      // Auth status with icon (different display for OAuth vs API Key)
      let authStatus: string;
      if (p.configured) {
        if (isOAuth) {
          authStatus = `${c.green}✓ OAuth${c.reset}`.padEnd(14 + 9);
        } else {
          authStatus = `${c.green}✓ API Key${c.reset}`.padEnd(14 + 9);
        }
      } else {
        if (isOAuth) {
          authStatus = `${c.yellow}○ login${c.reset}`.padEnd(14 + 9);
        } else {
          authStatus = `${c.yellow}○ not set${c.reset}`.padEnd(14 + 9);
        }
      }

      const tokens = formatTokens(p.total_tokens ?? 0).padStart(10);
      const todayCost = formatCurrency(p.today_cost ?? 0).padStart(8);
      const totalCost = formatCurrency(p.total_cost ?? 0).padStart(8);

      console.log(`  ${c.cyan}${name}${c.reset}${status}${authStatus}${c.dim}${tokens}${c.reset}  ${todayCost}  ${c.bold}${totalCost}${c.reset}`);
    }

    // Summary
    const totalCostSum = providers.reduce((sum, p) => sum + (p.total_cost ?? 0), 0);
    const todayCostSum = providers.reduce((sum, p) => sum + (p.today_cost ?? 0), 0);
    const configuredCount = providers.filter(p => p.configured).length;

    console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);
    console.log(`  ${c.dim}${configuredCount}/${providers.length} configured${c.reset}                                    ${formatCurrency(todayCostSum).padStart(8)}  ${c.bold}${formatCurrency(totalCostSum).padStart(8)}${c.reset}`);
    console.log(`
  ${c.dim}Commands:${c.reset}
    agentgazer provider add <name>      Add API key
    agentgazer login <provider>         Login via OAuth (e.g., openai-oauth)
    agentgazer provider <name> stat     View statistics
    agentgazer provider <name> models   List available models
`);
  } catch (err) {
    handleApiError(err);
  }
}
