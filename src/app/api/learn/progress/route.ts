import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { sectionId, type } = await request.json();

    if (!sectionId || !type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Ensure learner can only update progress for sections visible in their org scope.
    const orgId = session.organizationId || null;
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
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
      },
    });

    if (!section || !section.isActive || !section.area.isActive) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    const scopeAllowed =
      section.area.scopeType === "global" ||
      (orgId !== null &&
        section.area.scopeType === "org" &&
        section.area.organizationId === orgId);
    if (!scopeAllowed) {
      return NextResponse.json({ error: "Section is not available" }, { status: 403 });
    }
    if (orgId) {
      const areaCfg = section.area.orgConfigs[0];
      const sectionCfg = section.orgConfigs[0];
      if ((areaCfg && !areaCfg.isVisible) || (sectionCfg && !sectionCfg.isVisible)) {
        return NextResponse.json({ error: "Section is hidden" }, { status: 403 });
      }
    }

    // Upsert progress
    const data: Record<string, boolean | Date> = {};
    if (type === "intro") {
      data.introCompleted = true;
    } else if (type === "practice") {
      data.practiceCompleted = true;
    }

    const progress = await prisma.learnerSectionProgress.upsert({
      where: {
        userId_sectionId: {
          userId: session.userId,
          sectionId,
        },
      },
      create: {
        userId: session.userId,
        sectionId,
        unlocked: true,
        unlockedAt: new Date(),
        ...(type === "intro" ? { introCompleted: true } : {}),
        ...(type === "practice" ? { practiceCompleted: true } : {}),
      },
      update: data,
    });

    return NextResponse.json(progress);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
