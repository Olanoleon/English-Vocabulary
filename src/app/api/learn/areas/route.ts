import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireAuth();
    const orgId = session.organizationId || null;

    const areas = await prisma.area.findMany({
      where: {
        isActive: true,
        OR: orgId
          ? [{ scopeType: "global" }, { scopeType: "org", organizationId: orgId }]
          : [{ scopeType: "global" }],
      },
      orderBy: { sortOrder: "asc" },
      include: {
        orgConfigs: {
          where: { organizationId: orgId || "__no_org__" },
          take: 1,
        },
        sections: {
          where: { isActive: true },
          select: {
            id: true,
            sortOrder: true,
            orgConfigs: {
              where: { organizationId: orgId || "__no_org__" },
              take: 1,
            },
          },
        },
      },
    });

    // Apply org-level visibility and section visibility
    const visibleAreas = areas
      .filter((area) => {
        if (!orgId) return true;
        const cfg = area.orgConfigs[0];
        return cfg ? cfg.isVisible : true;
      })
      .map((area) => {
        const visibleSections = area.sections.filter((section) => {
          if (!orgId) return true;
          const cfg = section.orgConfigs[0];
          return cfg ? cfg.isVisible : true;
        });
        return {
          ...area,
          visibleSections,
          effectiveSortOrder: orgId
            ? (area.orgConfigs[0]?.sortOrder ?? area.sortOrder)
            : area.sortOrder,
        };
      });

    // Count completions per area in the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentCompletions = await prisma.learnerAttempt.findMany({
      where: {
        completedAt: { gte: oneWeekAgo },
        passed: true,
        user: orgId ? { organizationId: orgId } : undefined,
      },
      select: { moduleId: true },
    });

    // Map moduleId -> sectionId so we can aggregate by area
    const moduleIds = [...new Set(recentCompletions.map((r) => r.moduleId))];
    const modules = moduleIds.length > 0
      ? await prisma.module.findMany({
          where: { id: { in: moduleIds } },
          select: { id: true, sectionId: true },
        })
      : [];

    const moduleToSection = new Map(modules.map((m) => [m.id, m.sectionId]));

    // Build sectionId -> area lookup
    const sectionToArea = new Map<string, string>();
    for (const area of visibleAreas) {
      for (const section of area.visibleSections) {
        sectionToArea.set(section.id, area.id);
      }
    }

    // Aggregate completion counts per area
    const areaCompletions = new Map<string, number>();
    for (const rc of recentCompletions) {
      const sectionId = moduleToSection.get(rc.moduleId);
      if (!sectionId) continue;
      const areaId = sectionToArea.get(sectionId);
      if (!areaId) continue;
      areaCompletions.set(areaId, (areaCompletions.get(areaId) || 0) + 1);
    }

    const result = visibleAreas
      .map((area) => {
        const recentCount = areaCompletions.get(area.id) || 0;
        return {
          id: area.id,
          name: area.name,
          nameEs: area.nameEs,
          description: area.description,
          imageUrl: area.imageUrl,
          unitCount: area.visibleSections.length,
          recentCompletions: recentCount,
          isHot: recentCount >= 3,
          sortOrder: area.effectiveSortOrder,
        };
      })
      // Hot topics first, then by sortOrder
      .sort((a, b) => {
        if (a.isHot && !b.isHot) return -1;
        if (!a.isHot && b.isHot) return 1;
        return a.sortOrder - b.sortOrder;
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
