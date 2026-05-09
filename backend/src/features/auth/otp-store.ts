import bcrypt from "bcrypt";
import crypto from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_DIGITS = 6;

interface OtpRecord {
  hash: string;
  expiresAt: number;
  attempts: number;
}

export class OtpStore {
  private readonly store = new Map<string, OtpRecord>();
  private readonly MAX_ATTEMPTS = 5;

  /** Generate a numeric OTP, store it (hashed), return plain text for emailing. */
  async create(email: string): Promise<string> {
    const code = String(crypto.randomInt(10 ** (OTP_DIGITS - 1), 10 ** OTP_DIGITS));
    const hash = await bcrypt.hash(code, 10);
    this.store.set(email.toLowerCase(), {
      hash,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0
    });
    return code;
  }

  /** Verify a submitted code. Returns true once, then invalidates the record. */
  async verify(email: string, code: string): Promise<boolean> {
    const key = email.toLowerCase();
    const record = this.store.get(key);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.store.delete(key);
      return false;
    }
    record.attempts += 1;
    if (record.attempts > this.MAX_ATTEMPTS) {
      this.store.delete(key);
      return false;
    }
    const ok = await bcrypt.compare(code, record.hash);
    if (ok) this.store.delete(key);
    return ok;
  }

  /** Wipe expired records (call on a timer or before each operation). */
  purgeExpired(): void {
    const now = Date.now();
    for (const [key, rec] of this.store) {
      if (now > rec.expiresAt) this.store.delete(key);
    }
  }
}

export const otpStore = new OtpStore();

// Purge expired OTPs every 5 minutes
setInterval(() => otpStore.purgeExpired(), 5 * 60 * 1000).unref();
