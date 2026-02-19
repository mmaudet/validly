import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../infrastructure/database.js';

const TOKEN_EXPIRY_HOURS = 48;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const tokenService = {
  /**
   * Generate a secure one-time action token for a validator.
   * Token is CSPRNG-generated, only the hash is stored.
   */
  async createToken(stepId: string, validatorEmail: string, action: 'APPROVE' | 'REFUSE'): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    await prisma.actionToken.create({
      data: {
        tokenHash,
        stepId,
        validatorEmail,
        action,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    });

    return rawToken;
  },

  /**
   * Validate a token without consuming it. Used by GET redirect.
   */
  async validateToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const token = await prisma.actionToken.findUnique({
      where: { tokenHash },
      include: {
        step: {
          include: {
            phase: {
              include: {
                workflow: {
                  include: {
                    documents: { include: { document: { select: { id: true, title: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!token) {
      return { valid: false, reason: 'not_found' as const };
    }

    if (token.usedAt) {
      return { valid: false, reason: 'already_used' as const, token };
    }

    if (token.expiresAt < new Date()) {
      return { valid: false, reason: 'expired' as const, token };
    }

    return {
      valid: true,
      reason: 'ok' as const,
      token,
      stepId: token.stepId,
      validatorEmail: token.validatorEmail,
      action: token.action as 'APPROVE' | 'REFUSE',
      workflow: token.step.phase.workflow,
      step: token.step,
    };
  },

  /**
   * Resolve a token: validate it's not expired/used, mark as used, return context.
   * Single-use enforcement: token is marked used atomically.
   */
  async resolveToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const token = await prisma.actionToken.findUnique({
      where: { tokenHash },
      include: {
        step: {
          include: {
            phase: {
              include: {
                workflow: {
                  include: {
                    documents: { include: { document: { select: { id: true, title: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!token) {
      return { valid: false, reason: 'not_found' as const };
    }

    if (token.usedAt) {
      return { valid: false, reason: 'already_used' as const, token };
    }

    if (token.expiresAt < new Date()) {
      return { valid: false, reason: 'expired' as const, token };
    }

    // Mark as used atomically
    await prisma.actionToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });

    return {
      valid: true,
      reason: 'ok' as const,
      token,
      stepId: token.stepId,
      validatorEmail: token.validatorEmail,
      action: token.action as 'APPROVE' | 'REFUSE',
      workflow: token.step.phase.workflow,
      step: token.step,
    };
  },

  /**
   * Create approve + refuse tokens for a step's validators.
   * Returns a map of email → { approveToken, refuseToken }.
   */
  async createTokensForStep(stepId: string, validatorEmails: string[]) {
    const tokens: Record<string, { approveToken: string; refuseToken: string }> = {};

    for (const email of validatorEmails) {
      const approveToken = await this.createToken(stepId, email, 'APPROVE');
      const refuseToken = await this.createToken(stepId, email, 'REFUSE');
      tokens[email] = { approveToken, refuseToken };
    }

    return tokens;
  },
};
