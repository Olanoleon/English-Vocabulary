import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const { orderedIds, organizationId } = await request.json();

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
    }

    // org_admin always reorders within own org display config.
    // super_admin/admin can reorder globally (default) or a specific org config.
    const targetOrgId =
      session.role === "org_admin" ? session.organizationId : organizationId || null;

    if (session.role === "org_admin" && !targetOrgId) {
      return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
    }

    if (targetOrgId) {
      const scopedAreas = await prisma.area.findMany({
        where: {
          id: { in: orderedIds },
          OR: [
            { scopeType: "global" },
            { scopeType: "org", organizationId: targetOrgId },
          ],
        },
        select: { id: true },
      });
      if (scopedAreas.length !== orderedIds.length) {
        return NextResponse.json({ error: "Some areas are out of scope" }, { status: 403 });
      }

      await prisma.$transaction(
        orderedIds.map((id: string, index: number) =>
          prisma.organizationAreaConfig.upsert({
            where: {
              organizationId_areaId: {
                organizationId: targetOrgId,
                areaId: id,
              },
            },
            update: { sortOrder: index + 1, isVisible: true },
            create: {
              organizationId: targetOrgId,
              areaId: id,
              sortOrder: index + 1,
              isVisible: true,
            },
          })
        )
      );
    } else {
      // Global baseline ordering (super_admin/admin only)
      await prisma.$transaction(
        orderedIds.map((id: string, index: number) =>
          prisma.area.update({
            where: { id },
            data: { sortOrder: index + 1 },
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
