import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { matchEmoji } from "@/lib/logo";

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
    const { name, nameEs, description } = body;

    if (!name || !nameEs) {
      return NextResponse.json(
        { error: "Name and Spanish name are required" },
        { status: 400 }
      );
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
        description: description || null,
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
