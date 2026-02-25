import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const orgId = session.organizationId || null;
    const { moduleId, answers } = await request.json();

    if (!moduleId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get the module to find section
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        section: {
          include: {
            area: {
              include: {
                orgConfigs: {
                  where: { organizationId: orgId || "__no_org__" },
                  take: 1,
                },
              },
            },
            orgConfigs: {
              where: { organizationId: orgId || "__no_org__" },
              take: 1,
            },
          },
        },
      },
    });

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const scopeAllowed =
      module.section.isActive &&
      module.section.area.isActive &&
      (module.section.area.scopeType === "global" ||
        (orgId !== null &&
          module.section.area.scopeType === "org" &&
          module.section.area.organizationId === orgId));
    if (!scopeAllowed) {
      return NextResponse.json({ error: "Section not available" }, { status: 403 });
    }
    if (orgId) {
      const areaCfg = module.section.area.orgConfigs[0];
      const sectionCfg = module.section.orgConfigs[0];
      if ((areaCfg && !areaCfg.isVisible) || (sectionCfg && !sectionCfg.isVisible)) {
        return NextResponse.json({ error: "Section not available" }, { status: 403 });
      }
    }

    // Create attempt
    const attempt = await prisma.learnerAttempt.create({
      data: {
        userId: session.userId,
        moduleId,
        startedAt: new Date(),
      },
    });

    // Process answers — matching questions count each pair as a separate point
    let totalPoints = 0;
    let correctPoints = 0;
    const answerRecords = [];

    for (const ans of answers) {
      // Look up the question to determine type
      const question = await prisma.question.findUnique({
        where: { id: ans.questionId },
      });

      if (question?.type === "matching" && ans.answerText) {
        // Matching: each correct pair = 1 point
        try {
          const correctPairs: { word: string; definition: string }[] = JSON.parse(
            question.correctAnswer || "[]"
          );
          const learnerPairings: Record<string, string> = JSON.parse(
            ans.answerText || "{}"
          );
          let pairsCorrect = 0;
          for (const pair of correctPairs) {
            if (learnerPairings[pair.word] === pair.definition) {
              pairsCorrect++;
            }
          }
          totalPoints += correctPairs.length;
          correctPoints += pairsCorrect;
          answerRecords.push({
            attemptId: attempt.id,
            questionId: ans.questionId,
            selectedOptionId: null,
            answerText: ans.answerText,
            isCorrect: pairsCorrect === correctPairs.length,
          });
        } catch {
          // If JSON parse fails, treat as wrong
          totalPoints += 1;
          answerRecords.push({
            attemptId: attempt.id,
            questionId: ans.questionId,
            selectedOptionId: null,
            answerText: ans.answerText || null,
            isCorrect: false,
          });
        }
      } else {
        // Regular question: 1 point
        totalPoints += 1;
        let isCorrect = false;

        if (ans.selectedOptionId) {
          const option = await prisma.questionOption.findUnique({
            where: { id: ans.selectedOptionId },
          });
          isCorrect = option?.isCorrect || false;
        } else if (ans.answerText && question) {
          isCorrect =
            question.correctAnswer?.toLowerCase().trim() ===
            ans.answerText.toLowerCase().trim();
        }

        if (isCorrect) correctPoints++;

        answerRecords.push({
          attemptId: attempt.id,
          questionId: ans.questionId,
          selectedOptionId: ans.selectedOptionId || null,
          answerText: ans.answerText || null,
          isCorrect,
        });
      }
    }

    // Save all answers
    await prisma.learnerAnswer.createMany({ data: answerRecords });

    // Calculate score — total points includes matching pair counts
    const score = totalPoints > 0 ? (correctPoints / totalPoints) * 100 : 0;
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
        // Scope next unlock to the same area and org-visible sections only.
        const areaSections = await prisma.section.findMany({
          where: {
            isActive: true,
            areaId: module.section.areaId,
          },
          orderBy: { sortOrder: "asc" },
          include: {
            orgConfigs: {
              where: { organizationId: orgId || "__no_org__" },
              take: 1,
            },
          },
        });

        const visibleAreaSections = areaSections
          .filter((s) => {
            if (!orgId) return true;
            const cfg = s.orgConfigs[0];
            return cfg ? cfg.isVisible : true;
          })
          .sort((a, b) => {
            const aOrder = orgId ? (a.orgConfigs[0]?.sortOrder ?? a.sortOrder) : a.sortOrder;
            const bOrder = orgId ? (b.orgConfigs[0]?.sortOrder ?? b.sortOrder) : b.sortOrder;
            return aOrder - bOrder;
          });

        const currentIndex = visibleAreaSections.findIndex((s) => s.id === module.sectionId);
        const nextSection =
          currentIndex >= 0 ? visibleAreaSections[currentIndex + 1] : null;

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
      correctCount: correctPoints,
      totalQuestions: totalPoints,
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
