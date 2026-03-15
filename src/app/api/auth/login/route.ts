import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { SessionData, sessionOptions } from "@/lib/auth";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationCode } from "@/lib/email";
import { createLoginChallenge } from "@/lib/login-challenge";
import { isAdminRole, normalizeEmail } from "@/lib/roles";
import { getUserMemberships } from "@/lib/user-memberships";

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
    const { email, password } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "E-mail and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        displayName: true,
        organizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid e-mail or password" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid e-mail or password" },
        { status: 401 }
      );
    }

    const memberships = await getUserMemberships(user.id);
    const effectiveMemberships =
      memberships.length > 0
        ? memberships
        : [{ id: "legacy", role: user.role, organizationId: user.organizationId || null, organizationName: null }];

    if (effectiveMemberships.length === 0) {
      return NextResponse.json(
        { error: "No memberships found for this account." },
        { status: 403 }
      );
    }

    if (effectiveMemberships.length > 1) {
      const challengeToken = createLoginChallenge(user.id);
      return NextResponse.json({
        requireRoleSelection: true,
        challengeToken,
        memberships: effectiveMemberships.map((m) => ({
          membershipId: m.id,
          role: m.role,
          organizationId: m.organizationId,
          organizationName: m.organizationName,
        })),
      });
    }

    const selected = effectiveMemberships[0];
    if (isAdminRole(selected.role)) {
      const recipientEmail = (user.email || "").trim();
      const code = createVerificationCode(
        user.id,
        user.username,
        user.displayName,
        selected.role,
        selected.organizationId
      );

      try {
        await sendVerificationCode(code, recipientEmail);
      } catch {
        return NextResponse.json(
          { error: "Failed to send verification email. Try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        requireVerification: true,
        userId: user.id,
      });
    }

    // ── Learner: log in immediately ────────────────────────────────────
    const response = NextResponse.json({
      success: true,
      role: selected.role,
      activeRole: selected.role,
      displayName: user.displayName,
    });

    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    session.username = user.username;
    session.role = selected.role;
    session.activeRole = selected.role;
    session.displayName = user.displayName;
    session.organizationId = selected.organizationId;
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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
