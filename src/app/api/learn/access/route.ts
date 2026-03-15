import { NextResponse } from "next/server";
import { requireAuth, checkLearnerAccess } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

export async function GET() {
  try {
    const session = await requireAuth();

    // Admin roles always have access
    if (isAdminRole(session.activeRole || session.role)) {
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
