import { NextResponse } from "next/server";
import { requireAuth, checkLearnerAccess } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireAuth();

    // Admins always have access
    if (session.role === "admin") {
      return NextResponse.json({ hasAccess: true });
    }

    const access = await checkLearnerAccess(session.userId);
    return NextResponse.json(access);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
