import { expect, test } from "@playwright/test";

test("dashboard shows uploaded Playwright runs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Run history" })).toBeVisible();
  await expect(page.getByText("checkout-service-playwright").first()).toBeVisible();
  await expect(page.getByText("Failed runs")).toBeVisible();
  await expect(page.getByText("Flaky candidates")).toBeVisible();
});

test("run detail exposes failures, retries, and artifacts", async ({ page }) => {
  await page.goto("/runs/sample-run-checkout-184");

  await expect(
    page.getByRole("heading", { name: "checkout-service-playwright" }),
  ).toBeVisible();
  await expect(page.getByText("Failures and flaky candidates")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "checkout applies discount code before payment",
    }),
  ).toBeVisible();
  await expect(page.getByText("Attempt 1").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Failure screenshot/ })).toBeVisible();
});

test("artifact API serves a screenshot artifact", async ({ request }) => {
  const runResponse = await request.get("/runs/sample-run-checkout-184");
  const runHtml = await runResponse.text();
  const artifactHref = runHtml.match(
    /href="(\/api\/artifacts\/[^"]+)"[^>]*>Failure screenshot/,
  )?.[1];

  expect(artifactHref).toBeTruthy();

  const artifactResponse = await request.get(artifactHref as string);

  expect(artifactResponse.ok()).toBe(true);
  expect(artifactResponse.headers()["content-type"]).toContain("image/svg+xml");
});
