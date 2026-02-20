import { prisma } from '../infrastructure/database.js';

export class NotificationError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export const NOTIFICATION_TYPES = {
  STEP_APPROVED: 'STEP_APPROVED',
  STEP_REFUSED: 'STEP_REFUSED',
  WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
  WORKFLOW_REFUSED: 'WORKFLOW_REFUSED',
  COMMENT_ADDED: 'COMMENT_ADDED',
} as const;

const DEFAULT_PREFS: Record<string, boolean> = {
  STEP_APPROVED: true,
  STEP_REFUSED: true,
  WORKFLOW_COMPLETED: true,
  WORKFLOW_REFUSED: true,
  COMMENT_ADDED: true,
};

export const notificationService = {
  /**
   * Create a notification for a user.
   * Respects the user's notificationPrefs: if they have explicitly disabled the type, skip.
   * NOTE: Must always be called OUTSIDE prisma.$transaction(), after commit, wrapped in try/catch.
   */
  async createNotification(userId: string, type: string, context: Record<string, unknown>) {
    // Check user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    if (user) {
      const prefs = user.notificationPrefs as Record<string, boolean> | null;
      if (prefs !== null && prefs !== undefined) {
        // If explicitly set to false, skip
        if (prefs[type] === false) {
          return null;
        }
      }
      // If prefs is null, default is all types enabled
    }

    return prisma.notification.create({
      data: {
        userId,
        type,
        // The actual schema uses workflowId/stepId/metadata columns, not a single context Json.
        // We store the full context in metadata and extract known fields.
        workflowId: (context.workflowId as string | undefined) ?? null,
        stepId: (context.stepId as string | undefined) ?? null,
        metadata: context as any,
      },
    });
  },

  /**
   * List notifications for a user (newest first).
   * Options: filter by unread (readAt is null), limit count.
   */
  async listForUser(userId: string, options?: { unread?: boolean; limit?: number }) {
    const where: any = { userId };
    if (options?.unread) {
      where.readAt = null;
    }

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
    });
  },

  /**
   * Count unread notifications for a user.
   * Unread = readAt is null.
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  },

  /**
   * Mark a single notification as read.
   * Throws 404 if not found or doesn't belong to the user.
   */
  async markRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotificationError(404, 'Notification not found');
    }

    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  },

  /**
   * Mark all unread notifications as read for a user.
   */
  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  /**
   * Get notification preferences for a user.
   * Returns the stored prefs or default (all types enabled).
   */
  async getPreferences(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    if (!user) {
      throw new NotificationError(404, 'User not found');
    }

    return (user.notificationPrefs as Record<string, boolean> | null) ?? { ...DEFAULT_PREFS };
  },

  /**
   * Update notification preferences for a user.
   * Only valid NOTIFICATION_TYPES keys are accepted; unknown keys are ignored.
   */
  async updatePreferences(userId: string, prefs: Record<string, boolean>) {
    const validKeys = Object.keys(NOTIFICATION_TYPES);

    // Filter to only valid keys with boolean values
    const filteredPrefs: Record<string, boolean> = {};
    for (const key of validKeys) {
      if (key in prefs) {
        filteredPrefs[key] = Boolean(prefs[key]);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: filteredPrefs },
    });

    return filteredPrefs;
  },
};
