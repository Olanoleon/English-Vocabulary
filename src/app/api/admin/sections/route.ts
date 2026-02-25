import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get("areaId");
    const requestedOrgId = searchParams.get("organizationId");
    const targetOrgId =
      session.role === "org_admin" ? session.organizationId : requestedOrgId || null;

    const where: Record<string, unknown> = {};
    if (areaId) where.areaId = areaId;
    if (targetOrgId) {
      where.area = {
        OR: [
          { scopeType: "global" },
          { scopeType: "org", organizationId: targetOrgId },
        ],
      };
    } else if (session.role === "org_admin") {
      where.areaId = "__no_area__";
    }

    const sections = await prisma.section.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        orgConfigs: {
          where: { organizationId: targetOrgId || "__no_org__" },
          take: 1,
        },
        _count: {
          select: { sectionVocabulary: true },
        },
        modules: {
          select: { id: true, type: true },
        },
      },
    });

    const sortedSections = targetOrgId
      ? [...sections].sort((a, b) => {
          const aOrder = a.orgConfigs[0]?.sortOrder ?? a.sortOrder;
          const bOrder = b.orgConfigs[0]?.sortOrder ?? b.sortOrder;
          return aOrder - bOrder;
        })
      : sections;

    return NextResponse.json(sortedSections);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const body = await request.json();
    const { title, titleEs, description, areaId } = body;

    if (!title || !titleEs || !areaId) {
      return NextResponse.json({ error: "Title, Spanish title, and area ID are required" }, { status: 400 });
    }

    const area = await prisma.area.findUnique({
      where: { id: areaId },
      select: {
        id: true,
        scopeType: true,
        organizationId: true,
      },
    });
    if (!area) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    // org_admin can create sections only in own org-owned areas.
    if (
      session.role === "org_admin" &&
      (area.scopeType !== "org" || area.organizationId !== session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get next sort order within area
    const lastSection = await prisma.section.findFirst({
      where: { areaId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastSection?.sortOrder ?? 0) + 1;

    // Create section with 3 modules
    const section = await prisma.section.create({
      data: {
        title,
        titleEs,
        description: description || "",
        sortOrder,
        areaId,
        organizationId: area.organizationId,
        modules: {
          create: [
            { type: "introduction", content: { readingText: "", readingTitle: "" } },
            { type: "practice" },
            { type: "test" },
          ],
        },
      },
      include: {
        modules: true,
        _count: { select: { sectionVocabulary: true } },
      },
    });

    if (area.organizationId) {
      await prisma.organizationSectionConfig.upsert({
        where: {
          organizationId_sectionId: {
            organizationId: area.organizationId,
            sectionId: section.id,
          },
        },
        update: {},
        create: {
          organizationId: area.organizationId,
          sectionId: section.id,
          isVisible: true,
          sortOrder,
        },
      });
    }

    return NextResponse.json(section, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create section error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
