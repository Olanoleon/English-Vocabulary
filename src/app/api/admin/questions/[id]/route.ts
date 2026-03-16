import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;
    const body = await request.json();
    const { type, prompt, correctAnswer, vocabularyId, options } = body;
    const requestedOrgId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;

    const existing = await prisma.question.findUnique({
      where: { id },
      include: {
        module: {
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
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (
      activeRole === "org_admin" &&
      (existing.module.section.area.scopeType !== "org" ||
        existing.module.section.area.organizationId !== session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      activeRole !== "org_admin" &&
      existing.module.section.organizationId &&
      requestedOrgId !== existing.module.section.organizationId
    ) {
      return NextResponse.json(
        { error: "Select the correct organization context to edit this question." },
        { status: 403 }
      );
    }

    // Update question
    await prisma.question.update({
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");

    const existing = await prisma.question.findUnique({
      where: { id },
      include: {
        module: {
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
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (
      activeRole === "org_admin" &&
      (existing.module.section.area.scopeType !== "org" ||
        existing.module.section.area.organizationId !== session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      activeRole !== "org_admin" &&
      existing.module.section.organizationId &&
      requestedOrgId !== existing.module.section.organizationId
    ) {
      return NextResponse.json(
        { error: "Select the correct organization context to delete this question." },
        { status: 403 }
      );
    }

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
