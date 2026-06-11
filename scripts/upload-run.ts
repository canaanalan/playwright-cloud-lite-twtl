import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_FIXTURE_PATH = "fixtures/playwright-run.sample.json";
const DEFAULT_ENDPOINT = "http://localhost:3017/api/runs/upload";

const endpoint =
  process.env.PLAYWRIGHT_CLOUD_LITE_UPLOAD_URL ?? DEFAULT_ENDPOINT;

async function main() {
  const payloadPath = resolve(process.argv[2] ?? DEFAULT_FIXTURE_PATH);
  const payload = await readFile(payloadPath, "utf8");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: payload,
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Upload failed", {
      endpoint,
      payloadPath,
      status: response.status,
      responseBody,
    });
    process.exit(1);
  }

  console.log("Uploaded run", {
    endpoint,
    payloadPath,
    responseBody,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
