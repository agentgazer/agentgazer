import { apiGet, handleApiError } from "../utils/api.js";
import { formatNumber, formatCurrency } from "../utils/format.js";

interface ProviderRecord {
  name: string;
  active: boolean;
  key_status: "secured" | "not_set";
  total_calls?: number;
  total_cost?: number;
}

interface ProvidersResponse {
  providers: ProviderRecord[];
}

export async function cmdProviders(port: number = 8080): Promise<void> {
  try {
    const resp = await apiGet<ProvidersResponse>("/api/providers", port);
    const providers = resp.providers;

    if (!providers || providers.length === 0) {
      console.log("No providers configured. Use 'agentgazer provider add' to add one.");
      return;
    }

    const header = `  ${"Provider".padEnd(12)}${"Status".padEnd(10)}${"Key".padEnd(12)}${"Calls".padStart(8)}   Cost`;
    console.log(header);
    console.log("  " + "─".repeat(header.trimStart().length));

    for (const p of providers) {
      const name = p.name.padEnd(12);
      const status = (p.active ? "active" : "inactive").padEnd(10);
      const keyStatus = (p.key_status === "secured" ? "secured" : "not set").padEnd(12);
      const calls = formatNumber(p.total_calls ?? 0).padStart(8);
      const cost = formatCurrency(p.total_cost ?? 0);
      console.log(`  ${name}${status}${keyStatus}${calls}   ${cost}`);
    }
  } catch (err) {
    handleApiError(err);
  }
}
