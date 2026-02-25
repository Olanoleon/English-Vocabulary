import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.organizationId || null;
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get("areaId");

    const sections = await prisma.section.findMany({
      where: {
        isActive: true,
        area: {
          isActive: true,
          OR: orgId
            ? [{ scopeType: "global" }, { scopeType: "org", organizationId: orgId }]
            : [{ scopeType: "global" }],
        },
        ...(areaId ? { areaId } : {}),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        area: {
          select: {
            id: true,
            orgConfigs: {
              where: { organizationId: orgId || "__no_org__" },
              take: 1,
            },
          },
        },
        orgConfigs: {
          where: { organizationId: orgId || "__no_org__" },
          take: 1,
        },
        _count: { select: { sectionVocabulary: true } },
        modules: { select: { id: true, type: true } },
        learnerProgress: {
          where: { userId: session.userId },
        },
      },
    });

    const visibleSections = sections
      .filter((section) => {
        if (!orgId) return true;
        const areaCfg = section.area.orgConfigs[0];
        const sectionCfg = section.orgConfigs[0];
        return (areaCfg ? areaCfg.isVisible : true) && (sectionCfg ? sectionCfg.isVisible : true);
      })
      .sort((a, b) => {
        const aOrder = orgId ? (a.orgConfigs[0]?.sortOrder ?? a.sortOrder) : a.sortOrder;
        const bOrder = orgId ? (b.orgConfigs[0]?.sortOrder ?? b.sortOrder) : b.sortOrder;
        return aOrder - bOrder;
      });

    // Map sections with progress info
    const result = visibleSections.map((section) => {
      const progress = section.learnerProgress[0];
      return {
        id: section.id,
        title: section.title,
        titleEs: section.titleEs,
        description: section.description,
        sortOrder: orgId ? (section.orgConfigs[0]?.sortOrder ?? section.sortOrder) : section.sortOrder,
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
