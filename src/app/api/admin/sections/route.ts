import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get("areaId");

    const sections = await prisma.section.findMany({
      where: areaId ? { areaId } : undefined,
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { sectionVocabulary: true },
        },
        modules: {
          select: { id: true, type: true },
        },
      },
    });
    return NextResponse.json(sections);
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
    const { title, titleEs, description, areaId } = body;

    if (!title || !titleEs || !areaId) {
      return NextResponse.json({ error: "Title, Spanish title, and area ID are required" }, { status: 400 });
    }

    // Get next sort order within area
    const lastSection = await prisma.section.findFirst({
      where: { areaId },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder = (lastSection?.sortOrder ?? 0) + 1;

    // Create section with 3 modules
    const section = await prisma.section.create({
      data: {
        title,
        titleEs,
        description: description || "",
        sortOrder,
        areaId,
        modules: {
          create: [
            { type: "introduction", content: { readingText: "", readingTitle: "" } },
            { type: "practice" },
            { type: "test" },
          ],
        },
      },
      include: {
        modules: true,
        _count: { select: { sectionVocabulary: true } },
      },
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create section error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
