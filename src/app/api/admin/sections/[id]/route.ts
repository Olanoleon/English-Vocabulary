import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { getUnitImageByTitle } from "@/lib/unit-image";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
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
          },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (
      session.role === "org_admin" &&
      ((section.area.scopeType === "org" &&
        section.area.organizationId !== session.organizationId) ||
        (section.organizationId &&
          section.organizationId !== session.organizationId))
    ) {
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
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.section.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        area: { select: { scopeType: true, organizationId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    // org_admin can only edit org-owned sections in their own org.
    if (
      session.role === "org_admin" &&
      !(
        existing.organizationId === session.organizationId ||
        (existing.area.scopeType === "org" &&
          existing.area.organizationId === session.organizationId)
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextImageUrl =
      body.regenerateImage && body.title
        ? await getUnitImageByTitle(body.title, { strict: true, kind: "section" })
        : undefined;

    const section = await prisma.section.update({
      where: { id },
      data: {
        title: body.title,
        titleEs: body.titleEs,
        description: body.description,
        isActive: body.isActive,
        ...(nextImageUrl ? { imageUrl: nextImageUrl } : {}),
      },
    });

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
    const { id } = await params;

    const existing = await prisma.section.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        area: { select: { scopeType: true, organizationId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (
      session.role === "org_admin" &&
      !(
        existing.organizationId === session.organizationId ||
        (existing.area.scopeType === "org" &&
          existing.area.organizationId === session.organizationId)
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
