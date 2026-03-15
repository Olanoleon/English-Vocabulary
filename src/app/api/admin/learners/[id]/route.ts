import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;

    // Org admins can only manage learners in their own organization.
    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        roleMemberships: {
          where: { role: "learner" },
          select: { id: true, organizationId: true },
        },
      },
    });
    if (!target || target.roleMemberships.length === 0) {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }
    if (
      activeRole === "org_admin" &&
      !target.roleMemberships.some((m) => m.organizationId === session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userRoleMembership.deleteMany({
        where: { userId: id, role: "learner" },
      });
      const remaining = await tx.userRoleMembership.findFirst({
        where: { userId: id },
        orderBy: { createdAt: "asc" },
        select: { role: true, organizationId: true },
      });
      if (remaining) {
        await tx.user.update({
          where: { id },
          data: {
            role: remaining.role,
            organizationId: remaining.organizationId ?? null,
          },
        });
      } else {
        await tx.user.delete({ where: { id } });
      }
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/admin/learners/:id — update access override
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;
    const body = await request.json();

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        roleMemberships: {
          where: { role: "learner" },
          select: { id: true, organizationId: true },
        },
      },
    });
    if (!target || target.roleMemberships.length === 0) {
      return NextResponse.json({ error: "Learner not found" }, { status: 404 });
    }
    if (
      activeRole === "org_admin" &&
      !target.roleMemberships.some((m) => m.organizationId === session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.accessOverride !== undefined) {
      // Validate value: null, "enabled", or "disabled"
      const valid = [null, "enabled", "disabled"];
      if (!valid.includes(body.accessOverride)) {
        return NextResponse.json(
          { error: "accessOverride must be null, 'enabled', or 'disabled'" },
          { status: 400 }
        );
      }
      updateData.accessOverride = body.accessOverride;
    }

    if (body.password !== undefined) {
      const newPassword = String(body.password || "").trim();
      if (activeRole === "org_admin") {
        return NextResponse.json(
          { error: "Only super admin can change learner passwords" },
          { status: 403 }
        );
      }
      if (newPassword.length < 4) {
        return NextResponse.json(
          { error: "Password must be at least 4 characters" },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (body.organizationId !== undefined) {
      if (activeRole === "org_admin") {
        return NextResponse.json(
          { error: "Only super admin can reassign learner organization" },
          { status: 403 }
        );
      }
      const nextOrganizationId = String(body.organizationId || "").trim();
      if (!nextOrganizationId) {
        return NextResponse.json(
          { error: "organizationId is required" },
          { status: 400 }
        );
      }
      const org = await prisma.organization.findUnique({
        where: { id: nextOrganizationId },
        select: { id: true, isActive: true },
      });
      if (!org || !org.isActive) {
        return NextResponse.json(
          { error: "Invalid or inactive organization" },
          { status: 400 }
        );
      }
      updateData.organizationId = org.id;
      const membershipToMove = target.roleMemberships[0];
      if (membershipToMove) {
        await prisma.userRoleMembership.update({
          where: { id: membershipToMove.id },
          data: { organizationId: org.id },
        });
      } else {
        await prisma.userRoleMembership.create({
          data: { userId: id, role: "learner", organizationId: org.id },
        });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        accessOverride: true,
        organizationId: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Update learner error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
