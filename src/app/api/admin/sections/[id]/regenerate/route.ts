import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** Shuffle an array (Fisher-Yates) */
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
    const fs = require("fs");
    const path = require("path");
    const envPath = path.resolve(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^OPENAI_API_KEY=["']?([^"'\r\n]+)["']?/m);
    if (match?.[1]) return match[1];
  } catch { /* fallback */ }
  return process.env.OPENAI_API_KEY || "";
}

function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const https = require("https");
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
      (res: { on: Function; statusCode: number }) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || "OpenAI error"));
              return;
            }
            resolve(json.choices?.[0]?.message?.content || "");
          } catch {
            reject(new Error("Failed to parse OpenAI response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const REGEN_PROMPT = `You are an expert ESL teacher creating practice and test questions for Spanish-speaking students learning English vocabulary.

You will be given a list of vocabulary words with their definitions, IPA pronunciations, and example sentences. Generate NEW questions based on these words.

PRACTICE QUESTIONS:
- Focus on WORD DEFINITIONS — do NOT reference any reading passage
- Every vocabulary word MUST appear in at least one practice question
- Regular questions should be a mix of four styles:
  1. "multiple_choice" (definition): "What is the definition of 'word'?" with 4 Spanish definition options (1 correct, 3 plausible distractors) — about 30%
  2. "multiple_choice" (reverse): "Which English word means 'definición en español'?" with 4 English word options from the vocabulary list — about 30%
  3. "fill_blank": A standalone generic sentence where the vocabulary word fits naturally. Set correct_answer to the word. — about 25%
  4. "phonetics": Pronunciation questions using styles from the PHONETICS RULES below — about 15%
- ADDITIONALLY, if the user prompt specifies "matching pairs", generate exactly 1 "matching" question (see MATCHING QUESTION rules below) and include it as the LAST item in practiceQuestions.
- All options arrays must have exactly 4 items for multiple_choice and phonetics, 0 items for fill_blank and matching

TEST QUESTIONS:
- Regular questions: mix of "multiple_choice", "fill_blank", and "phonetics" types
- At least 30% should be "phonetics" type
- multiple_choice and fill_blank: same definition-focused rules as practice
- Phonetics: follow PHONETICS RULES below
- ADDITIONALLY, if the user prompt specifies "matching pairs", generate exactly 1 "matching" question (see MATCHING QUESTION rules below) and include it as the LAST item in testQuestions.
- NEVER ask "Which syllable is stressed in...?"

PHONETICS RULES (for both practice and test phonetics questions):
- phonetics questions must use a MIX of these three styles (vary them, do not repeat the same style consecutively):
  1. IPA Reading: "Which word is pronounced /IPA/?" with 4 English word options (1 correct, 3 distractors). Tests IPA literacy.
  2. Sound Matching: "Which word has the same vowel sound as the 'X' in 'word'?" with 4 word options.
     CRITICAL: Match by ACTUAL PHONETIC SOUND (IPA), NOT by spelling/letter. English letters often produce different sounds:
     - "u" in "lunchbox" = /ʌ/ (matches "cup", "brush") — NOT "ruler" which is /uː/
     - "o" in "come" = /ʌ/ — NOT the same as "o" in "home" /oʊ/
     - "ea" in "head" = /ɛ/ — NOT the same as "ea" in "bead" /iː/
     Always verify the IPA of both the source word and the correct answer match. All distractors must have clearly DIFFERENT vowel sounds.
  3. Odd One Out: "Which word does NOT rhyme with the others?" with 4 words (3 that rhyme, 1 that doesn't).
     CRITICAL: Rhyming is about SOUND, not spelling. Verify pronunciation of all 4 words.

MATCHING QUESTION (generate exactly 1 per module when the user prompt specifies matching pairs):
- type: "matching"
- prompt: "Match each English word with its definition"
- correctAnswer: null
- pairs: an array of objects, each with:
  - "word": the English vocabulary word
  - "definition": a concise English definition (5-15 words)
  - "spanish": the Spanish translation of the word
- Use exactly the number of pairs specified in the user prompt
- Choose a diverse subset of vocabulary words; use DIFFERENT words for practice vs test matching if possible
- options: [] (empty array)

Return a JSON object with exactly two arrays:
{
  "practiceQuestions": [ ... ],
  "testQuestions": [ ... ]
}

Each regular question: { "type": string, "prompt": string, "correctAnswer": string|null, "options": [{"optionText": string, "isCorrect": boolean}] }
Each matching question: { "type": "matching", "prompt": string, "correctAnswer": null, "pairs": [{"word": string, "definition": string, "spanish": string}], "options": [] }`;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // 1. Fetch the section with its vocabulary and modules
    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        modules: true,
        sectionVocabulary: {
          include: { vocabulary: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const practiceModule = section.modules.find((m) => m.type === "practice");
    const testModule = section.modules.find((m) => m.type === "test");

    if (!practiceModule || !testModule) {
      return NextResponse.json(
        { error: "Section is missing practice or test modules" },
        { status: 400 }
      );
    }

    const vocabWords = section.sectionVocabulary.map((sv) => sv.vocabulary);
    if (vocabWords.length === 0) {
      return NextResponse.json(
        { error: "Section has no vocabulary words" },
        { status: 400 }
      );
    }

    // 2. Calculate question counts (same logic as generate)
    const wordCount = vocabWords.length;
    const practiceCount = Math.min(wordCount * 2, 20);
    const testCount = Math.min(20, Math.max(10, Math.round(10 + ((wordCount - 5) / 15) * 10)));

    // Matching question: 3-5 pairs depending on unit size (only if ≥ 3 words)
    const matchingPairs = wordCount >= 3 ? Math.min(wordCount, wordCount <= 6 ? 3 : wordCount <= 12 ? 4 : 5) : 0;
    const practiceRegularCount = Math.max(1, practiceCount - matchingPairs);
    const testRegularCount = Math.max(1, testCount - matchingPairs);

    // 3. Build vocab summary for the prompt
    const vocabSummary = vocabWords
      .map(
        (v) =>
          `- ${v.word} (${v.partOfSpeech}): "${v.definitionEs}" | IPA: ${v.phoneticIpa || "N/A"} | Example: "${v.exampleSentence}"`
      )
      .join("\n");

    // 4. Call OpenAI
    const matchingInstruction = matchingPairs > 0
      ? `\nMatching pairs: ${matchingPairs} word pairs per matching question (generate 1 matching question for practice + 1 for test)`
      : "";
    const content = await callOpenAI(
      REGEN_PROMPT,
      `Vocabulary words:\n${vocabSummary}\n\nGenerate exactly ${practiceRegularCount} regular practice questions and exactly ${testRegularCount} regular test questions.${matchingInstruction}\nReturn the JSON object now.`
    );

    if (!content) {
      return NextResponse.json(
        { error: "OpenAI returned an empty response" },
        { status: 502 }
      );
    }

    let generated;
    try {
      generated = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    // 5. Delete old questions (cascades LearnerAnswer records)
    await prisma.question.deleteMany({
      where: { moduleId: { in: [practiceModule.id, testModule.id] } },
    });

    // 6. Delete old LearnerAttempts for these modules (clean slate)
    await prisma.learnerAttempt.deleteMany({
      where: { moduleId: { in: [practiceModule.id, testModule.id] } },
    });

    // 7. Reset learner progress for this section (allow retake)
    await prisma.learnerSectionProgress.updateMany({
      where: { sectionId: id },
      data: {
        practiceCompleted: false,
        testPassed: false,
        testScore: null,
      },
    });

    // 8. Create new practice questions
    if (Array.isArray(generated.practiceQuestions)) {
      for (let i = 0; i < generated.practiceQuestions.length; i++) {
        const q = generated.practiceQuestions[i];
        const correctAnswer =
          q.type === "matching" && Array.isArray(q.pairs)
            ? JSON.stringify(q.pairs)
            : q.correctAnswer || null;
        const shuffledOptions: { optionText: string; isCorrect: boolean }[] =
          Array.isArray(q.options) && q.options.length > 0
            ? shuffleArray(q.options)
            : [];
        await prisma.question.create({
          data: {
            moduleId: practiceModule.id,
            type: q.type || "multiple_choice",
            prompt: q.prompt,
            correctAnswer,
            sortOrder: i + 1,
            options:
              shuffledOptions.length > 0
                ? {
                    create: shuffledOptions.map(
                      (
                        o: { optionText: string; isCorrect: boolean },
                        idx: number
                      ) => ({
                        optionText: o.optionText,
                        isCorrect: o.isCorrect || false,
                        sortOrder: idx + 1,
                      })
                    ),
                  }
                : undefined,
          },
        });
      }
    }

    // 9. Create new test questions
    if (Array.isArray(generated.testQuestions)) {
      for (let i = 0; i < generated.testQuestions.length; i++) {
        const q = generated.testQuestions[i];
        const correctAnswer =
          q.type === "matching" && Array.isArray(q.pairs)
            ? JSON.stringify(q.pairs)
            : q.correctAnswer || null;
        const shuffledOptions: { optionText: string; isCorrect: boolean }[] =
          Array.isArray(q.options) && q.options.length > 0
            ? shuffleArray(q.options)
            : [];
        await prisma.question.create({
          data: {
            moduleId: testModule.id,
            type: q.type || "multiple_choice",
            prompt: q.prompt,
            correctAnswer,
            sortOrder: i + 1,
            options:
              shuffledOptions.length > 0
                ? {
                    create: shuffledOptions.map(
                      (
                        o: { optionText: string; isCorrect: boolean },
                        idx: number
                      ) => ({
                        optionText: o.optionText,
                        isCorrect: o.isCorrect || false,
                        sortOrder: idx + 1,
                      })
                    ),
                  }
                : undefined,
          },
        });
      }
    }

    const newPracticeCount = generated.practiceQuestions?.length || 0;
    const newTestCount = generated.testQuestions?.length || 0;

    return NextResponse.json({
      success: true,
      practiceQuestions: newPracticeCount,
      testQuestions: newTestCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Regenerate questions error:", error);
    return NextResponse.json({ error: `Failed to regenerate: ${message}` }, { status: 500 });
  }
}
