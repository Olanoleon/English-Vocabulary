import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const orgId = session.organizationId || null;
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
        area: {
          include: {
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

    // Ensure section is visible in this user's org scope.
    const scopeAllowed =
      section.area.isActive &&
      (section.area.scopeType === "global" ||
        (orgId !== null &&
          section.area.scopeType === "org" &&
          section.area.organizationId === orgId));
    if (!scopeAllowed || !section.isActive) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (orgId) {
      const areaCfg = section.area.orgConfigs[0];
      const sectionCfg = section.orgConfigs[0];
      if ((areaCfg && !areaCfg.isVisible) || (sectionCfg && !sectionCfg.isVisible)) {
        return NextResponse.json({ error: "Section is locked" }, { status: 403 });
      }
    }

    // Check if this is the first visible section in its area (always unlocked)
    const areaSections = await prisma.section.findMany({
      where: {
        isActive: true,
        areaId: section.areaId,
      },
      orderBy: { sortOrder: "asc" },
      include: {
        orgConfigs: {
          where: { organizationId: orgId || "__no_org__" },
          take: 1,
        },
      },
    });

    const visibleAreaSections = areaSections
      .filter((s) => {
        if (!orgId) return true;
        const cfg = s.orgConfigs[0];
        return cfg ? cfg.isVisible : true;
      })
      .sort((a, b) => {
        const aOrder = orgId ? (a.orgConfigs[0]?.sortOrder ?? a.sortOrder) : a.sortOrder;
        const bOrder = orgId ? (b.orgConfigs[0]?.sortOrder ?? b.sortOrder) : b.sortOrder;
        return aOrder - bOrder;
      });

    const firstSection = visibleAreaSections[0];

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
