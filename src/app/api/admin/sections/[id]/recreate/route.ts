import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import https from "https";
import path from "path";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { getUnitImageByTitle } from "@/lib/unit-image";

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

const SYSTEM_PROMPT = `You are an expert ESL curriculum designer creating English vocabulary learning content for native Spanish speakers at the B1-B2 level.

You must return a single valid JSON object (no markdown, no code fences) with the exact structure below. Follow every rule precisely:

VOCABULARY RULES:
- Choose words that are genuinely useful for the given topic
- Words should be B1-B2 CEFR level — not too basic (no "hello", "table"), not too advanced (no "obsequious")
- Spanish definitions must be natural and accurate, as a Spanish teacher would explain them — never machine-translated
- Example sentences must clearly demonstrate the word's meaning in context
- IPA transcription must be accurate American English
- stressed_syllable should be the syllable that carries primary stress, written in lowercase

INTRODUCTION READING:
- Write a short engaging passage (80-150 words) that naturally uses ALL vocabulary words
- Wrap each vocabulary word with double asterisks like **word** so it can be highlighted
- The passage should read like a natural story or scenario, not a list of definitions
- The user will provide a target reading difficulty (easy, medium, or advanced). You MUST adapt sentence length, grammar complexity, and discourse markers to match that difficulty while still using the same vocabulary naturally.

PRACTICE QUESTIONS:
- You MUST generate the exact number of regular practice questions specified in the user prompt. This is a hard requirement — do NOT generate fewer.
- ADDITIONALLY, if the user prompt specifies "matching pairs", generate exactly 1 "matching" question (see MATCHING QUESTION rules below) and include it as the LAST item in the practiceQuestions array.
- Focus on WORD DEFINITIONS
- Every vocabulary word MUST appear in at least one practice question (either as the subject of a definition question, or as the correct answer in a reverse/fill_blank/phonetics question)
- Regular questions should be a mix of four styles:
  1. "multiple_choice" (definition): "What is the definition of 'word'?" with 4 Spanish definition options (1 correct, 3 plausible distractors) — about 30%
  2. "multiple_choice" (reverse): "Which English word means 'definición en español'?" with 4 English word options from the vocabulary list — about 30%
  3. "fill_blank": A sentence where the vocabulary word fits naturally. It can be extracted/adapted from the reading OR be a new sentence with strong contextual clues. Set correct_answer to the word. — about 25%
  4. "phonetics": Pronunciation questions using styles from the PHONETICS RULES section below — about 15%
- All options arrays must have exactly 4 items for multiple_choice and phonetics, 0 items for fill_blank and matching
- IMPORTANT fill_blank quality rules:
  - Each fill_blank prompt must have exactly ONE blank written as "___"
  - The sentence must contain enough semantic context to infer the target word (avoid vague templates like "I saw a ___")
  - There must be one clearly best answer from the section vocabulary list
  - If using a reading-derived sentence, adapt it if needed to keep context clear as a standalone question

TEST QUESTIONS:
- You MUST generate the exact number of regular test questions specified in the user prompt. This is a hard requirement — do NOT generate fewer.
- ADDITIONALLY, if the user prompt specifies "matching pairs", generate exactly 1 "matching" question (see MATCHING QUESTION rules below) and include it as the LAST item in the testQuestions array.
- Regular questions: mix of "multiple_choice", "fill_blank", and "phonetics" types
- At least 30% should be "phonetics" type
- multiple_choice and fill_blank: same definition-focused rules and fill_blank quality constraints as practice
- Phonetics: follow PHONETICS RULES below
- NEVER ask "Which syllable is stressed in...?" — use the phonetics styles below instead

PHONETICS RULES (for both practice and test phonetics questions):
- phonetics questions must use a MIX of these three styles (vary them, do not repeat the same style consecutively):
  1. IPA Reading: "Which word is pronounced /IPA/?" with 4 English word options (1 correct, 3 distractors). Tests IPA literacy.
  2. Sound Matching: "Which word has the same vowel sound as the 'X' in 'word'?" with 4 word options.
     CRITICAL: Match by ACTUAL PHONETIC SOUND (IPA), NOT by spelling/letter.
  3. Odd One Out: "Which word does NOT rhyme with the others?" with 4 words (3 that rhyme, 1 that doesn't).

MATCHING QUESTION (generate exactly 1 per module when the user prompt specifies matching pairs):
- type: "matching"
- prompt: "Match each English word with its definition"
- correctAnswer: null
- pairs: an array of objects, each with:
  - "word": the English vocabulary word
  - "definition": a concise English definition (5-15 words)
  - "spanish": the Spanish translation of the word
- Use exactly the number of pairs specified in the user prompt
- options: [] (empty array)`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const { id } = await params;

    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        modules: true,
        area: { select: { scopeType: true, organizationId: true } },
        sectionVocabulary: {
          include: { vocabulary: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (
      session.role === "org_admin" &&
      !(
        section.organizationId === session.organizationId ||
        (section.area.scopeType === "org" &&
          section.area.organizationId === session.organizationId)
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let requestedIntroDifficulty: string | null = null;
    try {
      const body = (await request.json()) as { introDifficulty?: unknown };
      if (typeof body.introDifficulty === "string") {
        requestedIntroDifficulty = body.introDifficulty.trim().toLowerCase();
      }
    } catch {
      // Allow empty body to preserve existing behavior.
    }

    const introModule = section.modules.find((m) => m.type === "introduction");
    const practiceModule = section.modules.find((m) => m.type === "practice");
    const testModule = section.modules.find((m) => m.type === "test");
    if (!introModule || !practiceModule || !testModule) {
      return NextResponse.json(
        { error: "Section is missing introduction/practice/test modules" },
        { status: 400 }
      );
    }

    const currentWordCount = Math.max(section.sectionVocabulary.length, 5);
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
      `Generate a complete vocabulary section for the topic: "${section.title}"
Number of vocabulary words: ${currentWordCount}
Required regular practice questions: exactly ${practiceRegularCount}
Required regular test questions: exactly ${testRegularCount}${matchingInstruction}
Introduction reading difficulty: ${introDifficulty}
Difficulty style guidance: ${difficultyGuidance}

Return the JSON object now.`
    );

    if (!content) {
      return NextResponse.json(
        { error: "OpenAI returned an empty response" },
        { status: 502 }
      );
    }

    let generated: {
      title: string;
      titleEs: string;
      description?: string;
      readingTitle?: string;
      readingText?: string;
      vocabulary: Array<{
        word: string;
        partOfSpeech?: string;
        definitionEs: string;
        exampleSentence: string;
        phoneticIpa?: string | null;
        stressedSyllable?: string | null;
      }>;
      practiceQuestions?: Array<{
        type: string;
        prompt: string;
        correctAnswer?: string | null;
        pairs?: unknown[];
        options?: Array<{ optionText: string; isCorrect: boolean }>;
      }>;
      testQuestions?: Array<{
        type: string;
        prompt: string;
        correctAnswer?: string | null;
        pairs?: unknown[];
        options?: Array<{ optionText: string; isCorrect: boolean }>;
      }>;
    };

    try {
      generated = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    if (
      !generated.title ||
      !generated.titleEs ||
      !Array.isArray(generated.vocabulary) ||
      generated.vocabulary.length === 0
    ) {
      return NextResponse.json(
        { error: "AI response is missing required fields. Please try again." },
        { status: 502 }
      );
    }

    const oldVocabularyIds = section.sectionVocabulary.map((sv) => sv.vocabulary.id);
    const imageUrl = await getUnitImageByTitle(generated.title, {
      kind: "section",
    });

    await prisma.$transaction(async (tx) => {
      await tx.learnerAttempt.deleteMany({
        where: { moduleId: { in: [practiceModule.id, testModule.id] } },
      });
      await tx.question.deleteMany({
        where: { moduleId: { in: [practiceModule.id, testModule.id] } },
      });
      await tx.learnerSectionProgress.updateMany({
        where: { sectionId: id },
        data: {
          introCompleted: false,
          practiceCompleted: false,
          testPassed: false,
          testScore: null,
        },
      });

      await tx.section.update({
        where: { id },
        data: {
          title: generated.title,
          titleEs: generated.titleEs,
          description: generated.description || "",
          imageUrl,
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

      await tx.sectionVocabulary.deleteMany({ where: { sectionId: id } });
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
                sectionId: id,
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
    });

    return NextResponse.json({
      success: true,
      sectionId: id,
      wordCount: generated.vocabulary.length,
      practiceQuestionCount: generated.practiceQuestions?.length || 0,
      testQuestionCount: generated.testQuestions?.length || 0,
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

