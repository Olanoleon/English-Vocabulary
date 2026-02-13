import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/auth";
import { verifyCode, createVerificationCode } from "@/lib/verification";
import { sendVerificationCode } from "@/lib/email";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { userId, code, resend } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    // ── Resend code ────────────────────────────────────────────────────
    if (resend) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true, role: true },
      });

      if (!user || user.role !== "admin") {
        return NextResponse.json(
          { error: "Invalid request" },
          { status: 400 }
        );
      }

      const newCode = createVerificationCode(
        user.id,
        user.username,
        user.displayName
      );

      try {
        await sendVerificationCode(newCode);
      } catch {
        return NextResponse.json(
          { error: "Failed to send verification email" },
          { status: 500 }
        );
      }

      return NextResponse.json({ sent: true });
    }

    // ── Verify code ────────────────────────────────────────────────────
    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    const result = verifyCode(userId, code);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 401 }
      );
    }

    // Code is valid — create admin session
    const response = NextResponse.json({
      success: true,
      role: "admin",
      displayName: result.displayName,
    });

    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = result.userId;
    session.username = result.username;
    session.role = "admin";
    session.displayName = result.displayName;
    session.isLoggedIn = true;
    await session.save();

    return response;
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
