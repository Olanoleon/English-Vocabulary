import crypto from "crypto";

interface PendingCode {
  code: string;
  expiresAt: number;
  userId: string;
  username: string;
  displayName: string;
}

// In-memory store — codes are ephemeral (5 min TTL)
const pendingCodes = new Map<string, PendingCode>();

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a random 6-digit verification code for a user.
 * Overwrites any existing pending code for that user.
 */
export function createVerificationCode(
  userId: string,
  username: string,
  displayName: string
): string {
  // Generate cryptographically random 6-digit code
  const code = String(crypto.randomInt(100000, 999999));

  pendingCodes.set(userId, {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    userId,
    username,
    displayName,
  });

  // Clean up expired codes periodically
  cleanupExpired();

  return code;
}

/**
 * Verify a code for a given user. Returns user info on success, null on failure.
 * Code is consumed (deleted) on successful verification.
 */
export function verifyCode(
  userId: string,
  code: string
): { userId: string; username: string; displayName: string } | null {
  const pending = pendingCodes.get(userId);

  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingCodes.delete(userId);
    return null;
  }
  if (pending.code !== code) return null;

  // Success — consume the code
  pendingCodes.delete(userId);
  return {
    userId: pending.userId,
    username: pending.username,
    displayName: pending.displayName,
  };
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, value] of pendingCodes) {
    if (now > value.expiresAt) {
      pendingCodes.delete(key);
    }
  }
}
