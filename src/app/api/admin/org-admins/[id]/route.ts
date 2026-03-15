import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { isValidEmail, normalizeEmail } from "@/lib/roles";

function isMissingEmailColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
  const maybeMessage =
    "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return maybeCode === "P2022" && maybeMessage.toLowerCase().includes("email");
}

function isUnknownEmailFieldValidationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeName = "name" in error ? String((error as { name?: unknown }).name || "") : "";
  const maybeMessage =
    "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return (
    maybeName === "PrismaClientValidationError" &&
    maybeMessage.includes("Unknown field `email`")
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();
    const { organizationId, password, email } = body;

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

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        return NextResponse.json(
          { error: "A valid email is required for org admins" },
          { status: 400 }
        );
      }
      updateData.email = normalizedEmail;
      updateData.username = normalizedEmail;
      updateData.role = "org_admin";
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const user = await prisma.$transaction(async (tx) => {
      if (organizationId !== undefined) {
        const existingMembership = await tx.userRoleMembership.findFirst({
          where: { userId: id, role: "org_admin" },
          select: { id: true },
        });
        if (existingMembership) {
          await tx.userRoleMembership.update({
            where: { id: existingMembership.id },
            data: { organizationId },
          });
        } else {
          await tx.userRoleMembership.create({
            data: {
              userId: id,
              role: "org_admin",
              organizationId,
            },
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          role: true,
          organizationId: true,
        },
      });
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    if (isMissingEmailColumnError(error) || isUnknownEmailFieldValidationError(error)) {
      return NextResponse.json(
        {
          error:
            "Email support is unavailable until schema/client sync. Run `npm run db:push` and restart the server.",
        },
        { status: 500 }
      );
    }
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

    const user = await prisma.$transaction(async (tx) => {
      await tx.userRoleMembership.deleteMany({
        where: { userId: id, role: "org_admin" },
      });
      const remaining = await tx.userRoleMembership.findFirst({
        where: { userId: id },
        orderBy: { createdAt: "asc" },
        select: { role: true, organizationId: true },
      });
      return tx.user.update({
        where: { id },
        data: {
          role: remaining?.role || "learner",
          organizationId: remaining?.organizationId ?? null,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
        },
      });
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
