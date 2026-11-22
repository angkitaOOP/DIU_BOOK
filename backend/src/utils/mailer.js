import nodemailer from 'nodemailer';
import { config } from '../config.js';

const { host, port, user, pass, from } = config.smtp;
const transport = host
  ? nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined })
  : null;

export async function sendMail({ to, subject, text }) {
  if (!transport) {
    // Development fallback: no SMTP configured, print the message instead.
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] ${text}\n`);
    return;
  }
  await transport.sendMail({ from, to, subject, text });
}
