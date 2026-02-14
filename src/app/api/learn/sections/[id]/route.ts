import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Check if unlocked
    const progress = await prisma.learnerSectionProgress.findUnique({
      where: {
        userId_sectionId: {
          userId: session.userId,
          sectionId: id,
        },
      },
    });

    // First section is always accessible
    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            questions: {
              include: { options: { orderBy: { sortOrder: "asc" } } },
              orderBy: { sortOrder: "asc" },
            },
            _count: { select: { questions: true } },
          },
        },
        sectionVocabulary: {
          include: { vocabulary: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Check if this is the first section in its area (always unlocked)
    const firstSection = await prisma.section.findFirst({
      where: { isActive: true, areaId: section.areaId },
      orderBy: { sortOrder: "asc" },
    });

    const isFirstSection = firstSection?.id === id;
    const isUnlocked = isFirstSection || progress?.unlocked;

    if (!isUnlocked) {
      return NextResponse.json({ error: "Section is locked" }, { status: 403 });
    }

    return NextResponse.json({
      ...section,
      progress: progress
        ? {
            introCompleted: progress.introCompleted,
            practiceCompleted: progress.practiceCompleted,
            testScore: progress.testScore,
            testPassed: progress.testPassed,
          }
        : {
            introCompleted: false,
            practiceCompleted: false,
            testScore: null,
            testPassed: false,
          },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
