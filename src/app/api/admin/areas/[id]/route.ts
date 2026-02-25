import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { matchEmoji } from "@/lib/logo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
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
    if (
      session.role === "org_admin" &&
      !(area.scopeType === "global" || area.organizationId === session.organizationId)
    ) {
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
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.area.findUnique({
      where: { id },
      select: { id: true, scopeType: true, organizationId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    if (
      session.role === "org_admin" &&
      existing.organizationId !== session.organizationId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const area = await prisma.area.update({
      where: { id },
      data: {
        name: body.name,
        nameEs: body.nameEs,
        description: body.description,
        isActive: body.isActive,
        ...(body.regenerateImage && body.name ? { imageUrl: matchEmoji(body.name) } : {}),
      },
    });

    return NextResponse.json(area);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const { id } = await params;

    const existing = await prisma.area.findUnique({
      where: { id },
      select: { id: true, organizationId: true, scopeType: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    // org_admin can only delete org-owned areas in their own org.
    if (
      session.role === "org_admin" &&
      existing.organizationId !== session.organizationId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
