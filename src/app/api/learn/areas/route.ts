import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const areas = await prisma.area.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            sections: {
              where: { isActive: true },
            },
          },
        },
        sections: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    // Count completions per area in the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentCompletions = await prisma.learnerAttempt.groupBy({
      by: ["moduleId"],
      where: {
        completedAt: { gte: oneWeekAgo },
        passed: true,
      },
      _count: { id: true },
    });

    // Map moduleId -> sectionId so we can aggregate by area
    const moduleIds = recentCompletions.map((r) => r.moduleId);
    const modules = moduleIds.length > 0
      ? await prisma.module.findMany({
          where: { id: { in: moduleIds } },
          select: { id: true, sectionId: true },
        })
      : [];

    const moduleToSection = new Map(modules.map((m) => [m.id, m.sectionId]));

    // Build sectionId -> area lookup
    const sectionToArea = new Map<string, string>();
    for (const area of areas) {
      for (const section of area.sections) {
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
      areaCompletions.set(areaId, (areaCompletions.get(areaId) || 0) + rc._count.id);
    }

    const result = areas
      .map((area) => {
        const recentCount = areaCompletions.get(area.id) || 0;
        return {
          id: area.id,
          name: area.name,
          nameEs: area.nameEs,
          description: area.description,
          imageUrl: area.imageUrl,
          unitCount: area._count.sections,
          recentCompletions: recentCount,
          isHot: recentCount >= 3,
          sortOrder: area.sortOrder,
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
