import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtifactType, RunStatus, TestStatus } from "@prisma/client";
import { getArtifactStoragePath } from "@/lib/artifacts";
import { PLAYWRIGHT_REPORTER_VERSION } from "@/lib/playwright-compatibility";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const testStatusStyles: Record<TestStatus, string> = {
  PASSED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  FLAKY: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  SKIPPED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  TIMED_OUT: "border-orange-500/30 bg-orange-500/10 text-orange-300",
};

const runStatusStyles: Record<RunStatus, string> = {
  PASSED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  FLAKY: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  TIMED_OUT: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  INTERRUPTED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

const artifactLabels: Record<ArtifactType, string> = {
  SCREENSHOT: "Screenshot",
  VIDEO: "Video",
  TRACE: "Trace",
  LOG: "Log",
};

const artifactActionLabels: Record<ArtifactType, string> = {
  SCREENSHOT: "Open image",
  VIDEO: "Open video",
  TRACE: "Download trace",
  LOG: "Open log",
};

type RunDetailPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

function formatDuration(durationMs: number) {
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function shortSha(commitSha: string | null) {
  return commitSha?.slice(0, 7) ?? "local";
}

function cleanErrorMessage(message: string) {
  return message.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

async function getArtifactFileMeta(path: string) {
  const storagePath = getArtifactStoragePath(path);

  if (!storagePath) {
    return {
      filename: basename(path),
      extension: extname(path).replace(".", "").toUpperCase(),
      sizeLabel: null,
      isMissing: false,
    };
  }

  try {
    const fileStat = await stat(storagePath);

    return {
      filename: basename(storagePath),
      extension: extname(storagePath).replace(".", "").toUpperCase(),
      sizeLabel: formatBytes(fileStat.size),
      isMissing: false,
    };
  } catch {
    return {
      filename: basename(storagePath),
      extension: extname(storagePath).replace(".", "").toUpperCase(),
      sizeLabel: null,
      isMissing: true,
    };
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDebugPriority({
  failedCount,
  flakyCount,
  missingArtifactCount,
}: {
  failedCount: number;
  flakyCount: number;
  missingArtifactCount: number;
}) {
  if (failedCount > 0 && missingArtifactCount > 0) {
    return "Fix artifact capture first, then debug failed tests.";
  }

  if (failedCount > 0) {
    return "Start with failed tests that have screenshots, traces, or retry history.";
  }

  if (flakyCount > 0) {
    return "Review flaky tests and retry patterns before promoting this run.";
  }

  return "No immediate debugging needed for this run.";
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;
  const run = await prisma.run.findUnique({
    where: {
      id: runId,
    },
    include: {
      tests: {
        include: {
          attempts: {
            orderBy: {
              attemptIndex: "asc",
            },
          },
          artifacts: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: [
          {
            status: "asc",
          },
          {
            durationMs: "desc",
          },
        ],
      },
    },
  });

  if (!run) {
    notFound();
  }

  const priorityTests = run.tests.filter((test) =>
    ["FAILED", "FLAKY", "TIMED_OUT"].includes(test.status),
  );
  const priorityTestsWithArtifacts = await Promise.all(
    priorityTests.map(async (test) => ({
      ...test,
      artifacts: await Promise.all(
        test.artifacts.map(async (artifact) => ({
          ...artifact,
          fileMeta: await getArtifactFileMeta(artifact.path),
        })),
      ),
    })),
  );
  const flakyCount = run.tests.filter((test) => test.isFlaky).length;
  const missingArtifactCount = priorityTestsWithArtifacts.reduce(
    (total, test) =>
      total +
      test.artifacts.filter((artifact) => artifact.fileMeta.isMissing).length,
    0,
  );
  const testsWithArtifactsCount = run.tests.filter(
    (test) => test.artifacts.length > 0,
  ).length;
  const debugPriority = getDebugPriority({
    failedCount: run.failedCount,
    flakyCount,
    missingArtifactCount,
  });
  const slowestTests = [...run.tests]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex text-sm font-medium text-slate-400 hover:text-sky-300"
        >
          Back to runs
        </Link>

        <header className="mb-8 rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Run detail</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {run.projectName}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-md bg-slate-800 px-2 py-1">
                  branch {run.branch ?? "local"}
                </span>
                <span className="rounded-md bg-slate-800 px-2 py-1">
                  commit {shortSha(run.commitSha)}
                </span>
                <span className="rounded-md bg-slate-800 px-2 py-1">
                  {run.ciProvider ?? "Local run"}
                </span>
                <span className="rounded-md bg-slate-800 px-2 py-1">
                  reporter {PLAYWRIGHT_REPORTER_VERSION}
                </span>
              </div>
            </div>
            <span
              className={`inline-flex w-fit rounded-md border px-3 py-2 text-sm font-semibold ${runStatusStyles[run.status]}`}
            >
              {run.status.replace("_", " ")}
            </span>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Passed" value={run.passedCount.toString()} />
          <MetricCard label="Failed" value={run.failedCount.toString()} />
          <MetricCard label="Skipped" value={run.skippedCount.toString()} />
          <MetricCard label="Retries" value={run.retriedCount.toString()} />
          <MetricCard label="Duration" value={formatDuration(run.durationMs)} />
        </section>

        <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Debug priority
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {debugPriority}
              </h2>
            </div>
            <div className="grid gap-2 text-sm text-slate-400 sm:grid-cols-3 lg:min-w-[460px]">
              <DebugSignal label="Priority tests" value={priorityTests.length} />
              <DebugSignal label="Flaky signals" value={flakyCount} />
              <DebugSignal
                label="Tests with artifacts"
                value={testsWithArtifactsCount}
              />
            </div>
          </div>
          {missingArtifactCount > 0 ? (
            <p className="mt-4 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {missingArtifactCount} artifact file
              {missingArtifactCount === 1 ? "" : "s"} missing from local
              storage.
            </p>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Failures and flaky candidates
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Tests that need debugging first, with retry history and artifact
                links.
              </p>
            </div>

            {run.tests.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
                No test cases were recorded for this run. The run-level summary
                was uploaded, but the payload did not include per-test results.
              </div>
            ) : priorityTests.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
                No failed or flaky tests in this run.
              </div>
            ) : (
              priorityTestsWithArtifacts.map((test) => (
                <article
                  key={test.id}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-100">
                          {test.title}
                        </h3>
                        <StatusBadge status={test.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {test.file ?? "unknown file"} ·{" "}
                        {test.browserName ?? "browser unknown"} ·{" "}
                        {formatDuration(test.durationMs)}
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-300">
                      {test.retryCount} retries
                    </div>
                  </div>

                  {test.errorMessage ? (
                    <pre className="mt-4 max-w-full overflow-x-auto whitespace-pre rounded-md border border-rose-500/20 bg-rose-950/20 p-3 text-xs leading-5 text-rose-200">
                      {cleanErrorMessage(test.errorMessage)}
                    </pre>
                  ) : null}

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-300">
                        Attempts
                      </h4>
                      <div className="space-y-2">
                        {test.attempts.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No retry attempts recorded.
                          </p>
                        ) : (
                          test.attempts.map((attempt) => (
                            <div
                              key={attempt.id}
                              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium">
                                  Attempt {attempt.attemptIndex}
                                </span>
                                <StatusBadge status={attempt.status} />
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDuration(attempt.durationMs)}
                              </p>
                              {attempt.errorMessage ? (
                                <pre className="mt-2 max-h-48 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-900/80 p-3 text-xs leading-5 text-slate-400">
                                  {cleanErrorMessage(attempt.errorMessage)}
                                </pre>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-300">
                        Artifacts
                      </h4>
                      <div className="space-y-2">
                        {test.artifacts.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No artifacts linked.
                          </p>
                        ) : (
                          test.artifacts.map((artifact) => (
                            <ArtifactCard
                              key={artifact.id}
                              artifact={artifact}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <h2 className="text-base font-semibold">Slowest tests</h2>
              <div className="mt-4 space-y-3">
                {slowestTests.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No per-test duration data recorded.
                  </p>
                ) : (
                  slowestTests.map((test) => (
                    <div
                      key={test.id}
                      className="border-b border-slate-800 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-200">
                          {test.title}
                        </p>
                        <span className="shrink-0 text-xs text-slate-500">
                          {formatDuration(test.durationMs)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {test.browserName ?? "unknown browser"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-sm">
              <h2 className="text-base font-semibold">CI context</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <ContextRow label="Provider" value={run.ciProvider ?? "Local"} />
                <ContextRow label="Branch" value={run.branch ?? "local"} />
                <ContextRow label="Commit" value={shortSha(run.commitSha)} />
              </dl>
              {run.ciRunUrl ? (
                <a
                  href={run.ciRunUrl}
                  className="mt-4 inline-flex text-sm font-medium text-sky-300 hover:text-sky-200"
                >
                  Open CI run
                </a>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
        {value}
      </p>
    </div>
  );
}

function DebugSignal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: TestStatus }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${testStatusStyles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function ArtifactCard({
  artifact,
}: {
  artifact: {
    id: string;
    type: ArtifactType;
    path: string;
    label: string | null;
    fileMeta: {
      filename: string;
      extension: string;
      sizeLabel: string | null;
      isMissing: boolean;
    };
  };
}) {
  const href = `/api/artifacts/${artifact.id}`;
  const title = artifact.label ?? artifactLabels[artifact.type];

  return (
    <a
      href={href}
      className="block overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-sm transition hover:border-sky-500/40 hover:bg-slate-950/80"
    >
      {artifact.type === ArtifactType.SCREENSHOT && !artifact.fileMeta.isMissing ? (
        <Image
          src={href}
          alt=""
          width={640}
          height={360}
          unoptimized
          className="h-36 w-full border-b border-slate-800 bg-slate-900 object-cover object-top"
        />
      ) : null}

      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-sky-300">{title}</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">
              {artifact.fileMeta.filename || artifact.path}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-400">
            {artifact.fileMeta.extension || artifact.type}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-300">
            {artifactActionLabels[artifact.type]}
          </span>
          {artifact.fileMeta.sizeLabel ? (
            <span className="text-slate-600">· {artifact.fileMeta.sizeLabel}</span>
          ) : null}
          {artifact.fileMeta.isMissing ? (
            <span className="rounded-md bg-rose-500/10 px-2 py-1 font-medium text-rose-300 ring-1 ring-rose-500/20">
              missing on disk
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate text-slate-300">{value}</dd>
    </div>
  );
}
