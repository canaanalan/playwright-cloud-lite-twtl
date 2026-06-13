import { expect, test } from "@playwright/test";

test("intentional failure captures screenshot and trace artifacts", async ({
  page,
}) => {
  await page.goto("/runs/sample-run-checkout-184");

  await expect(page.getByRole("heading", { name: "Run history" })).toBeVisible();
});
