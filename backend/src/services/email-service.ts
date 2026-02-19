import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { tWithLang } from '../i18n/index.js';

let transporter: Transporter;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface PendingActionEmailInput {
  to: string;
  locale: string;
  documentTitle: string;
  workflowTitle: string;
  stepName: string;
  initiatorName: string;
  approveUrl: string;
  refuseUrl: string;
}

export interface ReminderEmailInput {
  to: string;
  locale: string;
  documentTitle: string;
  workflowTitle: string;
  stepName: string;
  deadlineDate: string;
  approveUrl: string;
  refuseUrl: string;
}

export const emailService = {
  async sendPendingAction(input: PendingActionEmailInput) {
    const t = (key: string, options?: Record<string, unknown>) => tWithLang(input.locale, key, options);

    const subject = t('email.pending_action_subject', { documentTitle: input.workflowTitle });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${escapeHtml(input.workflowTitle)}</h2>
        <p style="color: #444;">
          ${input.locale === 'fr'
            ? `<strong>${escapeHtml(input.initiatorName)}</strong> vous demande de valider le document <strong>${escapeHtml(input.documentTitle)}</strong> à l'étape <strong>${escapeHtml(input.stepName)}</strong>.`
            : `<strong>${escapeHtml(input.initiatorName)}</strong> requests your validation on <strong>${escapeHtml(input.documentTitle)}</strong> at step <strong>${escapeHtml(input.stepName)}</strong>.`
          }
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${input.approveUrl}" style="display: inline-block; padding: 12px 32px; margin: 0 8px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${input.locale === 'fr' ? 'Approuver' : 'Approve'}
          </a>
          <a href="${input.refuseUrl}" style="display: inline-block; padding: 12px 32px; margin: 0 8px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${input.locale === 'fr' ? 'Refuser' : 'Refuse'}
          </a>
        </div>
        <p style="color: #888; font-size: 12px;">
          ${input.locale === 'fr'
            ? 'Ces liens sont à usage unique et expirent après 48 heures.'
            : 'These links are single-use and expire after 48 hours.'
          }
        </p>
      </div>
    `;

    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject,
      html,
    });
  },

  async sendReminder(input: ReminderEmailInput) {
    const t = (key: string, options?: Record<string, unknown>) => tWithLang(input.locale, key, options);

    const subject = t('email.reminder_subject', { documentTitle: input.workflowTitle });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${input.locale === 'fr' ? 'Rappel' : 'Reminder'}: ${escapeHtml(input.workflowTitle)}</h2>
        <p style="color: #444;">
          ${input.locale === 'fr'
            ? `Votre décision est attendue avant le <strong>${input.deadlineDate}</strong> pour l'étape <strong>${escapeHtml(input.stepName)}</strong>.`
            : `Your decision is expected before <strong>${input.deadlineDate}</strong> for step <strong>${escapeHtml(input.stepName)}</strong>.`
          }
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${input.approveUrl}" style="display: inline-block; padding: 12px 32px; margin: 0 8px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${input.locale === 'fr' ? 'Approuver' : 'Approve'}
          </a>
          <a href="${input.refuseUrl}" style="display: inline-block; padding: 12px 32px; margin: 0 8px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${input.locale === 'fr' ? 'Refuser' : 'Refuse'}
          </a>
        </div>
      </div>
    `;

    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject,
      html,
    });
  },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
