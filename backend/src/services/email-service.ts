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

export interface ManualReminderEmailInput {
  to: string;
  locale: string;
  documentTitle: string;
  workflowTitle: string;
  stepName: string;
  initiatorName: string;
  approveUrl: string;
  refuseUrl: string;
}

export interface InitiatorActionEmailInput {
  to: string;
  locale: string;
  workflowTitle: string;
  stepName: string;
  actorEmail: string;
  actionType: 'APPROVE' | 'REFUSE';
  comment: string | null;
  workflowUrl: string;
}

export interface InitiatorCompleteEmailInput {
  to: string;
  locale: string;
  workflowTitle: string;
  finalStatus: 'APPROVED' | 'REFUSED';
  workflowUrl: string;
}

export interface PasswordResetEmailInput {
  to: string;
  locale: string;
  resetUrl: string;
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

  async sendManualReminder(input: ManualReminderEmailInput) {
    const t = (key: string, options?: Record<string, unknown>) => tWithLang(input.locale, key, options);

    const subject = t('email.reminder_manual_subject', { workflowTitle: input.workflowTitle });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
          <strong style="color: #92400e; font-size: 14px;">
            ${input.locale === 'fr' ? '⏰ RAPPEL' : '⏰ REMINDER'}
          </strong>
        </div>
        <h2 style="color: #1a1a1a; margin-top: 0;">${escapeHtml(input.workflowTitle)}</h2>
        <p style="color: #444; line-height: 1.6;">
          ${input.locale === 'fr'
            ? `<strong>${escapeHtml(input.initiatorName)}</strong> vous relance pour donner votre décision sur le document <strong>${escapeHtml(input.documentTitle)}</strong> à l'étape <strong>${escapeHtml(input.stepName)}</strong>.`
            : `<strong>${escapeHtml(input.initiatorName)}</strong> is following up on your pending decision for <strong>${escapeHtml(input.documentTitle)}</strong> at step <strong>${escapeHtml(input.stepName)}</strong>.`
          }
        </p>
        <p style="color: #666; font-size: 14px;">
          ${input.locale === 'fr'
            ? 'Merci de donner votre réponse dès que possible.'
            : 'Please respond at your earliest convenience.'
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

  async sendInitiatorAction(input: InitiatorActionEmailInput) {
    const t = (key: string, options?: Record<string, unknown>) => tWithLang(input.locale, key, options);

    const subject = t('email.initiator_action_subject', { workflowTitle: input.workflowTitle });

    const actionLabel = input.actionType === 'APPROVE'
      ? (input.locale === 'fr' ? 'approuvé' : 'approved')
      : (input.locale === 'fr' ? 'refusé' : 'refused');

    const actionColor = input.actionType === 'APPROVE' ? '#16a34a' : '#dc2626';

    const commentHtml = input.comment
      ? `<blockquote style="border-left: 4px solid #e5e7eb; margin: 16px 0; padding: 8px 16px; color: #555; font-style: italic;">${escapeHtml(input.comment)}</blockquote>`
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${escapeHtml(input.workflowTitle)}</h2>
        <p style="color: #444;">
          ${input.locale === 'fr'
            ? `<strong>${escapeHtml(input.actorEmail)}</strong> a <strong style="color: ${actionColor};">${actionLabel}</strong> l'étape <strong>${escapeHtml(input.stepName)}</strong>.`
            : `<strong>${escapeHtml(input.actorEmail)}</strong> has <strong style="color: ${actionColor};">${actionLabel}</strong> step <strong>${escapeHtml(input.stepName)}</strong>.`
          }
        </p>
        ${commentHtml}
        <div style="margin: 30px 0; text-align: center;">
          <a href="${input.workflowUrl}" style="display: inline-block; padding: 12px 32px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${input.locale === 'fr' ? 'Voir le circuit' : 'View workflow'}
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

  async sendPasswordReset(input: PasswordResetEmailInput) {
    const subject = input.locale === 'fr'
      ? 'Réinitialiser votre mot de passe'
      : 'Reset your password';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">
          ${input.locale === 'fr' ? 'Réinitialisation de mot de passe' : 'Password Reset'}
        </h2>
        <p style="color: #444; line-height: 1.6;">
          ${input.locale === 'fr'
            ? 'Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.'
            : 'You requested a password reset. Click the button below to set a new password.'
          }
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${input.resetUrl}" style="display: inline-block; padding: 12px 32px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${input.locale === 'fr' ? 'Réinitialiser le mot de passe' : 'Reset Password'}
          </a>
        </div>
        <p style="color: #888; font-size: 12px;">
          ${input.locale === 'fr'
            ? 'Ce lien expire dans 1 heure. Si vous n\'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.'
            : 'This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.'
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

  async sendInitiatorComplete(input: InitiatorCompleteEmailInput) {
    const t = (key: string, options?: Record<string, unknown>) => tWithLang(input.locale, key, options);

    const subject = t('email.initiator_complete_subject', { workflowTitle: input.workflowTitle });

    const isApproved = input.finalStatus === 'APPROVED';
    const statusColor = isApproved ? '#16a34a' : '#dc2626';
    const statusLabel = isApproved
      ? (input.locale === 'fr' ? 'approuvé' : 'approved')
      : (input.locale === 'fr' ? 'refusé' : 'refused');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${escapeHtml(input.workflowTitle)}</h2>
        <p style="color: #444;">
          ${input.locale === 'fr'
            ? `Votre circuit de validation a été <strong style="color: ${statusColor};">${statusLabel}</strong> dans son ensemble.`
            : `Your validation workflow has been <strong style="color: ${statusColor};">${statusLabel}</strong> in full.`
          }
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${input.workflowUrl}" style="display: inline-block; padding: 12px 32px; background-color: ${statusColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ${input.locale === 'fr' ? 'Voir le circuit' : 'View workflow'}
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
