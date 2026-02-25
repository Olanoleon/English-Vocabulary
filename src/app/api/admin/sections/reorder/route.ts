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

    const targetOrgId =
      session.role === "org_admin" ? session.organizationId : organizationId || null;

    if (session.role === "org_admin" && !targetOrgId) {
      return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
    }

    if (targetOrgId) {
      const scopedSections = await prisma.section.findMany({
        where: {
          id: { in: orderedIds },
          area: {
            OR: [
              { scopeType: "global" },
              { scopeType: "org", organizationId: targetOrgId },
            ],
          },
        },
        select: { id: true },
      });
      if (scopedSections.length !== orderedIds.length) {
        return NextResponse.json({ error: "Some sections are out of scope" }, { status: 403 });
      }

      await prisma.$transaction(
        orderedIds.map((id: string, index: number) =>
          prisma.organizationSectionConfig.upsert({
            where: {
              organizationId_sectionId: {
                organizationId: targetOrgId,
                sectionId: id,
              },
            },
            update: { sortOrder: index + 1, isVisible: true },
            create: {
              organizationId: targetOrgId,
              sectionId: id,
              sortOrder: index + 1,
              isVisible: true,
            },
          })
        )
      );
    } else {
      await prisma.$transaction(
        orderedIds.map((id: string, index: number) =>
          prisma.section.update({
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
