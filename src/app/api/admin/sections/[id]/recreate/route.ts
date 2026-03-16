import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import https from "https";
import path from "path";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { getUnitImageByTitle } from "@/lib/unit-image";
import { SECTION_GENERATION_SYSTEM_PROMPT } from "@/lib/section-generation-prompt";
import {
  ensureOrgSectionFromTemplateForOrg,
  replicateTemplateSectionToAllOrgs,
} from "@/lib/template-replication";

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getOpenAIKey(): string {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^OPENAI_API_KEY=["']?([^"'\r\n]+)["']?/m);
    if (match?.[1]) return match[1];
  } catch {
    // fallback
  }
  return process.env.OPENAI_API_KEY || "";
}

function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = getOpenAIKey();
  const payload = JSON.stringify({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res: import("http").IncomingMessage) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode !== 200) {
              const code = data?.error?.code || res.statusCode;
              const msg = data?.error?.message || "OpenAI request failed";
              reject(new Error(`OpenAI error (${code}): ${msg}`));
              return;
            }
            resolve(data.choices?.[0]?.message?.content || "");
          } catch {
            reject(new Error("Failed to parse OpenAI response"));
          }
        });
      }
    );
    req.on("error", (e: Error) =>
      reject(new Error(`OpenAI network error: ${e.message}`))
    );
    req.write(payload);
    req.end();
  });
}

const SYSTEM_PROMPT = SECTION_GENERATION_SYSTEM_PROMPT;

