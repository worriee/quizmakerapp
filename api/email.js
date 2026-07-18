import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const APP_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;

let resend = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

/**
 * ensureResend: Throws if Resend is not configured.
 */
function ensureResend() {
  if (!resend) {
    throw new Error(
      "Email service not configured. Set RESEND_API_KEY environment variable.",
    );
  }
}

/**
 * sendVerificationEmail: Sends email verification link to new users.
 * @param {string} email - Recipient email address.
 * @param {string} token - Verification token.
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function sendVerificationEmail(email, token) {
  try {
    ensureResend();
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your TUON AI account",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #7b9acc; font-size: 24px; margin-bottom: 8px;">TUON AI</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thanks for signing up! Please verify your email address to start using TUON AI.
          </p>
          <a href="${verifyUrl}"
             style="display: inline-block; background: #7b9acc; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Verify Email
          </a>
          <p style="color: #666; font-size: 14px;">
            Or copy this link: <a href="${verifyUrl}" style="color: #7b9acc;">${verifyUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            This link expires in 24 hours. If you didn't create an account, you can ignore this email.
          </p>
        </div>
      `,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error(
      "[Email] Failed to send verification email:",
      err.message || err,
    );
    return { success: false, error: err.message || "Failed to send email" };
  }
}

/**
 * sendPasswordResetEmail: Sends password reset link to users.
 * @param {string} email - Recipient email address.
 * @param {string} token - Password reset token.
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function sendPasswordResetEmail(email, token) {
  try {
    ensureResend();
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your TUON AI password",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #7b9acc; font-size: 24px; margin-bottom: 8px;">TUON AI</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            You requested a password reset. Click the button below to set a new password.
          </p>
          <a href="${resetUrl}"
             style="display: inline-block; background: #7b9acc; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 14px;">
            Or copy this link: <a href="${resetUrl}" style="color: #7b9acc;">${resetUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.
          </p>
        </div>
      `,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error(
      "[Email] Failed to send password reset email:",
      err.message || err,
    );
    return { success: false, error: err.message || "Failed to send email" };
  }
}

/**
 * sendLockoutEmail: Notifies user when their account is locked due to failed login attempts.
 * @param {string} email - Recipient email address.
 * @param {string} lockedUntil - ISO timestamp of when the lockout expires.
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function sendLockoutEmail(email, lockedUntil) {
  try {
    ensureResend();
    const unlockTime = new Date(lockedUntil).toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      dateStyle: "full",
      timeStyle: "short",
    });

    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Your TUON AI account has been temporarily locked",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #7b9acc; font-size: 24px; margin-bottom: 8px;">TUON AI</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Your account has been temporarily locked due to too many failed login attempts.
          </p>
          <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #92400E; font-size: 14px; margin: 0;">
              <strong>Unlock time:</strong> ${unlockTime}
            </p>
            <p style="color: #92400E; font-size: 14px; margin: 8px 0 0 0;">
              This lockout lasts 15 minutes.
            </p>
          </div>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            If this was you, please wait for the lockout to expire and try again. If you didn't attempt to log in, please secure your account by resetting your password.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            This is an automated security notification from TUON AI.
          </p>
        </div>
      `,
    });

    return { success: true, error: null };
  } catch (err) {
    console.error("[Email] Failed to send lockout email:", err.message || err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}
