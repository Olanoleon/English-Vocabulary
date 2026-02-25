import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();
    const { organizationId, password } = body;

    const updateData: Record<string, unknown> = {};

    if (organizationId !== undefined) {
      if (!organizationId) {
        return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
      }
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, isActive: true },
      });
      if (!org || !org.isActive) {
        return NextResponse.json({ error: "Invalid or inactive organization" }, { status: 400 });
      }
      updateData.organizationId = organizationId;
      updateData.role = "org_admin";
    }

    if (password !== undefined) {
      const newPassword = String(password || "").trim();
      if (newPassword.length < 4) {
        return NextResponse.json(
          { error: "Password must be at least 4 characters" },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        organizationId: true,
      },
    });

    return NextResponse.json(user);
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
    await requireSuperAdmin();
    const { id } = await params;

    // Demote to learner and keep org assignment
    const user = await prisma.user.update({
      where: { id },
      data: {
        role: "learner",
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
