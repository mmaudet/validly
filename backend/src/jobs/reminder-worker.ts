import { Worker } from 'bullmq';
import { prisma } from '../infrastructure/database.js';
import { redisConnection } from '../infrastructure/queue/index.js';
import { tokenService } from '../services/token-service.js';
import { emailService } from '../services/email-service.js';
import { env } from '../config/env.js';

export const reminderWorker = new Worker(
  'reminders',
  async (job) => {
    const { stepId } = job.data as { stepId: string };

    // Load the step with full context
    const step = await prisma.stepInstance.findUnique({
      where: { id: stepId },
      include: {
        phase: {
          include: {
            workflow: {
              include: {
                initiator: { select: { name: true } },
                documents: { include: { document: { select: { title: true } } } },
              },
            },
          },
        },
        actions: { select: { actorEmail: true } },
      },
    });

    if (!step) {
      console.warn(`Reminder job: step ${stepId} not found, skipping`);
      return;
    }

    // If step is no longer IN_PROGRESS, skip (already resolved)
    if (step.status !== 'IN_PROGRESS') {
      console.info(`Reminder job: step ${stepId} is ${step.status}, skipping`);
      return;
    }

    const workflow = step.phase.workflow;
    const actedEmails = new Set(step.actions.map((a) => a.actorEmail));

    // Find validators who haven't acted yet
    const pendingEmails = step.validatorEmails.filter((email) => !actedEmails.has(email));

    if (pendingEmails.length === 0) {
      console.info(`Reminder job: all validators have acted on step ${stepId}, skipping`);
      return;
    }

    // Create new tokens and send reminder emails for each pending validator
    const tokens = await tokenService.createTokensForStep(stepId, pendingEmails);

    for (const email of pendingEmails) {
      const { approveToken, refuseToken } = tokens[email];
      const deadlineDate = step.deadline
        ? step.deadline.toLocaleDateString('fr-FR')
        : '';

      try {
        await emailService.sendReminder({
          to: email,
          locale: 'fr',
          workflowTitle: workflow.title,
          documentTitle: workflow.documents[0]?.document.title ?? workflow.title,
          stepName: step.name,
          deadlineDate,
          approveUrl: `${env.API_URL}/api/actions/${approveToken}`,
          refuseUrl: `${env.API_URL}/api/actions/${refuseToken}`,
        });
      } catch (err) {
        console.error(`Reminder job: failed to send reminder to ${email}:`, err);
      }
    }
  },
  {
    connection: redisConnection,
  }
);

reminderWorker.on('error', (err) => {
  console.error('Reminder worker error:', err);
});

reminderWorker.on('failed', (job, err) => {
  console.error('Reminder job failed:', job?.id, err);
});
