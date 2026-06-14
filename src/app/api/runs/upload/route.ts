import { NextResponse } from "next/server";
import { PLAYWRIGHT_REPORTER_NOTE } from "@/lib/playwright-compatibility";
import { prisma } from "@/lib/prisma";
import { validateUploadRunPayload } from "@/lib/run-payload";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Request body must be valid JSON.",
        hint: "Generate Playwright JSON with: npx playwright test --reporter=json > playwright-results.json",
      },
      { status: 400 },
    );
  }

  const validation = validateUploadRunPayload(body);

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: "Invalid run payload.",
        details: validation.errors,
        compatibility: PLAYWRIGHT_REPORTER_NOTE,
      },
      { status: 400 },
    );
  }

  const payload = validation.payload;

  try {
    if (payload.id) {
      await prisma.run.deleteMany({
        where: {
          id: payload.id,
        },
      });
    }

    const run = await prisma.run.create({
      data: {
        id: payload.id,
        projectName: payload.projectName,
        status: payload.status,
        branch: payload.branch,
        commitSha: payload.commitSha,
        ciProvider: payload.ciProvider,
        ciRunUrl: payload.ciRunUrl,
        startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
        endedAt: payload.endedAt ? new Date(payload.endedAt) : undefined,
        durationMs: payload.durationMs,
        passedCount: payload.passedCount ?? 0,
        failedCount: payload.failedCount ?? 0,
        skippedCount: payload.skippedCount ?? 0,
        retriedCount: payload.retriedCount ?? 0,
        tests: {
          create: (payload.tests ?? []).map((test) => ({
            title: test.title,
            file: test.file,
            browserName: test.browserName,
            status: test.status,
            durationMs: test.durationMs,
            retryCount: test.retryCount ?? 0,
            isFlaky: test.isFlaky ?? false,
            errorMessage: test.errorMessage,
            attempts: {
              create: (test.attempts ?? []).map((attempt) => ({
                attemptIndex: attempt.attemptIndex,
                status: attempt.status,
                durationMs: attempt.durationMs,
                errorMessage: attempt.errorMessage,
                startedAt: attempt.startedAt
                  ? new Date(attempt.startedAt)
                  : undefined,
              })),
            },
            artifacts: {
              create: (test.artifacts ?? []).map((artifact) => ({
                type: artifact.type,
                path: artifact.path,
                label: artifact.label,
              })),
            },
          })),
        },
      },
      select: {
        id: true,
        projectName: true,
        status: true,
        tests: {
          select: {
            id: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        runId: run.id,
        projectName: run.projectName,
        status: run.status,
        testCount: run.tests.length,
        compatibility: PLAYWRIGHT_REPORTER_NOTE,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to upload run." },
      { status: 500 },
    );
  }
}
