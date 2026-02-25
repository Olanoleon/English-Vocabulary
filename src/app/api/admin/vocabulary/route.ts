import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const body = await request.json();
    const { sectionId, word, partOfSpeech, definitionEs, exampleSentence, phoneticIpa, stressedSyllable } = body;

    if (!sectionId || !word || !partOfSpeech || !definitionEs || !exampleSentence) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        area: {
          select: {
            scopeType: true,
            organizationId: true,
          },
        },
      },
    });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (
      session.role === "org_admin" &&
      (section.area.scopeType !== "org" ||
        section.area.organizationId !== session.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get next sort order for section
    const lastSv = await prisma.sectionVocabulary.findFirst({
      where: { sectionId },
      orderBy: { sortOrder: "desc" },
    });

    const vocab = await prisma.vocabulary.create({
      data: {
        word,
        partOfSpeech,
        definitionEs,
        exampleSentence,
        phoneticIpa: phoneticIpa || null,
        stressedSyllable: stressedSyllable || null,
        sectionVocabulary: {
          create: {
            sectionId,
            sortOrder: (lastSv?.sortOrder ?? 0) + 1,
          },
        },
      },
      include: { sectionVocabulary: true },
    });

    return NextResponse.json(vocab, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("Create vocab error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
