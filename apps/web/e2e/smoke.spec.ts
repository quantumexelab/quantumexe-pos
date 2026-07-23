import { expect, test } from "@playwright/test";

test("login -> dashboard -> pos sale smoke", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Username").fill("0771234567");
  await page.getByLabel("Password").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("System Overview")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "POS" }).click();
  await expect(page.getByText("Point of Sale")).toBeVisible();

  const product = page.locator("button").filter({ hasText: "Rs." }).first();
  await product.click();
  await page.getByRole("button", { name: "Complete Sale" }).click();
  await expect(page.getByText(/Invoice .* created/i)).toBeVisible({ timeout: 15000 });
});
