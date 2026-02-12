import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { type, prompt, correctAnswer, vocabularyId, options } = body;

    // Update question
    const question = await prisma.question.update({
      where: { id },
      data: {
        type,
        prompt,
        correctAnswer: correctAnswer || null,
        vocabularyId: vocabularyId || null,
      },
    });

    // Replace options if provided
    if (options) {
      await prisma.questionOption.deleteMany({ where: { questionId: id } });
      await prisma.questionOption.createMany({
        data: options.map(
          (opt: { optionText: string; isCorrect: boolean }, idx: number) => ({
            questionId: id,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect || false,
            sortOrder: idx + 1,
          })
        ),
      });
    }

    const updated = await prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json(updated);
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
    await requireAdmin();
    const { id } = await params;
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
