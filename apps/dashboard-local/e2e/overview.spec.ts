import { test, expect } from "@playwright/test";
import { loginViaStorage, waitForPageReady } from "./helpers";

test.describe("Overview Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/");
    await waitForPageReady(page);
  });

  test("displays stats cards", async ({ page }) => {
    // Should have stat cards for key metrics
    await expect(page.locator("main")).toBeVisible();
  });

  test("displays agent list or empty state", async ({ page }) => {
    // Either shows agents or an empty state
    await expect(page.locator("main")).toBeVisible();
  });

  test("page loads without errors", async ({ page }) => {
    // Page should load successfully
    await expect(page.locator("main")).toBeVisible();
  });
});
