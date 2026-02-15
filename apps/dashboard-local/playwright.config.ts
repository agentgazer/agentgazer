import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Auto-load token from config if not set
function getTestToken(): string | undefined {
  if (process.env.TEST_TOKEN) {
    return process.env.TEST_TOKEN;
  }

  // Try to read from AgentGazer config
  const configPath = join(homedir(), ".agentgazer", "config.json");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      return config.token;
    } catch {
      // Ignore errors
    }
  }

  return undefined;
}

// Set TEST_TOKEN for all tests
process.env.TEST_TOKEN = getTestToken();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:18880",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Don't start webServer - assume agentgazer is already running
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:18880",
  //   reuseExistingServer: !process.env.CI,
  // },
});