function pickString(
  source: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeGeneratedPayload(
  parsed: unknown,
  fallbackTitle: string,
  fallbackTitleEs: string
) {
  const payload =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};

  const title = pickString(payload, ["title", "name"]) || fallbackTitle;
  const titleEs =
    pickString(payload, ["titleEs", "title_es", "nameEs", "name_es"]) ||
    fallbackTitleEs ||
    title;
  const description = pickString(payload, ["description", "summary"]) || "";
  const readingTitle = pickString(payload, ["readingTitle", "reading_title"]);
  const readingText = pickString(payload, ["readingText", "reading_text"]) || "";

  const vocabularySource = Array.isArray(payload.vocabulary)
    ? payload.vocabulary
    : Array.isArray(payload.words)
      ? payload.words
      : [];

  const vocabulary = vocabularySource
    .map((item) => {
      const row =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : null;
      if (!row) return null;
      const word = pickString(row, ["word", "term"]);
      const definitionEs = pickString(row, [
        "definitionEs",
        "definition_es",
        "definition",
      ]);
      const exampleSentence = pickString(row, [
        "exampleSentence",
        "example_sentence",
        "example",
      ]);
      if (!word || !definitionEs || !exampleSentence) return null;
      return {
        word,
        partOfSpeech: pickString(row, ["partOfSpeech", "part_of_speech"]) || "noun",
        definitionEs,
        exampleSentence,
        phoneticIpa: pickString(row, ["phoneticIpa", "phonetic_ipa"]),
        stressedSyllable: pickString(row, ["stressedSyllable", "stressed_syllable"]),
      };
    })
    .filter(
      (
        v
      ): v is {
        word: string;
        partOfSpeech: string;
        definitionEs: string;
        exampleSentence: string;
        phoneticIpa: string | null;
        stressedSyllable: string | null;
      } => Boolean(v)
    );

  const normalizeQuestions = (
    value: unknown
  ): Array<{
    type: string;
    prompt: string;
    correctAnswer: string | null;
    pairs: unknown[] | undefined;
    options: Array<{ optionText: string; isCorrect: boolean }>;
  }> => {
    if (!Array.isArray(value)) return [];

    const out: Array<{
      type: string;
      prompt: string;
      correctAnswer: string | null;
      pairs: unknown[] | undefined;
      options: Array<{ optionText: string; isCorrect: boolean }>;
    }> = [];

    for (const item of value) {
      const row =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : null;
      if (!row) continue;

      const prompt = pickString(row, ["prompt", "question"]);
      if (!prompt) continue;

      const options: Array<{ optionText: string; isCorrect: boolean }> = [];
      if (Array.isArray(row.options)) {
        for (const opt of row.options) {
          const optRow =
            opt && typeof opt === "object"
              ? (opt as Record<string, unknown>)
              : null;
          if (!optRow) continue;
          const optionText = pickString(optRow, ["optionText", "text"]);
          if (!optionText) continue;
          options.push({
            optionText,
            isCorrect: Boolean(optRow.isCorrect),
          });
        }
      }

      out.push({
        type: pickString(row, ["type"]) || "multiple_choice",
        prompt,
        correctAnswer: pickString(row, ["correctAnswer", "correct_answer"]),
        pairs: Array.isArray(row.pairs) ? row.pairs : undefined,
        options,
      });
    }

    return out;
  };

  return {
    title,
    titleEs,
    description,
    readingTitle,
    readingText,
    vocabulary,
    practiceQuestions: normalizeQuestions(payload.practiceQuestions),
    testQuestions: normalizeQuestions(payload.testQuestions),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { id } = await params;

    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        modules: true,
        area: { select: { scopeType: true, organizationId: true, isTemplate: true } },
        sectionVocabulary: {
          include: { vocabulary: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    let targetSectionId = id;
    let effectiveSection = section;
    const isTemplate =
      Boolean(section.isTemplate) ||
      (section.area.scopeType === "global" && !section.area.organizationId);
    if (activeRole === "org_admin" && section.organizationId !== session.organizationId) {
      if (!session.organizationId || !isTemplate) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const copyId = await ensureOrgSectionFromTemplateForOrg(id, session.organizationId);
      if (!copyId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const copied = await prisma.section.findUnique({
        where: { id: copyId },
        include: {
          modules: true,
          area: { select: { scopeType: true, organizationId: true, isTemplate: true } },
          sectionVocabulary: {
            include: { vocabulary: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      if (!copied) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }
      targetSectionId = copyId;
      effectiveSection = copied;
    }

    let requestedIntroDifficulty: string | null = null;
    let requestedWordCount: number | null = null;
    let requestedSectionTitle: string | null = null;
    try {
      const body = (await request.json()) as {
        introDifficulty?: unknown;
        wordCount?: unknown;
        sectionTitle?: unknown;
      };
      if (typeof body.introDifficulty === "string") {
        requestedIntroDifficulty = body.introDifficulty.trim().toLowerCase();
      }
      if (typeof body.wordCount === "number" && Number.isFinite(body.wordCount)) {
        requestedWordCount = Math.round(body.wordCount);
      } else if (typeof body.wordCount === "string" && body.wordCount.trim()) {
        const parsed = Number.parseInt(body.wordCount, 10);
        if (Number.isFinite(parsed)) requestedWordCount = parsed;
      }
      if (typeof body.sectionTitle === "string" && body.sectionTitle.trim()) {
        requestedSectionTitle = body.sectionTitle.trim();
      }
    } catch {
      // Allow empty body to preserve existing behavior.
    }

    const introModule = effectiveSection.modules.find((m) => m.type === "introduction");
    const practiceModule = effectiveSection.modules.find((m) => m.type === "practice");
    const testModule = effectiveSection.modules.find((m) => m.type === "test");
    if (!introModule || !practiceModule || !testModule) {
      return NextResponse.json(
        { error: "Section is missing introduction/practice/test modules" },
        { status: 400 }
      );
    }
    const sectionModuleIds = effectiveSection.modules.map((m) => m.id);

    const currentWordCount = Math.max(
      1,
      Math.min(60, requestedWordCount ?? effectiveSection.sectionVocabulary.length)
    );
    const promptSectionTitle = requestedSectionTitle || effectiveSection.title;
    const normalizedDifficulty = String(
      ((introModule.content as { readingDifficulty?: string } | null)
        ?.readingDifficulty || "medium")
    ).toLowerCase();
    const introDifficulty = ["easy", "medium", "advanced"].includes(
      requestedIntroDifficulty || ""
    )
      ? (requestedIntroDifficulty as "easy" | "medium" | "advanced")
      : ["easy", "medium", "advanced"].includes(normalizedDifficulty)
        ? normalizedDifficulty
        : "medium";

    const difficultyGuidance =
      introDifficulty === "easy"
        ? "Easy: short sentences, simple connectors, straightforward grammar, very clear context clues."
        : introDifficulty === "advanced"
        ? "Advanced: longer and more varied sentence structures, richer connectors, nuanced context, and more complex discourse flow."
        : "Medium: moderate sentence length, mixed simple/complex structures, natural conversational-academic balance.";
    const vocabularyDifficultyGuidance =
      introDifficulty === "easy"
        ? "Vocabulary difficulty target: mostly A1-A2 words. Prefer highly frequent, concrete, and immediately useful terms. Avoid low-frequency or highly technical words."
        : introDifficulty === "advanced"
        ? "Vocabulary difficulty target: B2-C1 words. Prefer more nuanced, less frequent, and context-rich terms that are still clearly connected to the topic."
        : "Vocabulary difficulty target: mostly B1 words. Prefer practical vocabulary with moderate lexical richness and variety.";

    const practiceCount = Math.min(currentWordCount * 2, 20);
    const testCount = Math.min(
      20,
      Math.max(10, Math.round(10 + ((currentWordCount - 5) / 15) * 10))
    );
    const matchingPairs =
      currentWordCount >= 3
        ? Math.min(
            currentWordCount,
            currentWordCount <= 6 ? 3 : currentWordCount <= 12 ? 4 : 5
          )
        : 0;
    const practiceRegularCount = Math.max(1, practiceCount - matchingPairs);
    const testRegularCount = Math.max(1, testCount - matchingPairs);
    const matchingInstruction =
      matchingPairs > 0
        ? `\nMatching pairs: ${matchingPairs} word pairs per matching question (generate 1 matching question for practice + 1 for test)`
        : "";

    const content = await callOpenAI(
      SYSTEM_PROMPT,
      `Generate a complete vocabulary section for the topic: "${promptSectionTitle}"
Number of vocabulary words: ${currentWordCount}
Required regular practice questions: exactly ${practiceRegularCount}
Required regular test questions: exactly ${testRegularCount}${matchingInstruction}
Introduction reading difficulty: ${introDifficulty}
Difficulty style guidance: ${difficultyGuidance}
Apply this same difficulty level to vocabulary selection as well.
${vocabularyDifficultyGuidance}

Return the JSON object now.`
    );

    if (!content) {
      return NextResponse.json(
        { error: "OpenAI returned an empty response" },
        { status: 502 }
      );
    }

    let generated: ReturnType<typeof normalizeGeneratedPayload>;

    try {
      const parsed = JSON.parse(content);
      generated = normalizeGeneratedPayload(
        parsed,
        effectiveSection.title,
        effectiveSection.titleEs
      );
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    if (!Array.isArray(generated.vocabulary) || generated.vocabulary.length === 0) {
      return NextResponse.json(
        { error: "AI response did not include valid vocabulary items. Please try again." },
        { status: 502 }
      );
    }

    const oldVocabularyIds = effectiveSection.sectionVocabulary.map(
      (sv) => sv.vocabulary.id
    );
    const imageUrl = await getUnitImageByTitle(generated.title, {
      kind: "section",
    });

    await prisma.$transaction(
      async (tx) => {
        await tx.learnerAttempt.deleteMany({
          where: { moduleId: { in: sectionModuleIds } },
        });
        await tx.question.deleteMany({
          where: { moduleId: { in: sectionModuleIds } },
        });
        await tx.learnerSectionProgress.updateMany({
          where: { sectionId: targetSectionId },
          data: {
            introCompleted: false,
            practiceCompleted: false,
            testPassed: false,
            testScore: null,
          },
        });

        await tx.section.update({
          where: { id: targetSectionId },
          data: {
            title: generated.title,
            titleEs: generated.titleEs,
            description: generated.description || "",
            imageUrl,
            ...(activeRole === "org_admin"
              ? { isCustomized: true }
              : isTemplate
                ? { sourceVersion: { increment: 1 } }
                : {}),
          },
        });

        await tx.module.update({
          where: { id: introModule.id },
          data: {
            content: {
              readingTitle: generated.readingTitle || generated.title,
              readingText: generated.readingText || "",
              readingDifficulty: introDifficulty,
            },
          },
        });

        await tx.sectionVocabulary.deleteMany({ where: { sectionId: targetSectionId } });
        if (oldVocabularyIds.length > 0) {
          await tx.vocabulary.deleteMany({ where: { id: { in: oldVocabularyIds } } });
        }

        for (let i = 0; i < generated.vocabulary.length; i++) {
          const v = generated.vocabulary[i];
          await tx.vocabulary.create({
            data: {
              word: v.word,
              partOfSpeech: v.partOfSpeech || "noun",
              definitionEs: v.definitionEs,
              exampleSentence: v.exampleSentence,
              phoneticIpa: v.phoneticIpa || null,
              stressedSyllable: v.stressedSyllable || null,
              sectionVocabulary: {
                create: {
                  sectionId: targetSectionId,
                  sortOrder: i + 1,
                },
              },
            },
          });
        }

        if (Array.isArray(generated.practiceQuestions)) {
          for (let i = 0; i < generated.practiceQuestions.length; i++) {
            const q = generated.practiceQuestions[i];
            const correctAnswer =
              q.type === "matching" && Array.isArray(q.pairs)
                ? JSON.stringify(q.pairs)
                : q.correctAnswer || null;
            const shuffledOptions =
              Array.isArray(q.options) && q.options.length > 0
                ? shuffleArray(q.options)
                : [];

            await tx.question.create({
              data: {
                moduleId: practiceModule.id,
                type: q.type || "multiple_choice",
                prompt: q.prompt,
                correctAnswer,
                sortOrder: i + 1,
                options:
                  shuffledOptions.length > 0
                    ? {
                        create: shuffledOptions.map((o, idx) => ({
                          optionText: o.optionText,
                          isCorrect: o.isCorrect || false,
                          sortOrder: idx + 1,
                        })),
                      }
                    : undefined,
              },
            });
          }
        }

        if (Array.isArray(generated.testQuestions)) {
          for (let i = 0; i < generated.testQuestions.length; i++) {
            const q = generated.testQuestions[i];
            const correctAnswer =
              q.type === "matching" && Array.isArray(q.pairs)
                ? JSON.stringify(q.pairs)
                : q.correctAnswer || null;
            const shuffledOptions =
              Array.isArray(q.options) && q.options.length > 0
                ? shuffleArray(q.options)
                : [];

            await tx.question.create({
              data: {
                moduleId: testModule.id,
                type: q.type || "multiple_choice",
                prompt: q.prompt,
                correctAnswer,
                sortOrder: i + 1,
                options:
                  shuffledOptions.length > 0
                    ? {
                        create: shuffledOptions.map((o, idx) => ({
                          optionText: o.optionText,
                          isCorrect: o.isCorrect || false,
                          sortOrder: idx + 1,
                        })),
                      }
                    : undefined,
              },
            });
          }
        }
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      }
    );

    const replicationQueued = activeRole !== "org_admin" && isTemplate;
    if (replicationQueued) {
      // Fire-and-forget so recreate returns immediately.
      void replicateTemplateSectionToAllOrgs(targetSectionId).catch((replicationError) => {
        console.error("Template replication after recreate failed:", replicationError);
      });
    }

    return NextResponse.json({
      success: true,
      sectionId: targetSectionId,
      wordCount: generated.vocabulary.length,
      practiceQuestionCount: generated.practiceQuestions?.length || 0,
      testQuestionCount: generated.testQuestions?.length || 0,
      replicationQueued,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Recreate unit error:", error);
    return NextResponse.json(
      { error: `Failed to recreate unit: ${message}` },
      { status: 500 }
    );
  }
}

