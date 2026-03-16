import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { getUnitImageByTitle } from "@/lib/unit-image";
import { replicateTemplateAreaToAllOrgs } from "@/lib/template-replication";

function isTemplateArea(area: {
  isTemplate: boolean;
  scopeType: string;
  organizationId: string | null;
}) {
  return area.isTemplate || (area.scopeType === "global" && !area.organizationId);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;

    const area = await prisma.area.findUnique({
      where: { id },
      include: {
        _count: { select: { sections: true } },
      },
    });

    if (!area) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    if (activeRole === "org_admin" && area.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(area);
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

    const existing = await prisma.area.findUnique({
      where: { id },
      select: {
        id: true,
        scopeType: true,
        organizationId: true,
        isTemplate: true,
        sourceVersion: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    if (activeRole === "org_admin" && existing.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextImageUrl =
      body.regenerateImage && body.name
        ? await getUnitImageByTitle(body.name, { strict: true, kind: "area" })
        : undefined;

    const data = {
      name: body.name,
      nameEs: body.nameEs,
      description: body.description,
      isActive: body.isActive,
      ...(nextImageUrl ? { imageUrl: nextImageUrl } : {}),
    };

    const area = await prisma.area.update({
      where: { id },
      data:
        activeRole === "org_admin"
          ? { ...data, isCustomized: true }
          : isTemplateArea(existing)
            ? { ...data, sourceVersion: existing.sourceVersion + 1 }
            : data,
    });

    if (activeRole !== "org_admin" && isTemplateArea(existing)) {
      await replicateTemplateAreaToAllOrgs(id);
    }

    return NextResponse.json(area);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Update area error:", error);
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

    const existing = await prisma.area.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        scopeType: true,
        isTemplate: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    // org_admin can only delete org-owned areas in their own org.
    if (activeRole === "org_admin" && existing.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (activeRole !== "org_admin" && isTemplateArea(existing)) {
      await prisma.area.updateMany({
        where: { sourceTemplateId: id },
        data: { sourceTemplateId: null, isCustomized: true },
      });
    }

    await prisma.area.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
