import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;
    const body = await request.json();
    const requestedOrgId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;

    const existing = await prisma.module.findUnique({
      where: { id },
      include: {
        section: {
          select: {
            organizationId: true,
            area: {
              select: {
                scopeType: true,
                organizationId: true,
              },
            },
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    if (
      activeRole === "org_admin" &&
      (existing.section.area.scopeType !== "org" ||
        existing.section.organizationId !== session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      activeRole !== "org_admin" &&
      existing.section.organizationId &&
      requestedOrgId !== existing.section.organizationId
    ) {
      return NextResponse.json(
        { error: "Select the correct organization context to edit this module." },
        { status: 403 }
      );
    }

    const updatedModule = await prisma.module.update({
      where: { id },
      data: {
        content: body.content,
      },
    });

    return NextResponse.json(updatedModule);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
