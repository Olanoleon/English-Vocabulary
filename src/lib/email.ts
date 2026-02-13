import { Resend } from "resend";

const ADMIN_EMAIL = "olanoleon@gmail.com";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendVerificationCode(code: string) {
  const { error } = await getResend().emails.send({
    from: "VocabPath <onboarding@resend.dev>",
    to: ADMIN_EMAIL,
    subject: `${code} — VocabPath Admin Verification`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1e3a8a; margin-bottom: 8px;">VocabPath Admin Login</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
          Use this code to complete your admin sign-in:
        </p>
        <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">
            ${code}
          </span>
        </div>
        <p style="color: #9ca3af; font-size: 12px;">
          This code expires in 5 minutes. If you didn't request this, you can safely ignore it.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send verification email:", error);
    throw new Error("Failed to send verification email");
  }
}
