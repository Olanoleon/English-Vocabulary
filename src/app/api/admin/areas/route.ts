import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { matchEmoji } from "@/lib/logo";

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
    temperature: 0.3,
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
              reject(new Error(data?.error?.message || "OpenAI request failed"));
              return;
            }
            resolve(data.choices?.[0]?.message?.content || "");
          } catch {
            reject(new Error("Failed to parse OpenAI response"));
          }
        });
      }
    );
    req.on("error", (e: Error) => reject(new Error(`OpenAI error: ${e.message}`)));
    req.write(payload);
    req.end();
  });
}

export async function GET() {
  try {
    await requireAdmin();
    const areas = await prisma.area.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { sections: true } },
      },
    });
    return NextResponse.json(areas);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Area name is required" },
        { status: 400 }
      );
    }

    // Auto-generate Spanish translation and description via GPT
    let nameEs = name;
    let description: string | null = null;

    try {
      const raw = await callOpenAI(
        `You translate and describe educational area names. Return a JSON object with exactly two fields:
- "nameEs": the natural Spanish translation of the area name (as a native Spanish speaker would say it)
- "description": a brief English description (1 sentence, ~15 words) of what vocabulary this area covers`,
        `Area name: "${name}"`
      );
      const parsed = JSON.parse(raw);
      if (parsed.nameEs) nameEs = parsed.nameEs;
      if (parsed.description) description = parsed.description;
    } catch (err) {
      console.warn("Auto-translate failed, using name as fallback:", err);
    }

    // Get next sort order
    const lastArea = await prisma.area.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastArea?.sortOrder ?? 0) + 1;

    // Match an emoji icon based on the area name
    const emoji = matchEmoji(name);

    const area = await prisma.area.create({
      data: {
        name,
        nameEs,
        description,
        imageUrl: emoji,
        sortOrder,
      },
      include: {
        _count: { select: { sections: true } },
      },
    });

    return NextResponse.json(area, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create area error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
