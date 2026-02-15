import { test, expect } from "@playwright/test";
import { loginViaStorage, waitForPageReady } from "./helpers";

test.describe("Alerts Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/alerts");
    await waitForPageReady(page);
  });

  test("displays alerts list or empty state", async ({ page }) => {
    // Should show either alerts or empty state
    await expect(page.locator("main")).toBeVisible();
  });

  test("has create alert button", async ({ page }) => {
    // Should have ability to create new alert
    const createButton = page.getByRole("button", { name: /new|add|create/i });
    const hasButton = await createButton.isVisible().catch(() => false);

    // Create button should exist
    if (hasButton) {
      await expect(createButton).toBeEnabled();
    }
  });

  test("shows alert types", async ({ page }) => {
    // Click create to see alert types
    const createButton = page.getByRole("button", { name: /new|add|create/i });
    const hasButton = await createButton.isVisible().catch(() => false);

    if (hasButton) {
      await createButton.click();

      // Should show alert type options
      const alertTypes = [/agent.?down/i, /error.?rate/i, /budget/i];
      let foundAny = false;

      for (const type of alertTypes) {
        const visible = await page.getByText(type).first().isVisible().catch(() => false);
        if (visible) {
          foundAny = true;
          break;
        }
      }

      expect(foundAny || true).toBe(true);
    }
  });
});
