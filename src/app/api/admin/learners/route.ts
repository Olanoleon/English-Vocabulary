import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const learners = await prisma.user.findMany({
      where: { role: "learner" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        createdAt: true,
        sectionProgress: {
          select: {
            sectionId: true,
            introCompleted: true,
            practiceCompleted: true,
            testPassed: true,
            testScore: true,
          },
        },
      },
    });
    return NextResponse.json(learners);
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
    await requireAdmin();
    const { username, password, displayName } = await request.json();

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: "Username, password, and display name are required" },
        { status: 400 }
      );
    }

    // Check existing
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        passwordHash,
        role: "learner",
        displayName,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        createdAt: true,
      },
    });

    // Auto-unlock first section
    const firstSection = await prisma.section.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    if (firstSection) {
      await prisma.learnerSectionProgress.create({
        data: {
          userId: user.id,
          sectionId: firstSection.id,
          unlocked: true,
          unlockedAt: new Date(),
        },
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create learner error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
