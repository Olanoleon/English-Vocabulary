import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const areas = await prisma.area.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            sections: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    const result = areas.map((area) => ({
      id: area.id,
      name: area.name,
      nameEs: area.nameEs,
      description: area.description,
      imageUrl: area.imageUrl,
      unitCount: area._count.sections,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
