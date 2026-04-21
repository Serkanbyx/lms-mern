/**
 * STEP 46 — Transactional email service.
 *
 * Wraps `nodemailer` so the rest of the codebase can ask for "send the
 * verification email to user X" without knowing anything about SMTP.
 *
 * Behaviour:
 *  - The transporter is lazily created the first time a send is requested.
 *    This keeps test runs (which never send mail) free of nodemailer init
 *    overhead and lets a misconfigured SMTP block ONLY the email feature
 *    rather than the whole server boot.
 *  - When SMTP credentials are missing (typical local dev setup) every
 *    send call short-circuits to a console log so a developer can copy
 *    the verification / reset link straight from the terminal.
 *  - All HTML templates ship with a plain-text fallback (deliverability
 *    + accessibility).
 *  - Send failures NEVER bubble up to the request handler. Email is a
 *    side effect; the response the user is waiting on (register, reset
 *    request, etc.) MUST succeed even if our SMTP provider hiccups.
 *
 * SECURITY:
 *  - Email links are constructed from `env.CLIENT_URL`, never from
 *    request input. An attacker cannot poison the link by manipulating
 *    the Host or Origin header of the original request.
 *  - The raw token MUST come from the controller (and is then forgotten
 *    forever — only its hash is in the DB). This module never logs the
 *    raw token in production, only in dev as a copy-paste convenience.
 */

import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from './logger.js';

let transporterPromise = null;

const createTransport = async () => {
  if (!env.MAIL_CONFIGURED) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
};

const getTransporter = () => {
  if (!transporterPromise) transporterPromise = createTransport();
  return transporterPromise;
};

const wrapHtml = (title, bodyHtml) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"/><title>${title}</title></head>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f7;padding:32px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <tr><td style="background:#4f46e5;color:#fff;padding:20px 32px;font-weight:600;font-size:18px;">Lumen LMS</td></tr>
          <tr><td style="padding:32px;font-size:15px;line-height:1.55;">${bodyHtml}</td></tr>
          <tr><td style="padding:20px 32px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center;">If you didn't expect this email, you can safely ignore it.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const ctaButton = (label, url) =>
  `<p style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;">${label}</a>
  </p>
  <p style="font-size:12px;color:#6b7280;word-break:break-all;">If the button doesn't work, paste this link into your browser:<br/><a href="${url}" style="color:#4f46e5;">${url}</a></p>`;

const logFallback = (subject, to, link) => {
  if (env.isProd) return;
  logger.info({ to, subject, link }, '[email] (dev/no-smtp) — copy link from this log.');
};

/**
 * Generic send. Resolves to `{ ok, skipped }` so callers can branch in
 * tests if they really want to, but otherwise this is fire-and-forget.
 */
export const sendEmail = async ({ to, subject, html, text, devLink } = {}) => {
  if (!to || !subject) {
    return { ok: false, skipped: true, reason: 'missing-fields' };
  }
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      logFallback(subject, to, devLink);
      return { ok: false, skipped: true, reason: 'smtp-not-configured' };
    }
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    return { ok: true, skipped: false };
  } catch (err) {
    logger.error({ to, subject, err: err.message }, '[email] send failed.');
    return { ok: false, skipped: false, reason: 'smtp-error' };
  }
};

const buildVerificationLink = (rawToken) =>
  `${env.CLIENT_URL.replace(/\/$/, '')}/verify-email/${rawToken}`;

const buildPasswordResetLink = (rawToken) =>
  `${env.CLIENT_URL.replace(/\/$/, '')}/reset-password/${rawToken}`;

export const sendVerificationEmail = async (user, rawToken) => {
  const link = buildVerificationLink(rawToken);
  const ttlH = Math.round(env.EMAIL_VERIFICATION_TTL_MIN / 60);
  const subject = 'Verify your Lumen LMS email';
  const html = wrapHtml(
    subject,
    `<p>Hi ${user.name || 'there'},</p>
     <p>Welcome to Lumen LMS! Please confirm your email address so we can secure your account and unlock the full learning experience.</p>
     ${ctaButton('Verify email', link)}
     <p style="font-size:13px;color:#6b7280;">This link expires in ${ttlH} hour${ttlH === 1 ? '' : 's'}.</p>`,
  );
  const text = `Hi ${user.name || 'there'},

Welcome to Lumen LMS! Verify your email by opening this link:
${link}

This link expires in ${ttlH} hour${ttlH === 1 ? '' : 's'}.`;
  return sendEmail({ to: user.email, subject, html, text, devLink: link });
};

export const sendPasswordResetEmail = async (user, rawToken) => {
  const link = buildPasswordResetLink(rawToken);
  const ttlMin = env.PASSWORD_RESET_TTL_MIN;
  const subject = 'Reset your Lumen LMS password';
  const html = wrapHtml(
    subject,
    `<p>Hi ${user.name || 'there'},</p>
     <p>We received a request to reset your password. Click the button below to choose a new one. If you didn't request a reset, you can safely ignore this email.</p>
     ${ctaButton('Reset password', link)}
     <p style="font-size:13px;color:#6b7280;">This link expires in ${ttlMin} minutes and can only be used once.</p>`,
  );
  const text = `Hi ${user.name || 'there'},

Reset your password by opening this link (valid for ${ttlMin} minutes):
${link}

If you didn't request a reset, you can ignore this email.`;
  return sendEmail({ to: user.email, subject, html, text, devLink: link });
};

export const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Lumen LMS';
  const dashboard = `${env.CLIENT_URL.replace(/\/$/, '')}/dashboard`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${user.name || 'there'},</p>
     <p>Your email is verified — welcome aboard! Jump into your dashboard to find recommended courses based on your interests.</p>
     ${ctaButton('Open dashboard', dashboard)}`,
  );
  const text = `Hi ${user.name || 'there'},

Your email is verified. Open your dashboard:
${dashboard}`;
  return sendEmail({ to: user.email, subject, html, text });
};

export const sendPasswordChangedEmail = async (user) => {
  const subject = 'Your Lumen LMS password was changed';
  const html = wrapHtml(
    subject,
    `<p>Hi ${user.name || 'there'},</p>
     <p>This is a confirmation that your account password was just changed. All other devices have been signed out as a precaution.</p>
     <p>If you didn't make this change, please reset your password immediately and contact support.</p>`,
  );
  const text = `Hi ${user.name || 'there'},

Your account password was just changed and all other devices have been signed out.

If you didn't make this change, reset your password immediately and contact support.`;
  return sendEmail({ to: user.email, subject, html, text });
};

export default {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
};
