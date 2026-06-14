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
  const artifactHrefs = Array.from(
    new Set(
      [...runHtml.matchAll(/\/api\/artifacts\/[^"?\\]+/g)].map(
        (match) => match[0],
      ),
    ),
  );

  expect(artifactHrefs.length).toBeGreaterThan(0);

  const artifactResponses = await Promise.all(
    artifactHrefs.map(async (href) => request.get(href)),
  );
  const screenshotResponse = artifactResponses.find((response) =>
    response.headers()["content-type"]?.includes("image/"),
  );

  expect(screenshotResponse?.ok()).toBe(true);
});
