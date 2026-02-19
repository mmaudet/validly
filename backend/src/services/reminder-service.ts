import { reminderQueue } from '../infrastructure/queue/index.js';

/**
 * Schedule a deadline reminder job for a step.
 * The reminder is sent 24 hours before the deadline.
 * Idempotent: if a job with the same jobId already exists, it is silently ignored.
 */
export async function scheduleReminder(stepId: string, deadline: Date): Promise<void> {
  const delay = deadline.getTime() - Date.now() - 24 * 3600 * 1000;

  // Skip if deadline is less than 24h away or already passed
  if (delay <= 0) {
    return;
  }

  try {
    await reminderQueue.add(
      'deadline-reminder',
      { stepId },
      {
        delay,
        jobId: `reminder-${stepId}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  } catch (err: unknown) {
    // Ignore "Job already exists" errors (idempotent scheduling)
    if (err instanceof Error && err.message.includes('already exists')) {
      return;
    }
    throw err;
  }
}

/**
 * Cancel a scheduled reminder job for a step.
 * Safe to call even if the job doesn't exist.
 */
export async function cancelReminder(stepId: string): Promise<void> {
  try {
    await reminderQueue.remove(`reminder-${stepId}`);
  } catch {
    // Job may not exist — ignore errors
  }
}
