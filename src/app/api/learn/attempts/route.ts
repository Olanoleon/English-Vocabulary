import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { moduleId, answers } = await request.json();

    if (!moduleId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get the module to find section
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { section: true },
    });

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Create attempt
    const attempt = await prisma.learnerAttempt.create({
      data: {
        userId: session.userId,
        moduleId,
        startedAt: new Date(),
      },
    });

    // Process answers
    let correctCount = 0;
    const answerRecords = [];

    for (const ans of answers) {
      let isCorrect = false;

      if (ans.selectedOptionId) {
        const option = await prisma.questionOption.findUnique({
          where: { id: ans.selectedOptionId },
        });
        isCorrect = option?.isCorrect || false;
      } else if (ans.answerText) {
        const question = await prisma.question.findUnique({
          where: { id: ans.questionId },
        });
        isCorrect =
          question?.correctAnswer?.toLowerCase().trim() ===
          ans.answerText.toLowerCase().trim();
      }

      if (isCorrect) correctCount++;

      answerRecords.push({
        attemptId: attempt.id,
        questionId: ans.questionId,
        selectedOptionId: ans.selectedOptionId || null,
        answerText: ans.answerText || null,
        isCorrect,
      });
    }

    // Save all answers
    await prisma.learnerAnswer.createMany({ data: answerRecords });

    // Calculate score
    const score = answers.length > 0 ? (correctCount / answers.length) * 100 : 0;
    const passed = score >= 80;

    // Update attempt
    await prisma.learnerAttempt.update({
      where: { id: attempt.id },
      data: {
        score,
        passed,
        completedAt: new Date(),
      },
    });

    // Update section progress
    if (module.type === "test") {
      await prisma.learnerSectionProgress.upsert({
        where: {
          userId_sectionId: {
            userId: session.userId,
            sectionId: module.sectionId,
          },
        },
        create: {
          userId: session.userId,
          sectionId: module.sectionId,
          unlocked: true,
          unlockedAt: new Date(),
          testScore: score,
          testPassed: passed,
        },
        update: {
          testScore: score,
          testPassed: passed,
        },
      });

      // If passed, unlock next section
      if (passed) {
        const nextSection = await prisma.section.findFirst({
          where: {
            isActive: true,
            sortOrder: { gt: module.section.sortOrder },
          },
          orderBy: { sortOrder: "asc" },
        });

        if (nextSection) {
          await prisma.learnerSectionProgress.upsert({
            where: {
              userId_sectionId: {
                userId: session.userId,
                sectionId: nextSection.id,
              },
            },
            create: {
              userId: session.userId,
              sectionId: nextSection.id,
              unlocked: true,
              unlockedAt: new Date(),
            },
            update: {
              unlocked: true,
              unlockedAt: new Date(),
            },
          });
        }
      }
    } else if (module.type === "practice") {
      // Mark practice as completed
      await prisma.learnerSectionProgress.upsert({
        where: {
          userId_sectionId: {
            userId: session.userId,
            sectionId: module.sectionId,
          },
        },
        create: {
          userId: session.userId,
          sectionId: module.sectionId,
          unlocked: true,
          unlockedAt: new Date(),
          practiceCompleted: true,
        },
        update: {
          practiceCompleted: true,
        },
      });
    }

    return NextResponse.json({
      attemptId: attempt.id,
      score,
      passed,
      correctCount,
      totalQuestions: answers.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Submit attempt error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
