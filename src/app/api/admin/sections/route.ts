import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { getUnitImageByTitle } from "@/lib/unit-image";
import {
  ensureOrgSectionFromTemplateForOrg,
  replicateTemplateSectionToAllOrgs,
} from "@/lib/template-replication";

function isTemplateArea(area: {
  isTemplate?: boolean;
  scopeType: string;
  organizationId: string | null;
}) {
  return Boolean(area.isTemplate) || (area.scopeType === "global" && !area.organizationId);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get("areaId");
    const requestedOrgId = searchParams.get("organizationId");
    if (activeRole === "org_admin" && !session.organizationId) {
      return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
    }
    const targetOrgId =
      activeRole === "org_admin" ? session.organizationId : requestedOrgId || null;

    const where: Record<string, unknown> = {};
    if (areaId) where.areaId = areaId;
    if (targetOrgId) {
      where.organizationId = targetOrgId;
    } else if (activeRole === "org_admin") {
      where.areaId = "__no_area__";
    } else {
      where.OR = [
        { isTemplate: true, organizationId: null },
        {
          isTemplate: false,
          organizationId: null,
          area: { scopeType: "global", organizationId: null },
        },
      ];
    }

    const sections = await prisma.section.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
    const seenTemplateSectionIds = new Set<string>();
    const dedupedSections = sections.filter((section) => {
      if (!section.sourceTemplateId) return true;
      if (seenTemplateSectionIds.has(section.sourceTemplateId)) return false;
      seenTemplateSectionIds.add(section.sourceTemplateId);
      return true;
    });

    if (activeRole === "org_admin" && targetOrgId && areaId) {
      const area = await prisma.area.findUnique({
        where: { id: areaId },
        select: {
          id: true,
          organizationId: true,
          sourceTemplateId: true,
        },
      });

      if (area && area.organizationId === targetOrgId && area.sourceTemplateId) {
        const templateSections = await prisma.section.findMany({
          where: {
            areaId: area.sourceTemplateId,
            organizationId: null,
          },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            titleEs: true,
            sortOrder: true,
            isActive: true,
            imageUrl: true,
            _count: { select: { sectionVocabulary: true } },
          },
        });

        const copiedTemplateSectionIds = new Set(
          dedupedSections
            .map((section) => section.sourceTemplateId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        );

        const pendingSections = templateSections
          .filter((templateSection) => !copiedTemplateSectionIds.has(templateSection.id))
          .map((templateSection) => ({
            id: `pending-${templateSection.id}`,
            title: templateSection.title,
            titleEs: templateSection.titleEs,
            sortOrder: templateSection.sortOrder,
            isActive: true,
            imageUrl: templateSection.imageUrl,
            _count: templateSection._count,
            modules: [],
            orgConfigs: [],
            replicationPending: true,
            sourceTemplateId: templateSection.id,
          }));

        if (pendingSections.length > 0) {
          const missingTemplateSectionIds = pendingSections.map(
            (section) => section.sourceTemplateId
          );
          void Promise.all(
            missingTemplateSectionIds.map((templateSectionId) =>
              ensureOrgSectionFromTemplateForOrg(templateSectionId, targetOrgId)
            )
          ).catch((replicationError) => {
            console.error("Org section bootstrap replication failed:", replicationError);
          });
        }

        const mergedSections = [...dedupedSections, ...pendingSections].sort(
          (a, b) => a.sortOrder - b.sortOrder
        );
        return NextResponse.json(mergedSections);
      }
    }

    const sortedSections = targetOrgId
      ? [...dedupedSections].sort((a, b) => {
          const aOrder = a.orgConfigs[0]?.sortOrder ?? a.sortOrder;
          const bOrder = b.orgConfigs[0]?.sortOrder ?? b.sortOrder;
          return aOrder - bOrder;
        })
      : dedupedSections;

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
    const activeRole = session.activeRole || session.role;
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
        isTemplate: true,
      },
    });
    if (!area) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    if (activeRole === "org_admin" && area.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get next sort order within area
    const lastSection = await prisma.section.findFirst({
      where: { areaId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastSection?.sortOrder ?? 0) + 1;
    const imageUrl = await getUnitImageByTitle(title, { kind: "section" });

    // Create section with 3 modules
    const ownerOrgIdForSection =
      activeRole === "org_admin" ? session.organizationId || null : null;
    const isTemplateSection = activeRole !== "org_admin" && isTemplateArea(area);
    const section = await prisma.section.create({
      data: {
        title,
        titleEs,
        description: description || "",
        imageUrl,
        sortOrder,
        areaId,
        organizationId: ownerOrgIdForSection,
        isTemplate: isTemplateSection,
        sourceTemplateId: null,
        sourceVersion: 1,
        isCustomized: activeRole === "org_admin",
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

    if (ownerOrgIdForSection) {
      await prisma.organizationSectionConfig.upsert({
        where: {
          organizationId_sectionId: {
            organizationId: ownerOrgIdForSection,
            sectionId: section.id,
          },
        },
        update: {},
        create: {
          organizationId: ownerOrgIdForSection,
          sectionId: section.id,
          isVisible: true,
          sortOrder,
        },
      });
    }

    if (isTemplateSection) {
      await replicateTemplateSectionToAllOrgs(section.id);
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
