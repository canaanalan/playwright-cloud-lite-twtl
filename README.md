# Playwright Cloud Lite

A lightweight Playwright test observability dashboard for debugging runs, retries, flaky tests, and artifacts.

This is a work in progress, but the current MVP already supports the core loop: ingest test results, store them as structured run data, and make failures easier to investigate.

## Why I Built This

Most QA portfolio projects stop at writing tests. I wanted this one to show the layer around the tests: the reporting, reliability signals, CI feedback loop, and debugging workflow that help a team understand what happened when a run fails.

This project is intentionally small. It is not trying to be Cypress Cloud or a full enterprise test platform. It is a practical "cloud lite" slice that demonstrates QA infrastructure thinking without burying the idea under unnecessary platform complexity.

## What It Does

- Shows Playwright run history
- Stores runs, tests, retry attempts, and artifacts in SQLite
- Ingests normalized run JSON through an upload API
- Converts real Playwright JSON reporter output into the app's internal format
- Highlights failures, retries, flaky candidates, and slow tests
- Serves local artifacts through the app instead of leaving them as loose file links
- Includes a small Playwright smoke suite to test the dashboard itself

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma
- SQLite
- Playwright
- Local artifact storage

## Architecture

```txt
Playwright test run
  -> JSON reporter output
  -> normalizePlaywrightJsonReport()
  -> POST /api/runs/upload
  -> Prisma + SQLite
  -> dashboard and run detail pages
  -> /api/artifacts/:artifactId
```

The app starts with a single Next.js codebase because the goal is to validate the QA observability workflow first. The boundaries are still clear enough to move pieces later: SQLite could become Postgres, local artifact storage could become S3/R2, and the upload API could become a separate ingestion service.

## Data Model

The schema is built around debugging a test run:

- `Run`: one test execution, including CI metadata and summary counts
- `TestCase`: one test within a run
- `TestAttempt`: retry-level history for a test
- `Artifact`: screenshots, videos, traces, and logs linked to tests

This keeps the app focused on questions a QA/SDET actually asks:

- What failed?
- Did it retry?
- Did the retry pass?
- Is this a flaky candidate?
- What artifact should I open first?
- Was this local or CI?

## Getting Started

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npm run db:generate
```

Load the curated demo data:

```bash
npm run db:reset-demo
```

Start the app:

```bash
npm run dev -- --port 3017
```

Open:

```txt
http://localhost:3017
```

## Useful Commands

Run lint:

```bash
npm run lint
```

Build the app:

```bash
npm run build
```

Run the demo Playwright tests:

```bash
npm run test:demo
```

Generate real Playwright JSON reporter output:

```bash
npm run test:demo:json
```

Upload that Playwright JSON report:

```bash
PLAYWRIGHT_CLOUD_LITE_RUN_ID=demo-playwright-smoke npm run upload:playwright -- playwright-results.json
```

Reset the dashboard back to the curated demo state:

```bash
npm run db:reset-demo
```

## Uploading Results

There are two upload paths.

The first accepts normalized JSON:

```bash
npm run upload -- fixtures/playwright-run.sample.json
```

The second accepts Playwright JSON reporter output:

```bash
npm run upload:playwright -- fixtures/playwright-json-report.sample.json
```

The Playwright normalizer currently targets the standard JSON reporter shape from `@playwright/test@1.60.0`.

## Artifacts

Artifacts are stored as database records and served through the app:

```txt
/api/artifacts/:artifactId
```

For the MVP, local demo files live under:

```txt
storage/artifacts
```

Screenshots open inline. Trace files are served as downloads. The next step is to support copying real Playwright artifact files into local storage during upload.

## Current Status

This is still a work in progress. The current MVP is focused on the smallest useful vertical slice:

- Run list
- Run detail
- Upload API
- Playwright JSON normalization
- Retry/flaky signals
- Local artifact serving
- Demo Playwright tests

Things intentionally not included yet:

- Authentication
- Teams/projects/users
- Hosted artifact storage
- Historical trend charts
- Full blob reporter support
- Enterprise-scale retention or permissions

## Next Steps

- Add a short integration guide for using this from another Playwright project
- Improve artifact upload so real screenshots/traces/videos are copied into `storage/artifacts`
- Add filters for status, branch, and flaky candidates
- Add a dedicated flaky tests page
- Add GitHub Actions example workflow
- Add screenshots to this README
- Consider Postgres and S3/R2-compatible storage as a Phase 2

## Portfolio Note

This project is meant to show QA platform thinking: not just how to write tests, but how to make test results observable, debuggable, and useful inside a CI/CD workflow.
