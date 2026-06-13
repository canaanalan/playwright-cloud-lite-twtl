import { copyFile, mkdir, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import type { UploadRunPayload } from "@/lib/run-payload";

const ARTIFACT_PREFIX = "/artifacts/";
const UPLOAD_ROOT = resolve(process.cwd(), "storage", "artifacts", "uploads");

type MaterializeResult = {
  payload: UploadRunPayload;
  copiedCount: number;
  missingCount: number;
};

export async function materializeArtifacts(
  payload: UploadRunPayload,
): Promise<MaterializeResult> {
  let copiedCount = 0;
  let missingCount = 0;
  const runStorageName = sanitizePathSegment(
    payload.id ?? `${payload.projectName}-${Date.now()}`,
  );

  for (const [testIndex, test] of (payload.tests ?? []).entries()) {
    for (const [artifactIndex, artifact] of (test.artifacts ?? []).entries()) {
      if (artifact.path.startsWith(ARTIFACT_PREFIX)) {
        continue;
      }

      const sourcePath = resolve(artifact.path);

      if (!(await isFile(sourcePath))) {
        missingCount += 1;
        continue;
      }

      const targetFilename = getTargetFilename({
        sourcePath,
        testIndex,
        artifactIndex,
      });
      const targetPath = resolve(UPLOAD_ROOT, runStorageName, targetFilename);

      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);

      artifact.path = `/artifacts/uploads/${runStorageName}/${targetFilename}`;
      copiedCount += 1;
    }
  }

  return {
    payload,
    copiedCount,
    missingCount,
  };
}

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function getTargetFilename({
  sourcePath,
  testIndex,
  artifactIndex,
}: {
  sourcePath: string;
  testIndex: number;
  artifactIndex: number;
}) {
  const extension = extname(sourcePath);
  const name = basename(sourcePath, extension);

  return `${testIndex + 1}-${artifactIndex + 1}-${sanitizePathSegment(name)}${extension}`;
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
