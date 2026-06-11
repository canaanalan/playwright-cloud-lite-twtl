import { ArtifactType, RunStatus, TestStatus } from "@prisma/client";
import type {
  UploadRunPayload,
  UploadTestCasePayload,
} from "@/lib/run-payload";

type PlaywrightJsonReport = {
  config?: {
    rootDir?: string;
  };
  suites?: PlaywrightSuite[];
  stats?: {
    startTime?: string;
    duration?: number;
    expected?: number;
    skipped?: number;
    unexpected?: number;
    flaky?: number;
  };
};

type PlaywrightSuite = {
  title?: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
};

type PlaywrightSpec = {
  title?: string;
  file?: string;
  tests?: PlaywrightTest[];
};

type PlaywrightTest = {
  projectName?: string;
  status?: string;
  results?: PlaywrightResult[];
};

type PlaywrightResult = {
  status?: string;
  duration?: number;
  retry?: number;
  startTime?: string;
  error?: {
    message?: string;
  };
  errors?: {
    message?: string;
  }[];
  attachments?: {
    name?: string;
    path?: string;
    contentType?: string;
  }[];
};

type NormalizeOptions = {
  runId?: string;
  projectName?: string;
  branch?: string;
  commitSha?: string;
  ciProvider?: string;
  ciRunUrl?: string;
};

export function normalizePlaywrightJsonReport(
  report: PlaywrightJsonReport,
  options: NormalizeOptions = {},
): UploadRunPayload {
  const tests = flattenTests(report.suites ?? []);
  const failedCount = tests.filter((test) => test.status === TestStatus.FAILED).length;
  const skippedCount = tests.filter(
    (test) => test.status === TestStatus.SKIPPED,
  ).length;
  const flakyCount = tests.filter((test) => test.status === TestStatus.FLAKY).length;
  const passedCount = tests.filter((test) => test.status === TestStatus.PASSED).length;
  const retriedCount = tests.reduce(
    (total, test) => total + (test.retryCount ?? 0),
    0,
  );

  return {
    id: options.runId,
    projectName:
      options.projectName ??
      report.config?.rootDir?.split("/").filter(Boolean).at(-1) ??
      "playwright-json-report",
    status: getRunStatus({ failedCount, flakyCount }),
    branch: options.branch,
    commitSha: options.commitSha,
    ciProvider: options.ciProvider,
    ciRunUrl: options.ciRunUrl,
    startedAt: report.stats?.startTime,
    endedAt:
      report.stats?.startTime && report.stats.duration !== undefined
        ? new Date(
            Date.parse(report.stats.startTime) + report.stats.duration,
          ).toISOString()
        : undefined,
    durationMs: Math.round(report.stats?.duration ?? sumDurations(tests)),
    passedCount,
    failedCount,
    skippedCount,
    retriedCount,
    tests,
  };
}

function flattenTests(suites: PlaywrightSuite[]): UploadTestCasePayload[] {
  return suites.flatMap((suite) => collectSuiteTests(suite, []));
}

function collectSuiteTests(
  suite: PlaywrightSuite,
  parentTitles: string[],
): UploadTestCasePayload[] {
  const suiteTitles = [...parentTitles, suite.title].filter(Boolean) as string[];
  const specs = (suite.specs ?? []).flatMap((spec) =>
    collectSpecTests(spec, suiteTitles, suite.file),
  );
  const childSuites = (suite.suites ?? []).flatMap((childSuite) =>
    collectSuiteTests(childSuite, suiteTitles),
  );

  return [...specs, ...childSuites];
}

function collectSpecTests(
  spec: PlaywrightSpec,
  suiteTitles: string[],
  suiteFile?: string,
): UploadTestCasePayload[] {
  return (spec.tests ?? []).map((test) => {
    const attempts = (test.results ?? []).map((result, resultIndex) => ({
      attemptIndex: result.retry ?? resultIndex,
      status: mapResultStatus(result.status),
      durationMs: Math.round(result.duration ?? 0),
      errorMessage: getResultError(result),
      startedAt: result.startTime,
    }));
    const finalAttempt = attempts.at(-1);
    const hadFailure = attempts.some(
      (attempt) =>
        attempt.status === TestStatus.FAILED ||
        attempt.status === TestStatus.TIMED_OUT,
    );
    const finalStatus = mapTestStatus(test.status ?? finalAttempt?.status);
    const status =
      hadFailure && finalStatus === TestStatus.PASSED
        ? TestStatus.FLAKY
        : finalStatus;

    return {
      title: [...suiteTitles, spec.title].filter(Boolean).join(" > "),
      file: spec.file ?? suiteFile,
      browserName: test.projectName,
      status,
      durationMs: attempts.reduce((total, attempt) => total + attempt.durationMs, 0),
      retryCount: Math.max(0, attempts.length - 1),
      isFlaky: status === TestStatus.FLAKY,
      errorMessage:
        [...attempts].reverse().find((attempt) => attempt.errorMessage)
          ?.errorMessage ?? undefined,
      attempts,
      artifacts: collectArtifacts(test.results ?? []),
    };
  });
}

function getRunStatus({
  failedCount,
  flakyCount,
}: {
  failedCount: number;
  flakyCount: number;
}) {
  if (failedCount > 0) {
    return RunStatus.FAILED;
  }

  if (flakyCount > 0) {
    return RunStatus.FLAKY;
  }

  return RunStatus.PASSED;
}

function mapTestStatus(status: string | undefined) {
  if (
    status === "passed" ||
    status === "expected" ||
    status === TestStatus.PASSED
  ) {
    return TestStatus.PASSED;
  }

  if (status === "skipped" || status === TestStatus.SKIPPED) {
    return TestStatus.SKIPPED;
  }

  if (status === "timedOut" || status === TestStatus.TIMED_OUT) {
    return TestStatus.TIMED_OUT;
  }

  if (status === "flaky" || status === TestStatus.FLAKY) {
    return TestStatus.FLAKY;
  }

  return TestStatus.FAILED;
}

function mapResultStatus(status: string | undefined) {
  if (status === "passed") {
    return TestStatus.PASSED;
  }

  if (status === "skipped") {
    return TestStatus.SKIPPED;
  }

  if (status === "timedOut") {
    return TestStatus.TIMED_OUT;
  }

  return TestStatus.FAILED;
}

function getResultError(result: PlaywrightResult) {
  return (
    result.error?.message ??
    result.errors?.find((error) => error.message)?.message ??
    undefined
  );
}

function collectArtifacts(results: PlaywrightResult[]) {
  return results.flatMap((result) =>
    (result.attachments ?? [])
      .filter((attachment) => attachment.path)
      .map((attachment) => ({
        type: getArtifactType(attachment.name, attachment.contentType),
        label: attachment.name,
        path: attachment.path as string,
      })),
  );
}

function getArtifactType(name?: string, contentType?: string) {
  const descriptor = `${name ?? ""} ${contentType ?? ""}`.toLowerCase();

  if (descriptor.includes("trace")) {
    return ArtifactType.TRACE;
  }

  if (descriptor.includes("video")) {
    return ArtifactType.VIDEO;
  }

  if (descriptor.includes("image") || descriptor.includes("screenshot")) {
    return ArtifactType.SCREENSHOT;
  }

  return ArtifactType.LOG;
}

function sumDurations(tests: { durationMs: number }[]) {
  return tests.reduce((total, test) => total + test.durationMs, 0);
}
