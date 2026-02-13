import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { matchEmoji } from "@/lib/logo";

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
- You MUST generate the exact number of practice questions specified in the user prompt under "Required practice questions". This is a hard requirement — do NOT generate fewer.
- Focus on WORD DEFINITIONS — do NOT reference the reading passage
- Every vocabulary word MUST appear in at least one practice question (either as the subject of a definition question, or as the correct answer in a reverse/fill_blank question)
- Mix of three styles (distribute evenly):
  1. "multiple_choice" (definition): "What is the definition of 'word'?" with 4 Spanish definition options (1 correct, 3 plausible distractors from other Spanish words that could be confused)
  2. "multiple_choice" (reverse): "Which English word means 'definición en español'?" with 4 English word options from the vocabulary list (1 correct, 3 other words from this unit)
  3. "fill_blank": A standalone generic sentence (NOT from the reading passage) where the vocabulary word fits naturally. Set correct_answer to the word.
- All options arrays must have exactly 4 items for multiple_choice, 0 items for fill_blank
- IMPORTANT: fill_blank sentences must be original and independent from the intro reading text

TEST QUESTIONS:
- You MUST generate the exact number of test questions specified in the user prompt under "Required test questions". This is a hard requirement — do NOT generate fewer.
- Mix of "multiple_choice", "fill_blank", and "phonetics" types
- At least 30% should be "phonetics" type
- multiple_choice and fill_blank: same definition-focused rules as practice (NOT referencing the reading)
- phonetics questions must use a MIX of these three styles (vary them, do not repeat the same style):
  1. IPA Reading: "Which word is pronounced /IPA/?" with 4 English word options (1 correct, 3 distractors). Tests IPA literacy.
  2. Sound Matching: "Which word has the same vowel sound as the 'X' in 'word'?" with 4 word options. Target sounds that are difficult for Spanish speakers (e.g., short i vs long ee, schwa, th sounds).
  3. Odd One Out: "Which word does NOT rhyme with the others?" with 4 words (3 that rhyme, 1 that doesn't). Tests sound discrimination.
- NEVER ask "Which syllable is stressed in...?" — use the three phonetics styles above instead

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
      "type": "multiple_choice",
      "prompt": "Which English word means 'ejemplo, muestra'?",
      "correctAnswer": null,
      "options": [
        {"optionText": "example", "isCorrect": true},
        {"optionText": "exercise", "isCorrect": false},
        {"optionText": "excuse", "isCorrect": false},
        {"optionText": "exchange", "isCorrect": false}
      ]
    },
    {
      "type": "fill_blank",
      "prompt": "Can you give me an ___ of what you mean?",
      "correctAnswer": "example",
      "options": []
    }
  ],
  "testQuestions": [
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
      "type": "phonetics",
      "prompt": "Which word does NOT rhyme with the others?",
      "correctAnswer": null,
      "options": [
        {"optionText": "sample", "isCorrect": false},
        {"optionText": "trample", "isCorrect": false},
        {"optionText": "simple", "isCorrect": true},
        {"optionText": "ample", "isCorrect": false}
      ]
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { topic, wordCount, areaId } = await request.json();

    if (!topic || !wordCount || !areaId) {
      return NextResponse.json(
        { error: "Topic, word count, and area ID are required" },
        { status: 400 }
      );
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

    // Call OpenAI (using fetch directly to avoid IDE proxy interception)
    const content = await callOpenAI(
      SYSTEM_PROMPT,
      `Generate a complete vocabulary section for the topic: "${topic}"
Number of vocabulary words: ${wordCount}
Required practice questions: exactly ${practiceCount} (this is mandatory — every word must appear in at least one question)
Required test questions: exactly ${testCount} (this is mandatory)

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
    const actualPractice = generated.practiceQuestions?.length || 0;
    const actualTest = generated.testQuestions?.length || 0;
    if (actualPractice < practiceCount) {
      console.warn(
        `OpenAI under-generated practice questions: got ${actualPractice}, expected ${practiceCount}`
      );
    }
    if (actualTest < testCount) {
      console.warn(
        `OpenAI under-generated test questions: got ${actualTest}, expected ${testCount}`
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
        await prisma.question.create({
          data: {
            moduleId: practiceModule.id,
            type: q.type || "multiple_choice",
            prompt: q.prompt,
            correctAnswer: q.correctAnswer || null,
            sortOrder: i + 1,
            options:
              Array.isArray(q.options) && q.options.length > 0
                ? {
                    create: q.options.map(
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
        await prisma.question.create({
          data: {
            moduleId: testModule.id,
            type: q.type || "multiple_choice",
            prompt: q.prompt,
            correctAnswer: q.correctAnswer || null,
            sortOrder: i + 1,
            options:
              Array.isArray(q.options) && q.options.length > 0
                ? {
                    create: q.options.map(
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
