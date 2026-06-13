import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizePlaywrightJsonReport } from "@/lib/normalize-playwright-json";
import { materializeArtifacts } from "./materialize-artifacts";

const DEFAULT_ENDPOINT = "http://localhost:3017/api/runs/upload";
const endpoint =
  process.env.PLAYWRIGHT_CLOUD_LITE_UPLOAD_URL ?? DEFAULT_ENDPOINT;

async function main() {
  const reportPath = process.argv[2];

  if (!reportPath) {
    console.error("Usage: npm run upload:playwright -- path/to/results.json");
    process.exit(1);
  }

  const rawReport = JSON.parse(await readFile(resolve(reportPath), "utf8"));
  const normalizedPayload = normalizePlaywrightJsonReport(rawReport, {
    runId: process.env.PLAYWRIGHT_CLOUD_LITE_RUN_ID,
    projectName: process.env.PLAYWRIGHT_CLOUD_LITE_PROJECT_NAME,
    branch: process.env.GITHUB_REF_NAME,
    commitSha: process.env.GITHUB_SHA,
    ciProvider: process.env.GITHUB_ACTIONS ? "GitHub Actions" : undefined,
    ciRunUrl:
      process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined,
  });
  const { payload, copiedCount, missingCount } =
    await materializeArtifacts(normalizedPayload);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Upload failed", {
      endpoint,
      reportPath,
      responseBody,
      status: response.status,
    });
    process.exit(1);
  }

  console.log("Uploaded Playwright JSON report", {
    endpoint,
    reportPath,
    artifacts: {
      copied: copiedCount,
      missing: missingCount,
    },
    responseBody,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
