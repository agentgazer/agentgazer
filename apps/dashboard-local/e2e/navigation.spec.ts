import { test, expect } from "@playwright/test";
import { loginViaStorage, waitForPageReady } from "./helpers";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page);
  });

  test("can navigate to all main pages", async ({ page }) => {
    // Overview (home)
    await page.goto("/");
    await waitForPageReady(page);

    // Agents
    await page.goto("/agents");
    await waitForPageReady(page);
    await expect(page).toHaveURL("/agents");

    // Providers
    await page.goto("/providers");
    await waitForPageReady(page);
    await expect(page).toHaveURL("/providers");

    // Costs
    await page.goto("/costs");
    await waitForPageReady(page);
    await expect(page).toHaveURL("/costs");

    // Alerts
    await page.goto("/alerts");
    await waitForPageReady(page);
    await expect(page).toHaveURL("/alerts");

    // Security
    await page.goto("/security");
    await waitForPageReady(page);
    await expect(page).toHaveURL("/security");

    // Logs/Events
    await page.goto("/events");
    await waitForPageReady(page);
    await expect(page).toHaveURL("/events");

    // Settings
    await page.goto("/settings");
    await waitForPageReady(page);
    await expect(page).toHaveURL("/settings");
  });

  test("sidebar shows active state", async ({ page }) => {
    await page.goto("/agents");
    await waitForPageReady(page);

    // The active link should have some visual indicator (bg-gray-700)
    const agentsLink = page.locator('a[href="/agents"]').first();
    await expect(agentsLink).toHaveClass(/bg-gray-700/);
  });
});
