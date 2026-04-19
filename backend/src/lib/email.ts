import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    console.log(`[email] SMTP not configured. To: ${to} | Subject: ${subject}`);
    return;
  }
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
}

export function verificationEmailHtml(token: string): string {
  const link = `${env.APP_URL}/#verify-email?token=${token}`;
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#7C3AED">Vitajte vo Finvu!</h2>
      <p>Kliknite na odkaz nižšie pre overenie vášho emailu:</p>
      <a href="${link}" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">
        Overiť email
      </a>
      <p style="color:#666;font-size:13px">Odkaz je platný bez časového obmedzenia. Ak ste sa nezaregistrovali, ignorujte tento email.</p>
    </div>
  `;
}

export function resetPasswordEmailHtml(token: string): string {
  const link = `${env.APP_URL}/#reset-password?token=${token}`;
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#7C3AED">Obnovenie hesla — Finvu</h2>
      <p>Kliknite na odkaz nižšie pre nastavenie nového hesla:</p>
      <a href="${link}" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">
        Obnoviť heslo
      </a>
      <p style="color:#666;font-size:13px">Odkaz je platný 1 hodinu. Ak ste nepožiadali o obnovu hesla, ignorujte tento email.</p>
    </div>
  `;
}
