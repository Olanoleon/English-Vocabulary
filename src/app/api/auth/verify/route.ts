import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/auth";
import { verifyCode, createVerificationCode, getPendingVerification } from "@/lib/verification";
import { sendVerificationCode } from "@/lib/email";
import { prisma } from "@/lib/db";

function isMissingEmailColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
  const maybeMessage =
    "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return maybeCode === "P2022" && maybeMessage.toLowerCase().includes("email");
}

function isUnknownEmailFieldValidationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeName = "name" in error ? String((error as { name?: unknown }).name || "") : "";
  const maybeMessage =
    "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return (
    maybeName === "PrismaClientValidationError" &&
    maybeMessage.includes("Unknown field `email`")
  );
}

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
      const pending = getPendingVerification(userId);
      if (!pending) {
        return NextResponse.json(
          { error: "Verification expired. Sign in again." },
          { status: 401 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: pending.userId },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "Invalid request" },
          { status: 400 }
        );
      }
      const recipientEmail = (user.email || "").trim();
      if (!recipientEmail) {
        return NextResponse.json(
          { error: "Org admin account needs a valid email for verification." },
          { status: 400 }
        );
      }

      const newCode = createVerificationCode(
        user.id,
        user.username,
        user.displayName,
        pending.role,
        pending.organizationId || null
      );

      try {
        await sendVerificationCode(newCode, recipientEmail || undefined);
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

    // Code is valid — create privileged session
    const response = NextResponse.json({
      success: true,
      role: result.role,
      displayName: result.displayName,
    });

    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = result.userId;
    session.username = result.username;
    session.role = result.role;
    session.activeRole = result.role;
    session.displayName = result.displayName;
    session.organizationId = result.organizationId || null;
    session.loginChallengeToken = undefined;
    session.loginChallengeUserId = undefined;
    session.loginChallengeExpiresAt = undefined;
    session.isLoggedIn = true;
    await session.save();

    return response;
  } catch (error: unknown) {
    if (isMissingEmailColumnError(error) || isUnknownEmailFieldValidationError(error)) {
      return NextResponse.json(
        {
          error:
            "Email support is unavailable until schema/client sync. Run `npm run db:push` and restart the server.",
        },
        { status: 500 }
      );
    }
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
