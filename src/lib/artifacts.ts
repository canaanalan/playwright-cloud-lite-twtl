import { resolve, sep } from "node:path";
import { ArtifactType } from "@prisma/client";

const ARTIFACT_URL_PREFIX = "/artifacts/";
const STORAGE_ROOT = resolve(process.cwd(), "storage", "artifacts");

export function getArtifactStoragePath(artifactPath: string) {
  const relativePath = artifactPath.startsWith(ARTIFACT_URL_PREFIX)
    ? artifactPath.slice(ARTIFACT_URL_PREFIX.length)
    : artifactPath;
  const resolvedPath = resolve(STORAGE_ROOT, relativePath);

  if (resolvedPath !== STORAGE_ROOT && !resolvedPath.startsWith(`${STORAGE_ROOT}${sep}`)) {
    return null;
  }

  return resolvedPath;
}

export function getArtifactHeaders({
  filename,
  type,
}: {
  filename: string;
  type: ArtifactType;
}) {
  const contentType = getArtifactContentType(filename, type);
  const disposition =
    type === ArtifactType.TRACE
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

  return {
    "content-disposition": disposition,
    "content-type": contentType,
  };
}

function getArtifactContentType(filename: string, type: ArtifactType) {
  const lowerFilename = filename.toLowerCase();

  if (type === ArtifactType.SCREENSHOT || lowerFilename.endsWith(".svg")) {
    return lowerFilename.endsWith(".svg") ? "image/svg+xml" : "image/png";
  }

  if (type === ArtifactType.VIDEO) {
    return "video/webm";
  }

  if (type === ArtifactType.TRACE || lowerFilename.endsWith(".zip")) {
    return "application/zip";
  }

  return "text/plain; charset=utf-8";
}
