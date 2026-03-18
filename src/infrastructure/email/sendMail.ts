import nodemailer from "nodemailer";

interface SendMailOptions {
  subject: string;
  html: string;
  mailTo: string;
}

interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize or get the SMTP transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error(
      "Missing SMTP configuration. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables."
    );
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number.parseInt(smtpPort),
    secure: Number.parseInt(smtpPort) === 465, // True for 465, false for 587
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

/**
 * Sends an email using the configured SMTP transporter.
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const { subject, html, mailTo } = options;
  const fromEmail = process.env.SMTP_USER; // Default to SMTP_USER for sending

  if (!fromEmail) {
    return {
      ok: false,
      error: "Mail configuration error: SMTP_USER must be set.",
    };
  }

  try {
    const transport = getTransporter();

    const result = await transport.sendMail({
      from: `Anonfly Admin <${fromEmail}>`,
      to: mailTo,
      subject,
      html,
    });

    return {
      ok: true,
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      error: errorMsg,
    };
  }
}
