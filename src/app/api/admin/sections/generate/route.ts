import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { matchEmoji } from "@/lib/logo";

/** Shuffle an array in place (Fisher-Yates) */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getOpenAIKey(): string {
  // Read .env file directly to bypass Cursor IDE env caching
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
  // Use Node.js native https to bypass Cursor IDE's network proxy
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
    req.on("error", (e: Error) => reject(new Error(`OpenAI network error: ${e.message}`)));
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

PRACTICE QUESTIONS:
- You MUST generate the exact number of regular practice questions specified in the user prompt. This is a hard requirement — do NOT generate fewer.
- ADDITIONALLY, if the user prompt specifies "matching pairs", generate exactly 1 "matching" question (see MATCHING QUESTION rules below) and include it as the LAST item in the practiceQuestions array.
- Focus on WORD DEFINITIONS — do NOT reference the reading passage
- Every vocabulary word MUST appear in at least one practice question (either as the subject of a definition question, or as the correct answer in a reverse/fill_blank/phonetics question)
- Regular questions should be a mix of four styles:
  1. "multiple_choice" (definition): "What is the definition of 'word'?" with 4 Spanish definition options (1 correct, 3 plausible distractors) — about 30%
  2. "multiple_choice" (reverse): "Which English word means 'definición en español'?" with 4 English word options from the vocabulary list — about 30%
  3. "fill_blank": A standalone generic sentence (NOT from the reading passage) where the vocabulary word fits naturally. Set correct_answer to the word. — about 25%
  4. "phonetics": Pronunciation questions using styles from the PHONETICS RULES section below — about 15%
- All options arrays must have exactly 4 items for multiple_choice and phonetics, 0 items for fill_blank and matching
- IMPORTANT: fill_blank sentences must be original and independent from the intro reading text

TEST QUESTIONS:
- You MUST generate the exact number of regular test questions specified in the user prompt. This is a hard requirement — do NOT generate fewer.
- ADDITIONALLY, if the user prompt specifies "matching pairs", generate exactly 1 "matching" question (see MATCHING QUESTION rules below) and include it as the LAST item in the testQuestions array.
- Regular questions: mix of "multiple_choice", "fill_blank", and "phonetics" types
- At least 30% should be "phonetics" type
- multiple_choice and fill_blank: same definition-focused rules as practice (NOT referencing the reading)
- Phonetics: follow PHONETICS RULES below
- NEVER ask "Which syllable is stressed in...?" — use the phonetics styles below instead

PHONETICS RULES (for both practice and test phonetics questions):
- phonetics questions must use a MIX of these three styles (vary them, do not repeat the same style consecutively):
  1. IPA Reading: "Which word is pronounced /IPA/?" with 4 English word options (1 correct, 3 distractors). Tests IPA literacy.
  2. Sound Matching: "Which word has the same vowel sound as the 'X' in 'word'?" with 4 word options. Target sounds difficult for Spanish speakers (e.g., short i vs long ee, schwa, th sounds).
     CRITICAL: Match by ACTUAL PHONETIC SOUND (IPA), NOT by spelling/letter. English letters often produce different sounds:
     - "u" in "lunchbox" = /ʌ/ (matches "cup", "brush") — NOT "ruler" which is /uː/
     - "o" in "come" = /ʌ/ — NOT the same as "o" in "home" /oʊ/
     - "ea" in "head" = /ɛ/ — NOT the same as "ea" in "bead" /iː/
     Always verify the IPA of both the source word and the correct answer match. All distractors must have clearly DIFFERENT vowel sounds.
  3. Odd One Out: "Which word does NOT rhyme with the others?" with 4 words (3 that rhyme, 1 that doesn't). Tests sound discrimination.
     CRITICAL: Rhyming is about SOUND, not spelling. "cough" does NOT rhyme with "through" despite both ending in "-ough". Verify pronunciation of all 4 words.

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

JSON STRUCTURE (follow exactly):
{
  "title": "Topic Title in English",
  "titleEs": "Título del Tema en Español",
  "description": "Brief English description of this vocabulary unit",
  "readingTitle": "A short engaging title for the reading passage",
  "readingText": "The reading passage with **highlighted** vocabulary words...",
  "vocabulary": [
    {
      "word": "example",
      "partOfSpeech": "noun",
      "definitionEs": "Definición natural en español",
      "exampleSentence": "Here is an example of the word in context.",
      "phoneticIpa": "/ɪɡˈzæmpəl/",
      "stressedSyllable": "zam"
    }
  ],
  "practiceQuestions": [
    {
      "type": "multiple_choice",
      "prompt": "What is the definition of 'example'?",
      "correctAnswer": null,
      "options": [
        {"optionText": "Ejemplo, muestra", "isCorrect": true},
        {"optionText": "Examen, prueba", "isCorrect": false},
        {"optionText": "Excusa, pretexto", "isCorrect": false},
        {"optionText": "Éxito, logro", "isCorrect": false}
      ]
    },
    {
      "type": "fill_blank",
      "prompt": "Can you give me an ___ of what you mean?",
      "correctAnswer": "example",
      "options": []
    },
    {
      "type": "phonetics",
      "prompt": "Which word is pronounced /ɪɡˈzæmpəl/?",
      "correctAnswer": null,
      "options": [
        {"optionText": "example", "isCorrect": true},
        {"optionText": "examine", "isCorrect": false},
        {"optionText": "exempt", "isCorrect": false},
        {"optionText": "exile", "isCorrect": false}
      ]
    },
    {
      "type": "matching",
      "prompt": "Match each English word with its definition",
      "correctAnswer": null,
      "pairs": [
        {"word": "example", "definition": "A thing characteristic of its kind or group", "spanish": "ejemplo"},
        {"word": "exercise", "definition": "Activity requiring physical effort for fitness", "spanish": "ejercicio"},
        {"word": "exchange", "definition": "An act of giving and receiving reciprocally", "spanish": "intercambio"}
      ],
      "options": []
    }
  ],
  "testQuestions": [
    {
      "type": "phonetics",
      "prompt": "Which word has the same vowel sound as the 'a' in 'example'?",
      "correctAnswer": null,
      "options": [
        {"optionText": "hand", "isCorrect": true},
        {"optionText": "name", "isCorrect": false},
        {"optionText": "father", "isCorrect": false},
        {"optionText": "water", "isCorrect": false}
      ]
    },
    {
      "type": "matching",
      "prompt": "Match each English word with its definition",
      "correctAnswer": null,
      "pairs": [
        {"word": "excuse", "definition": "A reason put forward to justify a fault", "spanish": "excusa"},
        {"word": "expert", "definition": "A person with extensive knowledge in a field", "spanish": "experto"},
        {"word": "expand", "definition": "To become or make larger in size or scope", "spanish": "expandir"}
      ],
      "options": []
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();

    const { topic, wordCount, areaId } = await request.json();

    if (!topic || !wordCount || !areaId) {
      return NextResponse.json(
        { error: "Topic, word count, and area ID are required" },
        { status: 400 }
      );
    }

    const area = await prisma.area.findUnique({
      where: { id: areaId },
      select: { id: true, scopeType: true, organizationId: true },
    });
    if (!area) {
      return NextResponse.json({ error: "Area not found" }, { status: 404 });
    }
    // org_admin can generate only in own org-owned areas.
    if (
      session.role === "org_admin" &&
      (area.scopeType !== "org" || area.organizationId !== session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (wordCount < 1 || wordCount > 20) {
      return NextResponse.json(
        { error: "Word count must be between 1 and 20" },
        { status: 400 }
      );
    }

    // Calculate required question counts
    // Practice: 2 per word, capped at 20
    // Test: linear scale — 5 words→10, 20 words→20, range [10, 20]
    const practiceCount = Math.min(wordCount * 2, 20);
    const testCount = Math.min(20, Math.max(10, Math.round(10 + ((wordCount - 5) / 15) * 10)));

    // Matching question: 3-5 pairs depending on unit size (only if ≥ 3 words)
    const matchingPairs = wordCount >= 3 ? Math.min(wordCount, wordCount <= 6 ? 3 : wordCount <= 12 ? 4 : 5) : 0;
    // Regular question counts adjusted so total points stay approximately the same
    const practiceRegularCount = Math.max(1, practiceCount - matchingPairs);
    const testRegularCount = Math.max(1, testCount - matchingPairs);

    // Call OpenAI (using fetch directly to avoid IDE proxy interception)
    const matchingInstruction = matchingPairs > 0
      ? `\nMatching pairs: ${matchingPairs} word pairs per matching question (generate 1 matching question for practice + 1 for test)`
      : "";
    const content = await callOpenAI(
      SYSTEM_PROMPT,
      `Generate a complete vocabulary section for the topic: "${topic}"
Number of vocabulary words: ${wordCount}
Required regular practice questions: exactly ${practiceRegularCount} (this is mandatory — every word must appear in at least one question)
Required regular test questions: exactly ${testRegularCount} (this is mandatory)${matchingInstruction}

Return the JSON object now.`
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
      console.error("Failed to parse OpenAI response:", content);
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    // Validate required fields
    if (
      !generated.title ||
      !generated.titleEs ||
      !generated.vocabulary ||
      !Array.isArray(generated.vocabulary) ||
      generated.vocabulary.length === 0
    ) {
      return NextResponse.json(
        { error: "AI response is missing required fields. Please try again." },
        { status: 502 }
      );
    }

    // Log if OpenAI under-generated (helps debugging)
    // Expected total includes regular questions plus one matching question (when enabled).
    const expectedPracticeTotal = practiceRegularCount + (matchingPairs > 0 ? 1 : 0);
    const expectedTestTotal = testRegularCount + (matchingPairs > 0 ? 1 : 0);
    const actualPractice = generated.practiceQuestions?.length || 0;
    const actualTest = generated.testQuestions?.length || 0;
    if (actualPractice < expectedPracticeTotal) {
      console.warn(
        `OpenAI under-generated practice questions: got ${actualPractice}, expected ${expectedPracticeTotal}`
      );
    }
    if (actualTest < expectedTestTotal) {
      console.warn(
        `OpenAI under-generated test questions: got ${actualTest}, expected ${expectedTestTotal}`
      );
    }

    // Get next sort order within area
    const lastSection = await prisma.section.findFirst({
      where: { areaId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastSection?.sortOrder ?? 0) + 1;

    // Match an emoji icon based on the unit title
    const imageUrl = matchEmoji(generated.title);

    // Create everything in the database
    // 1. Create section with modules
    const section = await prisma.section.create({
      data: {
        title: generated.title,
        titleEs: generated.titleEs,
        description: generated.description || "",
        imageUrl,
        sortOrder,
        areaId,
        organizationId: area.organizationId,
        modules: {
          create: [
            {
              type: "introduction",
              content: {
                readingTitle: generated.readingTitle || generated.title,
                readingText: generated.readingText || "",
              },
            },
            { type: "practice" },
            { type: "test" },
          ],
        },
      },
      include: { modules: true },
    });

    if (area.organizationId) {
      await prisma.organizationSectionConfig.upsert({
        where: {
          organizationId_sectionId: {
            organizationId: area.organizationId,
            sectionId: section.id,
          },
        },
        update: {},
        create: {
          organizationId: area.organizationId,
          sectionId: section.id,
          isVisible: true,
          sortOrder,
        },
      });
    }

    const practiceModule = section.modules.find((m) => m.type === "practice")!;
    const testModule = section.modules.find((m) => m.type === "test")!;

    // 2. Create vocabulary words
    for (let i = 0; i < generated.vocabulary.length; i++) {
      const v = generated.vocabulary[i];
      await prisma.vocabulary.create({
        data: {
          word: v.word,
          partOfSpeech: v.partOfSpeech || "noun",
          definitionEs: v.definitionEs,
          exampleSentence: v.exampleSentence,
          phoneticIpa: v.phoneticIpa || null,
          stressedSyllable: v.stressedSyllable || null,
          sectionVocabulary: {
            create: {
              sectionId: section.id,
              sortOrder: i + 1,
            },
          },
        },
      });
    }

    // 3. Create practice questions
    if (Array.isArray(generated.practiceQuestions)) {
      for (let i = 0; i < generated.practiceQuestions.length; i++) {
        const q = generated.practiceQuestions[i];
        // For matching questions, store pairs as JSON in correctAnswer
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

    // 4. Create test questions
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

    return NextResponse.json(
      {
        success: true,
        sectionId: section.id,
        title: generated.title,
        wordCount: generated.vocabulary.length,
        practiceQuestionCount: generated.practiceQuestions?.length || 0,
        testQuestionCount: generated.testQuestions?.length || 0,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Generate section error:", error);

    // Surface specific OpenAI errors to the admin
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("invalid_api_key") || errMsg.includes("Incorrect API key")) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key. Check OPENAI_API_KEY in .env and restart the server." },
        { status: 500 }
      );
    }
    if (errMsg.includes("insufficient_quota") || errMsg.includes("exceeded your current quota")) {
      return NextResponse.json(
        { error: "OpenAI quota exceeded. Check your billing at platform.openai.com." },
        { status: 500 }
      );
    }
    if (errMsg.includes("rate_limit")) {
      return NextResponse.json(
        { error: "OpenAI rate limit reached. Wait a moment and try again." },
        { status: 429 }
      );
    }

    // Pass through OpenAI error messages directly for other cases
    if (errMsg.startsWith("OpenAI error")) {
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to generate section. Please try again." },
      { status: 500 }
    );
  }
}
