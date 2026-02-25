import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireSuperAdmin();
    const users = await prisma.user.findMany({
      where: { role: "org_admin" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        createdAt: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return NextResponse.json(users);
  } catch (error: unknown) {
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
    const { organizationId, userId, username, password, displayName } = body;

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

    if (userId) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          role: "org_admin",
          organizationId,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          organizationId: true,
        },
      });
      return NextResponse.json(updated);
    }

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: "username, password, and displayName are required when creating a new org admin" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { username: String(username).toLowerCase().trim() },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const created = await prisma.user.create({
      data: {
        username: String(username).toLowerCase().trim(),
        passwordHash,
        displayName: String(displayName).trim(),
        role: "org_admin",
        organizationId,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        organizationId: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
