function normalizeBypassCode(raw: string | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim();
  return /^\d{6}$/.test(code) ? code : null;
}

export function getDev2faBypassCode(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return normalizeBypassCode(process.env.DEV_2FA_BYPASS_CODE);
}

export function isDev2faBypassEnabled(): boolean {
  return Boolean(getDev2faBypassCode());
}
