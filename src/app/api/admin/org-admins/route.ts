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

export async function GET() {
  try {
    await requireSuperAdmin();
    const users = await prisma.user.findMany({
      where: { roleMemberships: { some: { role: "org_admin" } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        createdAt: true,
        roleMemberships: {
          where: { role: "org_admin" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        createdAt: u.createdAt,
        organizationId: u.roleMemberships[0]?.organizationId ?? null,
        organization: u.roleMemberships[0]?.organization ?? null,
      }))
    );
  } catch (error: unknown) {
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

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    const { organizationId, userId, password, displayName, email } = body;
    const normalizedEmail = normalizeEmail(email);

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

    if (!normalizedEmail || !displayName) {
      return NextResponse.json(
        { error: "email and displayName are required when creating a new org admin" },
        { status: 400 }
      );
    }
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "A valid email is required for org admins" },
        { status: 400 }
      );
    }

    const existingById = userId
      ? await prisma.user.findUnique({
          where: { id: String(userId) },
          select: { id: true, email: true, username: true, displayName: true },
        })
      : null;
    const existingByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, username: true, displayName: true },
    });
    const target = existingById || existingByEmail;

    const result = await prisma.$transaction(async (tx) => {
      let user = target;
      if (!user) {
        if (!password || String(password).trim().length < 4) {
          throw new Error("Password must be at least 4 characters");
        }
        const passwordHash = await bcrypt.hash(String(password).trim(), 10);
        user = await tx.user.create({
          data: {
            username: normalizedEmail,
            email: normalizedEmail,
            passwordHash,
            role: "org_admin",
            displayName: String(displayName).trim(),
            organizationId,
          },
          select: { id: true, email: true, username: true, displayName: true },
        });
      } else {
        const updateData: Record<string, unknown> = {
          email: normalizedEmail,
          username: normalizedEmail,
          displayName: String(displayName).trim(),
        };
        if (password !== undefined && String(password).trim()) {
          if (String(password).trim().length < 4) {
            throw new Error("Password must be at least 4 characters");
          }
          updateData.passwordHash = await bcrypt.hash(String(password).trim(), 10);
        }
        user = await tx.user.update({
          where: { id: user.id },
          data: updateData,
          select: { id: true, email: true, username: true, displayName: true },
        });
      }

      const existingOrgAdminMembership = await tx.userRoleMembership.findFirst({
        where: { userId: user.id, role: "org_admin", organizationId },
        select: { id: true },
      });
      if (!existingOrgAdminMembership) {
        await tx.userRoleMembership.create({
          data: {
            userId: user.id,
            role: "org_admin",
            organizationId,
          },
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: { role: "org_admin" },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          role: true,
        },
      });
    });

    return NextResponse.json(result, { status: target ? 200 : 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Password must be at least 4 characters") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Email or username already exists" }, { status: 409 });
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
