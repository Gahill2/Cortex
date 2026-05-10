import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

function createTransport() {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 5_000,
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const transport = createTransport();

  // Always log code so it's visible in Railway logs as a fallback
  console.log(`\n[Cortex OTP] ──────────────────────`);
  console.log(`  To:   ${to}`);
  console.log(`  Code: ${code}`);
  console.log(`────────────────────────────────────\n`);

  if (!transport) return;

  try {
    await transport.sendMail({
    from: `"Cortex" <${env.SMTP_USER}>`,
    to,
    subject: "Your Cortex verification code",
    text: `Your Cortex verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it.`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#080810;font-family:system-ui,sans-serif;color:#e8e8f0">
  <div style="max-width:480px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#6366f1,#a78bfa);width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:24px">
      <span style="color:#fff;font-size:20px;font-weight:800;line-height:48px;display:block;text-align:center">C</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700">Your verification code</h1>
    <p style="margin:0 0 32px;color:#6b6b8a;font-size:14px;line-height:1.5">
      Use this code to sign in to Cortex. It expires in 10 minutes.
    </p>
    <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:32px">
      <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#818cf8">${code}</span>
    </div>
    <p style="margin:0;color:#6b6b8a;font-size:12px">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`
    });
  } catch (err) {
    console.error(`[Cortex OTP] SMTP send failed:`, err);
    // Don't rethrow — code is already logged above, user can use it
  }
}
