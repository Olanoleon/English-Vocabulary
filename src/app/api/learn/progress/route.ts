import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { sectionId, type } = await request.json();

    if (!sectionId || !type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Upsert progress
    const data: Record<string, boolean | Date> = {};
    if (type === "intro") {
      data.introCompleted = true;
    } else if (type === "practice") {
      data.practiceCompleted = true;
    }

    const progress = await prisma.learnerSectionProgress.upsert({
      where: {
        userId_sectionId: {
          userId: session.userId,
          sectionId,
        },
      },
      create: {
        userId: session.userId,
        sectionId,
        unlocked: true,
        unlockedAt: new Date(),
        ...(type === "intro" ? { introCompleted: true } : {}),
        ...(type === "practice" ? { practiceCompleted: true } : {}),
      },
      update: data,
    });

    return NextResponse.json(progress);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
