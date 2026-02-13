import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { SessionData, sessionOptions } from "@/lib/auth";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationCode } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // ── Admin: require email verification ──────────────────────────────
    if (user.role === "admin") {
      const code = createVerificationCode(
        user.id,
        user.username,
        user.displayName
      );

      try {
        await sendVerificationCode(code);
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
      role: user.role,
      displayName: user.displayName,
    });

    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    session.username = user.username;
    session.role = user.role;
    session.displayName = user.displayName;
    session.isLoggedIn = true;
    await session.save();

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
