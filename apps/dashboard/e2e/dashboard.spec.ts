import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/agents");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("login with invalid credentials shows error or stays on login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "invalid@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should either show an error or remain on login page
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain("/login");
  });
});

test.describe("Dashboard (authenticated)", () => {
  // These tests require a test user to be seeded in the database.
  // Set TEST_EMAIL and TEST_PASSWORD env vars, or skip in CI without a test DB.
  const testEmail = process.env.TEST_EMAIL;
  const testPassword = process.env.TEST_PASSWORD;

  test.skip(!testEmail || !testPassword, "Requires TEST_EMAIL and TEST_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', testEmail!);
    await page.fill('input[type="password"]', testPassword!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/^(?!.*\/login)/);
  });

  test("dashboard home loads after login", async ({ page }) => {
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("agents page shows agent list or empty state", async ({ page }) => {
    await page.goto("/agents");
    // Either shows agents or the empty state message
    const content = await page.textContent("body");
    expect(
      content?.includes("Agents") || content?.includes("No agents yet")
    ).toBeTruthy();
  });

  test("alerts page loads", async ({ page }) => {
    await page.goto("/alerts");
    const content = await page.textContent("body");
    expect(content?.includes("Alert")).toBeTruthy();
  });

  test("API keys page loads", async ({ page }) => {
    await page.goto("/keys");
    const content = await page.textContent("body");
    expect(content?.includes("API Key")).toBeTruthy();
  });

  test("costs page loads", async ({ page }) => {
    await page.goto("/costs");
    const content = await page.textContent("body");
    expect(content?.includes("Cost")).toBeTruthy();
  });
});
