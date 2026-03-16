import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { getUnitImageByTitle } from "@/lib/unit-image";
import { replicateTemplateSectionToAllOrgs } from "@/lib/template-replication";

function isTemplateSection(section: {
  isTemplate: boolean;
  organizationId: string | null;
  area: {
    isTemplate?: boolean;
    scopeType: string;
    organizationId: string | null;
  };
}) {
  if (section.isTemplate) return true;
  if (section.organizationId) return false;
  return Boolean(section.area.isTemplate) || (section.area.scopeType === "global" && !section.area.organizationId);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;
    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            questions: {
              include: { options: { orderBy: { sortOrder: "asc" } } },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        sectionVocabulary: {
          include: { vocabulary: true },
          orderBy: { sortOrder: "asc" },
        },
        area: {
          select: {
            scopeType: true,
            organizationId: true,
            isTemplate: true,
          },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (activeRole === "org_admin" && section.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(section);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.section.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        isTemplate: true,
        sourceVersion: true,
        area: { select: { scopeType: true, organizationId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    // org_admin can only edit org-owned sections in their own org.
    if (activeRole === "org_admin" && existing.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextImageUrl =
      body.regenerateImage && body.title
        ? await getUnitImageByTitle(body.title, { strict: true, kind: "section" })
        : undefined;

    const section = await prisma.section.update({
      where: { id },
      data:
        activeRole === "org_admin"
          ? {
              title: body.title,
              titleEs: body.titleEs,
              description: body.description,
              isActive: body.isActive,
              isCustomized: true,
              ...(nextImageUrl ? { imageUrl: nextImageUrl } : {}),
            }
          : isTemplateSection(existing)
            ? {
                title: body.title,
                titleEs: body.titleEs,
                description: body.description,
                isActive: body.isActive,
                sourceVersion: existing.sourceVersion + 1,
                ...(nextImageUrl ? { imageUrl: nextImageUrl } : {}),
              }
            : {
                title: body.title,
                titleEs: body.titleEs,
                description: body.description,
                isActive: body.isActive,
                ...(nextImageUrl ? { imageUrl: nextImageUrl } : {}),
              },
    });

    if (activeRole !== "org_admin" && isTemplateSection(existing)) {
      // Keep section updates fast (e.g., regenerate image) and replicate in background.
      void replicateTemplateSectionToAllOrgs(id).catch((replicationError) => {
        console.error("Template section replication failed:", replicationError);
      });
    }

    return NextResponse.json(section);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Update section error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;

    const existing = await prisma.section.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        isTemplate: true,
        area: { select: { scopeType: true, organizationId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (activeRole === "org_admin" && existing.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (activeRole !== "org_admin" && isTemplateSection(existing)) {
      await prisma.section.updateMany({
        where: { sourceTemplateId: id },
        data: { sourceTemplateId: null, isCustomized: true },
      });
    }

    await prisma.section.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
