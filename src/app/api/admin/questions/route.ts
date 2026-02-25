import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const body = await request.json();
    const { moduleId, vocabularyId, type, prompt, correctAnswer, options } = body;

    if (!moduleId || !type || !prompt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const targetModule = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        section: {
          include: {
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
    if (!targetModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    if (
      session.role === "org_admin" &&
      (targetModule.section.area.scopeType !== "org" ||
        targetModule.section.area.organizationId !== session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get next sort order
    const lastQ = await prisma.question.findFirst({
      where: { moduleId },
      orderBy: { sortOrder: "desc" },
    });

    const question = await prisma.question.create({
      data: {
        moduleId,
        vocabularyId: vocabularyId || null,
        type,
        prompt,
        correctAnswer: correctAnswer || null,
        sortOrder: (lastQ?.sortOrder ?? 0) + 1,
        options: options
          ? {
              create: options.map(
                (opt: { optionText: string; isCorrect: boolean }, idx: number) => ({
                  optionText: opt.optionText,
                  isCorrect: opt.isCorrect || false,
                  sortOrder: idx + 1,
                })
              ),
            }
          : undefined,
      },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create question error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
