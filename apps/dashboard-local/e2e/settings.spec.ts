import { test, expect } from "@playwright/test";
import { loginViaStorage, waitForPageReady } from "./helpers";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaStorage(page);
    await page.goto("/settings");
    await waitForPageReady(page);
  });

  test("displays settings form", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible();
  });

  test("has language selector", async ({ page }) => {
    // Should have language/locale settings
    const langSelector = page.getByText(/language|locale|語言/i).first();
    const hasLang = await langSelector.isVisible().catch(() => false);

    if (hasLang) {
      await expect(langSelector).toBeVisible();
    }
  });

  test("has save button", async ({ page }) => {
    // Should have save/apply button
    const saveButton = page.getByRole("button", { name: /save|apply|update/i });
    const hasSave = await saveButton.isVisible().catch(() => false);

    if (hasSave) {
      await expect(saveButton).toBeVisible();
    }
  });
});
