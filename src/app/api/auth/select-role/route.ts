import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/db";
import { SessionData, sessionOptions } from "@/lib/auth";
import { consumeLoginChallenge } from "@/lib/login-challenge";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationCode } from "@/lib/email";
import { isAdminRole } from "@/lib/roles";

export async function POST(request: NextRequest) {
  try {
    const { challengeToken, membershipId } = await request.json();
    if (!challengeToken || !membershipId) {
      return NextResponse.json(
        { error: "challengeToken and membershipId are required" },
        { status: 400 }
      );
    }

    const challenge = consumeLoginChallenge(String(challengeToken));
    if (!challenge) {
      return NextResponse.json(
        { error: "Login session expired. Please sign in again." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membership = await prisma.userRoleMembership.findFirst({
      where: {
        id: String(membershipId),
        userId: challenge.userId,
      },
      select: {
        id: true,
        role: true,
        organizationId: true,
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Selected role is invalid" }, { status: 400 });
    }

    if (isAdminRole(membership.role)) {
      const code = createVerificationCode(
        user.id,
        user.username,
        user.displayName,
        membership.role,
        membership.organizationId
      );

      try {
        await sendVerificationCode(code, user.email);
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

    const response = NextResponse.json({
      success: true,
      role: membership.role,
      activeRole: membership.role,
      displayName: user.displayName,
    });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    session.userId = user.id;
    session.username = user.username;
    session.role = membership.role;
    session.activeRole = membership.role;
    session.displayName = user.displayName;
    session.organizationId = membership.organizationId;
    session.isLoggedIn = true;
    await session.save();
    return response;
  } catch (error) {
    console.error("Select role error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

