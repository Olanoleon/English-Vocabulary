import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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

PRACTICE QUESTIONS (~2 per vocabulary word):
- Mix of "multiple_choice" and "fill_blank" types
- multiple_choice: ask what the English word means, with 4 Spanish options (1 correct, 3 plausible distractors)
- fill_blank: provide a sentence with a blank where the vocabulary word fits. Set correct_answer to the word.
- All options arrays must have exactly 4 items for multiple_choice, 0 items for fill_blank

TEST QUESTIONS (~1.5 per vocabulary word):
- Mix of "multiple_choice", "fill_blank", and "phonetics" types
- At least 30% should be "phonetics" type
- phonetics questions: "Which syllable is stressed in 'X'?" or "Which word rhymes with 'X'?" — always 4 options, 1 correct
- Vary the question styles so the test feels comprehensive

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
      "prompt": "What does 'example' mean?",
      "correctAnswer": null,
      "options": [
        {"optionText": "Ejemplo", "isCorrect": true},
        {"optionText": "Examen", "isCorrect": false},
        {"optionText": "Excusa", "isCorrect": false},
        {"optionText": "Éxito", "isCorrect": false}
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
      "prompt": "Which syllable is stressed in 'example'?",
      "correctAnswer": null,
      "options": [
        {"optionText": "EX-am-ple", "isCorrect": false},
        {"optionText": "ex-AM-ple", "isCorrect": true},
        {"optionText": "ex-am-PLE", "isCorrect": false},
        {"optionText": "All equally", "isCorrect": false}
      ]
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { topic, wordCount } = await request.json();

    if (!topic || !wordCount) {
      return NextResponse.json(
        { error: "Topic and word count are required" },
        { status: 400 }
      );
    }

    if (wordCount < 3 || wordCount > 15) {
      return NextResponse.json(
        { error: "Word count must be between 3 and 15" },
        { status: 400 }
      );
    }

    // Call OpenAI (using fetch directly to avoid IDE proxy interception)
    const content = await callOpenAI(
      SYSTEM_PROMPT,
      `Generate a complete vocabulary section for the topic: "${topic}"\nNumber of vocabulary words: ${wordCount}\n\nReturn the JSON object now.`
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

    // Get next sort order
    const lastSection = await prisma.section.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastSection?.sortOrder ?? 0) + 1;

    // Create everything in the database
    // 1. Create section with modules
    const section = await prisma.section.create({
      data: {
        title: generated.title,
        titleEs: generated.titleEs,
        description: generated.description || "",
        sortOrder,
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
