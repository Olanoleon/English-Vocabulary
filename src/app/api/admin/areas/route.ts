import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import https from "https";
import path from "path";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { getUnitImageByTitle } from "@/lib/unit-image";
import { replicateTemplateAreaToAllOrgs } from "@/lib/template-replication";

function getOpenAIKey(): string {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^OPENAI_API_KEY=["']?([^"'\r\n]+)["']?/m);
    if (match?.[1]) return match[1];
  } catch { /* fallback */ }
  return process.env.OPENAI_API_KEY || "";
}

function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
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

export async function GET(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");
    if (activeRole === "org_admin" && !session.organizationId) {
      return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
    }

    const areas = await prisma.area.findMany({
      where:
        activeRole === "org_admin"
          ? { scopeType: "org", organizationId: session.organizationId }
          : requestedOrgId
            ? { scopeType: "org", organizationId: requestedOrgId }
            : {
                OR: [
                  { isTemplate: true },
                  { scopeType: "global", organizationId: null },
                ],
              },
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
    console.error("List areas error:", error);
    return NextResponse.json({ error: `Failed to load areas: ${message}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const activeRole = session.activeRole || session.role;
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

    const isOrgAdmin = activeRole === "org_admin";
    const scopeType: "global" | "org" = isOrgAdmin ? "org" : "global";
    let organizationId: string | null = null;

    if (isOrgAdmin) {
      if (!session.organizationId) {
        return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
      }
      organizationId = session.organizationId;
    }

    // Get next sort order in scope
    const lastArea = await prisma.area.findFirst({
      where: {
        scopeType,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastArea?.sortOrder ?? 0) + 1;

    // Fetch provider illustration by title (fallback to app logo)
    const imageUrl = await getUnitImageByTitle(name, { kind: "area" });

    const area = await prisma.area.create({
      data: {
        name,
        nameEs,
        description,
        imageUrl,
        sortOrder,
        scopeType,
        organizationId,
        isTemplate: !isOrgAdmin,
        sourceTemplateId: null,
        sourceVersion: 1,
        isCustomized: isOrgAdmin,
        isActive: true,
      },
      include: {
        _count: { select: { sections: true } },
      },
    });

    if (isOrgAdmin && organizationId) {
      await prisma.organizationAreaConfig.upsert({
        where: {
          organizationId_areaId: {
            organizationId,
            areaId: area.id,
          },
        },
        update: {},
        create: {
          organizationId,
          areaId: area.id,
          isVisible: true,
          sortOrder,
        },
      });
    }

    if (!isOrgAdmin) {
      await replicateTemplateAreaToAllOrgs(area.id);
    }

    return NextResponse.json(area, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create area error:", error);
    return NextResponse.json(
      { error: `Failed to create area: ${message}` },
      { status: 500 }
    );
  }
}
