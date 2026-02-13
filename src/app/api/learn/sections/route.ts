import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get("areaId");

    const sections = await prisma.section.findMany({
      where: {
        isActive: true,
        ...(areaId ? { areaId } : {}),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { sectionVocabulary: true } },
        modules: { select: { id: true, type: true } },
        learnerProgress: {
          where: { userId: session.userId },
        },
      },
    });

    // Map sections with progress info
    const result = sections.map((section) => {
      const progress = section.learnerProgress[0];
      return {
        id: section.id,
        title: section.title,
        titleEs: section.titleEs,
        description: section.description,
        sortOrder: section.sortOrder,
        imageUrl: section.imageUrl,
        wordCount: section._count.sectionVocabulary,
        modules: section.modules,
        progress: progress
          ? {
              introCompleted: progress.introCompleted,
              practiceCompleted: progress.practiceCompleted,
              testScore: progress.testScore,
              testPassed: progress.testPassed,
              unlocked: progress.unlocked,
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
