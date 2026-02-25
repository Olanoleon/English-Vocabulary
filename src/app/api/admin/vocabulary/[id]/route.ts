import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAdminOrSuperAdmin } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.vocabulary.findUnique({
      where: { id },
      include: {
        sectionVocabulary: {
          include: {
            section: {
              include: {
                area: {
                  select: {
                    scopeType: true,
                    organizationId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Vocabulary not found" }, { status: 404 });
    }
    if (session.role === "org_admin") {
      const allScopedToOwnOrg = existing.sectionVocabulary.every(
        (sv) =>
          sv.section.area.scopeType === "org" &&
          sv.section.area.organizationId === session.organizationId
      );
      if (!allScopedToOwnOrg) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const vocab = await prisma.vocabulary.update({
      where: { id },
      data: {
        word: body.word,
        partOfSpeech: body.partOfSpeech,
        definitionEs: body.definitionEs,
        exampleSentence: body.exampleSentence,
        phoneticIpa: body.phoneticIpa || null,
        stressedSyllable: body.stressedSyllable || null,
      },
    });

    return NextResponse.json(vocab);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOrgAdminOrSuperAdmin();
    const { id } = await params;

    const existing = await prisma.vocabulary.findUnique({
      where: { id },
      include: {
        sectionVocabulary: {
          include: {
            section: {
              include: {
                area: {
                  select: {
                    scopeType: true,
                    organizationId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Vocabulary not found" }, { status: 404 });
    }
    if (session.role === "org_admin") {
      const allScopedToOwnOrg = existing.sectionVocabulary.every(
        (sv) =>
          sv.section.area.scopeType === "org" &&
          sv.section.area.organizationId === session.organizationId
      );
      if (!allScopedToOwnOrg) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await prisma.vocabulary.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
