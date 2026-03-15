import crypto from "crypto";

interface PendingLoginChallenge {
  token: string;
  userId: string;
  createdAt: number;
}

const pendingChallenges = new Map<string, PendingLoginChallenge>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createLoginChallenge(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  pendingChallenges.set(token, {
    token,
    userId,
    createdAt: Date.now(),
  });
  cleanupExpired();
  return token;
}

export function consumeLoginChallenge(token: string): PendingLoginChallenge | null {
  const challenge = pendingChallenges.get(token);
  if (!challenge) return null;
  if (Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) {
    pendingChallenges.delete(token);
    return null;
  }
  pendingChallenges.delete(token);
  return challenge;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [token, challenge] of pendingChallenges) {
    if (now - challenge.createdAt > CHALLENGE_TTL_MS) {
      pendingChallenges.delete(token);
    }
  }
}

