import Link from "next/link";
import { RunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusStyles: Record<RunStatus, string> = {
  PASSED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  FLAKY: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  TIMED_OUT: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  INTERRUPTED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
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

function formatRelativeTime(date: Date) {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(Math.round(diffHours / 24), "day");
}

function shortSha(commitSha: string | null) {
  return commitSha?.slice(0, 7) ?? "local";
}

export default async function Home() {
  const runs = await prisma.run.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      tests: {
        select: {
          isFlaky: true,
        },
      },
    },
  });

  const totalRuns = runs.length;
  const failedRuns = runs.filter((run) => run.status === "FAILED").length;
  const flakyTests = runs.reduce(
    (total, run) => total + run.tests.filter((test) => test.isFlaky).length,
    0,
  );
  const totalRetries = runs.reduce((total, run) => total + run.retriedCount, 0);

  return (
    <main className="min-h-screen bg-[#070a12] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl gap-7 px-6 py-8">
        <aside className="hidden w-56 shrink-0 border-r border-white/10 pr-6 lg:block">
          <div className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Playwright
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Cloud Lite
            </h1>
          </div>
          <nav className="space-y-1 text-sm font-medium">
            <a
              href="#recent-runs"
              className="block rounded-md bg-white/[0.06] px-3 py-2 text-slate-100 ring-1 ring-white/10"
            >
              Runs
            </a>
            <span className="block rounded-md px-3 py-2 text-slate-600">
              Failures <span className="text-xs text-slate-700">soon</span>
            </span>
            <span className="block rounded-md px-3 py-2 text-slate-600">
              Flaky <span className="text-xs text-slate-700">soon</span>
            </span>
            <span className="block rounded-md px-3 py-2 text-slate-600">
              Artifacts <span className="text-xs text-slate-700">soon</span>
            </span>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Test observability
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Run history
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Recent Playwright runs with CI context, failure counts, retries,
                and early flaky-test signals.
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
              SQLite local demo
            </div>
          </header>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Runs" value={totalRuns.toString()} />
            <MetricCard label="Failed runs" value={failedRuns.toString()} />
            <MetricCard label="Retries" value={totalRetries.toString()} />
            <MetricCard label="Flaky candidates" value={flakyTests.toString()} />
          </div>

          <div
            id="recent-runs"
            className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/60 shadow-sm"
          >
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold">Recent runs</h3>
            </div>

            {runs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium text-slate-200">
                  No runs found.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Run npm run db:seed to load the sample Playwright data.
                </p>
              </div>
            ) : (
              <div>
                <div className="hidden grid-cols-[minmax(220px,1.6fr)_110px_minmax(160px,1fr)_minmax(230px,1.2fr)_80px_100px_100px_80px] gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-semibold uppercase text-slate-500 xl:grid">
                  <span>Run</span>
                  <span>Status</span>
                  <span>Branch</span>
                  <span>Results</span>
                  <span>Retries</span>
                  <span>Duration</span>
                  <span>Created</span>
                  <span>Details</span>
                </div>
                <div className="divide-y divide-white/10">
                  {runs.map((run) => (
                    <Link
                      key={run.id}
                      href={`/runs/${run.id}`}
                      className="grid cursor-pointer gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-sky-500/50 xl:grid-cols-[minmax(220px,1.6fr)_110px_minmax(160px,1fr)_minmax(230px,1.2fr)_80px_100px_100px_80px] xl:items-center"
                    >
                      <div className="min-w-0">
                        <span
                          className="block truncate font-medium text-slate-100"
                          title={run.projectName}
                        >
                          {run.projectName}
                        </span>
                        <div className="mt-1 flex min-w-0 gap-2 text-xs text-slate-500">
                          <span className="truncate">
                            {run.ciProvider ?? "Local"}
                          </span>
                          <span className="shrink-0">
                            commit {shortSha(run.commitSha)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusStyles[run.status]}`}
                        >
                          {run.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="min-w-0 font-mono text-xs text-slate-300">
                        <span className="block truncate" title={run.branch ?? "local"}>
                          {run.branch ?? "local"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <ResultPill
                          label="passed"
                          value={run.passedCount}
                          tone="pass"
                        />
                        <ResultPill
                          label="failed"
                          value={run.failedCount}
                          tone="fail"
                        />
                        <ResultPill
                          label="skipped"
                          value={run.skippedCount}
                          tone="skip"
                        />
                      </div>

                      <LabeledValue label="Retries" value={run.retriedCount} />
                      <LabeledValue
                        label="Duration"
                        value={formatDuration(run.durationMs)}
                      />
                      <LabeledValue
                        label="Created"
                        value={formatRelativeTime(run.createdAt)}
                        muted
                      />
                      <span className="text-sm font-medium text-sky-300">
                        Open
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
        {value}
      </p>
    </div>
  );
}

function ResultPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pass" | "fail" | "skip";
}) {
  const toneClass = {
    pass: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    fail: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    skip: "bg-slate-800 text-slate-300 ring-slate-700",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ring-1 ${toneClass}`}
    >
      <span>{value}</span>
      <span>{label}</span>
    </span>
  );
}

function LabeledValue({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
}) {
  return (
    <div className={muted ? "text-slate-500" : "text-slate-300"}>
      <span className="mr-2 text-xs font-semibold uppercase text-slate-600 xl:hidden">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
