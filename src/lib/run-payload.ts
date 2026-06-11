import { ArtifactType, RunStatus, TestStatus } from "@prisma/client";

const runStatuses = new Set<string>(Object.values(RunStatus));
const testStatuses = new Set<string>(Object.values(TestStatus));
const artifactTypes = new Set<string>(Object.values(ArtifactType));

export type UploadRunPayload = {
  id?: string;
  projectName: string;
  status: RunStatus;
  branch?: string;
  commitSha?: string;
  ciProvider?: string;
  ciRunUrl?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs: number;
  passedCount?: number;
  failedCount?: number;
  skippedCount?: number;
  retriedCount?: number;
  tests?: UploadTestCasePayload[];
};

export type UploadTestCasePayload = {
  title: string;
  file?: string;
  browserName?: string;
  status: TestStatus;
  durationMs: number;
  retryCount?: number;
  isFlaky?: boolean;
  errorMessage?: string;
  attempts?: UploadAttemptPayload[];
  artifacts?: UploadArtifactPayload[];
};

export type UploadAttemptPayload = {
  attemptIndex: number;
  status: TestStatus;
  durationMs: number;
  errorMessage?: string;
  startedAt?: string;
};

export type UploadArtifactPayload = {
  type: ArtifactType;
  path: string;
  label?: string;
};

type ValidationResult =
  | {
      ok: true;
      payload: UploadRunPayload;
    }
  | {
      ok: false;
      errors: string[];
    };

export function validateUploadRunPayload(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: ["Payload must be a JSON object."],
    };
  }

  const payload = input as Record<string, unknown>;
  requireString(payload, "projectName", errors);
  requireEnum(payload, "status", runStatuses, errors);
  requireNumber(payload, "durationMs", errors);

  optionalString(payload, "id", errors);
  optionalString(payload, "branch", errors);
  optionalString(payload, "commitSha", errors);
  optionalString(payload, "ciProvider", errors);
  optionalString(payload, "ciRunUrl", errors);
  optionalDateString(payload, "startedAt", errors);
  optionalDateString(payload, "endedAt", errors);
  optionalNumber(payload, "passedCount", errors);
  optionalNumber(payload, "failedCount", errors);
  optionalNumber(payload, "skippedCount", errors);
  optionalNumber(payload, "retriedCount", errors);

  if (payload.tests !== undefined) {
    if (!Array.isArray(payload.tests)) {
      errors.push("tests must be an array.");
    } else {
      payload.tests.forEach((test, testIndex) => {
        validateTestCase(test, `tests[${testIndex}]`, errors);
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    payload: input as UploadRunPayload,
  };
}

function validateTestCase(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  requireString(input, `${path}.title`, errors, "title");
  requireEnum(input, `${path}.status`, testStatuses, errors, "status");
  requireNumber(input, `${path}.durationMs`, errors, "durationMs");
  optionalString(input, `${path}.file`, errors, "file");
  optionalString(input, `${path}.browserName`, errors, "browserName");
  optionalString(input, `${path}.errorMessage`, errors, "errorMessage");
  optionalNumber(input, `${path}.retryCount`, errors, "retryCount");
  optionalBoolean(input, `${path}.isFlaky`, errors, "isFlaky");

  if (input.attempts !== undefined) {
    if (!Array.isArray(input.attempts)) {
      errors.push(`${path}.attempts must be an array.`);
    } else {
      input.attempts.forEach((attempt, attemptIndex) => {
        validateAttempt(attempt, `${path}.attempts[${attemptIndex}]`, errors);
      });
    }
  }

  if (input.artifacts !== undefined) {
    if (!Array.isArray(input.artifacts)) {
      errors.push(`${path}.artifacts must be an array.`);
    } else {
      input.artifacts.forEach((artifact, artifactIndex) => {
        validateArtifact(
          artifact,
          `${path}.artifacts[${artifactIndex}]`,
          errors,
        );
      });
    }
  }
}

function validateAttempt(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  requireNumber(input, `${path}.attemptIndex`, errors, "attemptIndex");
  requireEnum(input, `${path}.status`, testStatuses, errors, "status");
  requireNumber(input, `${path}.durationMs`, errors, "durationMs");
  optionalString(input, `${path}.errorMessage`, errors, "errorMessage");
  optionalDateString(input, `${path}.startedAt`, errors, "startedAt");
}

function validateArtifact(input: unknown, path: string, errors: string[]) {
  if (!isRecord(input)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  requireEnum(input, `${path}.type`, artifactTypes, errors, "type");
  requireString(input, `${path}.path`, errors, "path");
  optionalString(input, `${path}.label`, errors, "label");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldName(path: string, field?: string) {
  return field ?? path;
}

function requireString(
  object: Record<string, unknown>,
  path: string,
  errors: string[],
  field?: string,
) {
  const value = object[fieldName(path, field)];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
  }
}

function optionalString(
  object: Record<string, unknown>,
  path: string,
  errors: string[],
  field?: string,
) {
  const value = object[fieldName(path, field)];
  if (value !== undefined && typeof value !== "string") {
    errors.push(`${path} must be a string.`);
  }
}

function requireNumber(
  object: Record<string, unknown>,
  path: string,
  errors: string[],
  field?: string,
) {
  const value = object[fieldName(path, field)];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
  }
}

function optionalNumber(
  object: Record<string, unknown>,
  path: string,
  errors: string[],
  field?: string,
) {
  const value = object[fieldName(path, field)];
  if (
    value !== undefined &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    errors.push(`${path} must be a finite number.`);
  }
}

function optionalBoolean(
  object: Record<string, unknown>,
  path: string,
  errors: string[],
  field?: string,
) {
  const value = object[fieldName(path, field)];
  if (value !== undefined && typeof value !== "boolean") {
    errors.push(`${path} must be a boolean.`);
  }
}

function requireEnum(
  object: Record<string, unknown>,
  path: string,
  allowedValues: Set<string>,
  errors: string[],
  field?: string,
) {
  const value = object[fieldName(path, field)];
  if (typeof value !== "string" || !allowedValues.has(value)) {
    errors.push(`${path} must be one of: ${Array.from(allowedValues).join(", ")}.`);
  }
}

function optionalDateString(
  object: Record<string, unknown>,
  path: string,
  errors: string[],
  field?: string,
) {
  const value = object[fieldName(path, field)];
  if (value !== undefined && !isValidDateString(value)) {
    errors.push(`${path} must be a valid date string.`);
  }
}

function isValidDateString(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
