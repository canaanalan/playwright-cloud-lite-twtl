import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtifactType, TestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const testStatusStyles: Record<TestStatus, string> = {
  PASSED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  FLAKY: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  SKIPPED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  TIMED_OUT: "border-orange-500/30 bg-orange-500/10 text-orange-300",
};

const artifactLabels: Record<ArtifactType, string> = {
  SCREENSHOT: "Screenshot",
  VIDEO: "Video",
  TRACE: "Trace",
  LOG: "Log",
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
              </div>
            </div>
            <span className="inline-flex w-fit rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300">
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

            {priorityTests.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
                No failed or flaky tests in this run.
              </div>
            ) : (
              priorityTests.map((test) => (
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
                            <a
                              key={artifact.id}
                              href={`/api/artifacts/${artifact.id}`}
                              className="block rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-sky-300 hover:border-sky-500/40 hover:text-sky-200"
                            >
                              {artifact.label ?? artifactLabels[artifact.type]}
                              <span className="mt-1 block font-mono text-xs text-slate-500">
                                {artifact.path}
                              </span>
                            </a>
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
                {slowestTests.map((test) => (
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
                ))}
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

function StatusBadge({ status }: { status: TestStatus }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${testStatusStyles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
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
