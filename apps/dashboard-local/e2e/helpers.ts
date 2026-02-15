import { Page, expect } from "@playwright/test";

/**
 * Login to the dashboard with the test token
 */
export async function login(page: Page): Promise<void> {
  const token = process.env.TEST_TOKEN;
  if (!token) {
    throw new Error("TEST_TOKEN environment variable is required. Run: export TEST_TOKEN=$(cat ~/.agentgazer/config.json | jq -r .token)");
  }

  await page.goto("/login");
  await page.getByLabel(/token/i).fill(token);
  await page.getByRole("button", { name: /login|sign in|submit/i }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Login via localStorage (faster, no network request)
 */
export async function loginViaStorage(page: Page): Promise<void> {
  const token = process.env.TEST_TOKEN;
  if (!token) {
    throw new Error("TEST_TOKEN environment variable is required");
  }

  // Set token before navigating (use the correct key name)
  await page.goto("/login");
  await page.evaluate((t) => {
    localStorage.setItem("agentgazer_token", t);
  }, token);
  await page.goto("/");

  // Wait for the main content to be visible (layout loaded)
  await page.waitForSelector("main", { timeout: 10000 });
}

/**
 * Wait for page content to be ready
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("main", { timeout: 10000 });
}
