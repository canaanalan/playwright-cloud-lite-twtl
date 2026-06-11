import { ArtifactType, PrismaClient, RunStatus, TestStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_RUN_ID = "sample-run-checkout-184";

async function main() {
  await prisma.run.deleteMany({
    where: {
      id: SAMPLE_RUN_ID,
    },
  });

  const startedAt = new Date("2026-06-10T15:04:00.000Z");
  const endedAt = new Date(startedAt.getTime() + 184_230);

  const run = await prisma.run.create({
    data: {
      id: SAMPLE_RUN_ID,
      projectName: "checkout-service-playwright",
      status: RunStatus.FAILED,
      branch: "main",
      commitSha: "8f4c2a1",
      ciProvider: "GitHub Actions",
      ciRunUrl: "https://github.com/example/checkout-service/actions/runs/184",
      startedAt,
      endedAt,
      durationMs: 184_230,
      passedCount: 42,
      failedCount: 2,
      skippedCount: 1,
      retriedCount: 3,
      tests: {
        create: [
          {
            title: "checkout applies discount code before payment",
            file: "tests/checkout/discount-code.spec.ts",
            browserName: "chromium",
            status: TestStatus.FAILED,
            durationMs: 28_400,
            retryCount: 1,
            errorMessage: "Expected discount total to be $72.00, received $80.00.",
            attempts: {
              create: [
                {
                  attemptIndex: 0,
                  status: TestStatus.FAILED,
                  durationMs: 14_600,
                  errorMessage: "Expected discount total to be $72.00, received $80.00.",
                  startedAt,
                },
                {
                  attemptIndex: 1,
                  status: TestStatus.FAILED,
                  durationMs: 13_800,
                  errorMessage: "Discount banner did not appear after applying code.",
                  startedAt: new Date(startedAt.getTime() + 14_800),
                },
              ],
            },
            artifacts: {
              create: [
                {
                  type: ArtifactType.SCREENSHOT,
                  label: "Failure screenshot",
                  path: "/artifacts/run-184/discount-code-failure.svg",
                },
                {
                  type: ArtifactType.TRACE,
                  label: "Playwright trace",
                  path: "/artifacts/run-184/discount-code-trace.zip",
                },
              ],
            },
          },
          {
            title: "guest checkout shows validation error for expired card",
            file: "tests/checkout/payment-validation.spec.ts",
            browserName: "webkit",
            status: TestStatus.FAILED,
            durationMs: 33_750,
            retryCount: 2,
            errorMessage: "Validation API returned 500 while checking expired card.",
            attempts: {
              create: [
                {
                  attemptIndex: 0,
                  status: TestStatus.TIMED_OUT,
                  durationMs: 15_000,
                  errorMessage: "Timed out waiting for card validation error.",
                  startedAt: new Date(startedAt.getTime() + 32_000),
                },
                {
                  attemptIndex: 1,
                  status: TestStatus.FAILED,
                  durationMs: 9_300,
                  errorMessage: "Expected expired card error text to be visible.",
                  startedAt: new Date(startedAt.getTime() + 47_500),
                },
                {
                  attemptIndex: 2,
                  status: TestStatus.FAILED,
                  durationMs: 9_450,
                  errorMessage: "Validation API returned 500.",
                  startedAt: new Date(startedAt.getTime() + 57_200),
                },
              ],
            },
            artifacts: {
              create: [
                {
                  type: ArtifactType.VIDEO,
                  label: "Retry video",
                  path: "/artifacts/run-184/expired-card.webm",
                },
                {
                  type: ArtifactType.TRACE,
                  label: "Playwright trace",
                  path: "/artifacts/run-184/expired-card-trace.zip",
                },
              ],
            },
          },
          {
            title: "logged-in user can complete checkout with saved card",
            file: "tests/checkout/saved-card.spec.ts",
            browserName: "chromium",
            status: TestStatus.PASSED,
            durationMs: 12_100,
          },
          {
            title: "cart persists after refresh",
            file: "tests/cart/persistence.spec.ts",
            browserName: "firefox",
            status: TestStatus.FLAKY,
            durationMs: 19_200,
            retryCount: 1,
            isFlaky: true,
            errorMessage: "First attempt failed because cart item count reset after reload.",
            attempts: {
              create: [
                {
                  attemptIndex: 0,
                  status: TestStatus.FAILED,
                  durationMs: 10_100,
                  errorMessage: "Cart item count reset after reload.",
                  startedAt: new Date(startedAt.getTime() + 78_000),
                },
                {
                  attemptIndex: 1,
                  status: TestStatus.PASSED,
                  durationMs: 9_100,
                  startedAt: new Date(startedAt.getTime() + 88_300),
                },
              ],
            },
            artifacts: {
              create: [
                {
                  type: ArtifactType.SCREENSHOT,
                  label: "Flake screenshot",
                  path: "/artifacts/run-184/cart-refresh-flake.svg",
                },
              ],
            },
          },
          {
            title: "checkout page meets basic accessibility expectations",
            file: "tests/checkout/accessibility.spec.ts",
            browserName: "chromium",
            status: TestStatus.SKIPPED,
            durationMs: 0,
          },
        ],
      },
    },
    include: {
      tests: {
        include: {
          attempts: true,
          artifacts: true,
        },
      },
    },
  });

  console.log(
    `Seeded ${run.projectName} with ${run.tests.length} tests, ${run.failedCount} failures, and ${run.retriedCount} retries.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
