import { prisma } from '../infrastructure/database.js';
import { notificationService } from './notification-service.js';

export class CommentError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'CommentError';
  }
}

const TERMINAL_STATUSES = ['APPROVED', 'REFUSED', 'CANCELLED', 'ARCHIVED'];

export const commentService = {
  /**
   * Add a comment to a workflow.
   * Access: workflow initiator OR registered validator whose email appears in any step's validatorEmails.
   * Guard: cannot comment on a terminal-state workflow.
   */
  async addComment(workflowId: string, authorId: string, body: string) {
    if (!body.trim()) {
      throw new CommentError(400, 'Comment body cannot be empty');
    }

    // Load workflow with phases and steps
    const workflow = await prisma.workflowInstance.findUnique({
      where: { id: workflowId },
      include: {
        initiator: { select: { id: true, email: true } },
        phases: {
          include: {
            steps: { select: { validatorEmails: true } },
          },
        },
      },
    });

    if (!workflow) {
      throw new CommentError(404, 'Workflow not found');
    }

    // Load author user to get their email for validator check
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, name: true, email: true },
    });

    if (!author) {
      throw new CommentError(404, 'Author not found');
    }

    // Participant check: initiator OR any step's validatorEmails contains author email
    const isInitiator = workflow.initiatorId === authorId;
    const isValidator = workflow.phases.some(phase =>
      phase.steps.some(step => step.validatorEmails.includes(author.email))
    );

    if (!isInitiator && !isValidator) {
      throw new CommentError(403, 'Not a participant in this workflow');
    }

    // Terminal state guard
    if (TERMINAL_STATUSES.includes(workflow.status)) {
      throw new CommentError(409, 'Cannot comment on a completed workflow');
    }

    // Create the comment
    const comment = await prisma.workflowComment.create({
      data: {
        workflowId,
        authorId,
        body: body.trim(),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify all OTHER participants (after create, never in transaction)
    try {
      // Collect all validator emails from all steps
      const allValidatorEmails = new Set<string>();
      for (const phase of workflow.phases) {
        for (const step of phase.steps) {
          for (const email of step.validatorEmails) {
            allValidatorEmails.add(email);
          }
        }
      }

      // Resolve validator emails to registered user IDs
      const validatorUsers = await prisma.user.findMany({
        where: { email: { in: [...allValidatorEmails] } },
        select: { id: true, email: true },
      });

      // Build deduplicated list of all participant IDs (initiator + registered validators)
      const participantIds = [
        workflow.initiator.id,
        ...validatorUsers.map(u => u.id),
      ].filter((id, idx, arr) => arr.indexOf(id) === idx);

      const notifContext = {
        workflowId,
        workflowTitle: (workflow as any).title,
        authorId,
        commentAuthor: author.name ?? author.email,
        commentId: comment.id,
      };

      for (const recipientId of participantIds) {
        if (recipientId === authorId) continue; // don't notify yourself
        await notificationService.createNotification(recipientId, 'COMMENT_ADDED', notifContext);
      }
    } catch (err) {
      console.error('Failed to create comment notifications:', err);
    }

    return comment;
  },

  /**
   * List all comments for a workflow in chronological order.
   * Access: same participant check as addComment.
   */
  async listComments(workflowId: string, userId: string) {
    // Load workflow with phases and steps for participant check
    const workflow = await prisma.workflowInstance.findUnique({
      where: { id: workflowId },
      include: {
        initiator: { select: { id: true } },
        phases: {
          include: {
            steps: { select: { validatorEmails: true } },
          },
        },
      },
    });

    if (!workflow) {
      throw new CommentError(404, 'Workflow not found');
    }

    // Load user email for validator check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new CommentError(404, 'User not found');
    }

    const isInitiator = workflow.initiatorId === userId;
    const isValidator = workflow.phases.some(phase =>
      phase.steps.some(step => step.validatorEmails.includes(user.email))
    );

    if (!isInitiator && !isValidator) {
      throw new CommentError(403, 'Not a participant in this workflow');
    }

    return prisma.workflowComment.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  },
};
