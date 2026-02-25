import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import https from "https";
import path from "path";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";
import { matchEmoji } from "@/lib/logo";

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
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");

    const where: {
      OR?: Array<Record<string, string>>;
    } = {};

    // org_admin sees global + their own org areas.
    if (session.role === "org_admin") {
      if (!session.organizationId) {
        return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
      }
      where.OR = [
        { scopeType: "global" },
        { scopeType: "org", organizationId: session.organizationId },
      ];
    } else if (requestedOrgId) {
      // super_admin/admin can view global + selected org context.
      where.OR = [
        { scopeType: "global" },
        { scopeType: "org", organizationId: requestedOrgId },
      ];
    }

    const areas = await prisma.area.findMany({
      where: where.OR ? where : undefined,
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

    // Resolve target scope/org.
    let scopeType: "global" | "org" = "global";
    let organizationId: string | null = null;

    if (session.role === "org_admin") {
      if (!session.organizationId) {
        return NextResponse.json({ error: "Org admin missing organization" }, { status: 403 });
      }
      scopeType = "org";
      organizationId = session.organizationId;
    } else {
      const requestedScope = body.scopeType === "org" ? "org" : "global";
      scopeType = requestedScope;
      if (scopeType === "org") {
        if (!body.organizationId) {
          return NextResponse.json({ error: "organizationId is required for org-scoped areas" }, { status: 400 });
        }
        const org = await prisma.organization.findUnique({
          where: { id: body.organizationId },
          select: { id: true, isActive: true },
        });
        if (!org || !org.isActive) {
          return NextResponse.json({ error: "Invalid or inactive organization" }, { status: 400 });
        }
        organizationId = org.id;
      }
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

    // Match an emoji icon based on the area name
    const emoji = matchEmoji(name);

    const area = await prisma.area.create({
      data: {
        name,
        nameEs,
        description,
        imageUrl: emoji,
        sortOrder,
        scopeType,
        organizationId,
      },
      include: {
        _count: { select: { sections: true } },
      },
    });

    // Ensure org-scoped area has a default config row in its own org context.
    if (organizationId) {
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
    } else {
      // For super-admin-created global areas, force hidden in each org by default.
      // Each org admin can later enable visibility when ready.
      const orgs = await prisma.organization.findMany({
        select: { id: true },
      });

      if (orgs.length > 0) {
        await prisma.organizationAreaConfig.createMany({
          data: orgs.map((org) => ({
            organizationId: org.id,
            areaId: area.id,
            isVisible: false,
            sortOrder,
          })),
          skipDuplicates: true,
        });
      }
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
