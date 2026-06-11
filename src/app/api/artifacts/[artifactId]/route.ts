import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { getArtifactHeaders, getArtifactStoragePath } from "@/lib/artifacts";
import { prisma } from "@/lib/prisma";

type ArtifactRouteProps = {
  params: Promise<{
    artifactId: string;
  }>;
};

export async function GET(_request: Request, { params }: ArtifactRouteProps) {
  const { artifactId } = await params;
  const artifact = await prisma.artifact.findUnique({
    where: {
      id: artifactId,
    },
  });

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }

  const storagePath = getArtifactStoragePath(artifact.path);

  if (!storagePath) {
    return NextResponse.json(
      { error: "Artifact path is outside local storage." },
      { status: 400 },
    );
  }

  try {
    const file = await readFile(storagePath);
    return new NextResponse(file, {
      headers: getArtifactHeaders({
        filename: basename(storagePath),
        type: artifact.type,
      }),
    });
  } catch {
    return NextResponse.json(
      {
        error: "Artifact file not found on disk.",
        artifactPath: artifact.path,
      },
      { status: 404 },
    );
  }
}
