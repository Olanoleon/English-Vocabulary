import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export interface SessionData {
  userId: string;
  username: string;
  role: string;
  displayName: string;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "change-me-to-a-random-secret-at-least-32-characters-long",
  cookieName: "vocab-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}

/**
 * Check if a learner has access based on their accessOverride and payment status.
 * Returns { hasAccess, reason } where reason explains why access was denied.
 */
export async function checkLearnerAccess(userId: string): Promise<{
  hasAccess: boolean;
  reason?: "manual_block" | "payment_overdue";
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accessOverride: true,
      monthlyRate: true,
      nextPaymentDue: true,
    },
  });

  if (!user) return { hasAccess: false, reason: "manual_block" };

  // Force disabled by admin
  if (user.accessOverride === "disabled") {
    return { hasAccess: false, reason: "manual_block" };
  }

  // Force enabled by admin — always allow
  if (user.accessOverride === "enabled") {
    return { hasAccess: true };
  }

  // Auto mode: follow payment status
  if (user.monthlyRate > 0) {
    const now = new Date();
    if (!user.nextPaymentDue || new Date(user.nextPaymentDue) < now) {
      return { hasAccess: false, reason: "payment_overdue" };
    }
  }

  return { hasAccess: true };
}

/**
 * Require learner access — throws if blocked.
 */
export async function requireLearnerAccess() {
  const session = await requireAuth();
  if (session.role === "admin") return session; // admins always have access

  const access = await checkLearnerAccess(session.userId);
  if (!access.hasAccess) {
    throw new Error(
      access.reason === "payment_overdue" ? "PaymentOverdue" : "AccessDisabled"
    );
  }
  return session;
}
