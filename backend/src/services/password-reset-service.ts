import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../infrastructure/database.js';
import { env } from '../config/env.js';
import { emailService } from './email-service.js';
import { hashPassword } from './auth-service.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const passwordResetService = {
  async requestPasswordReset(email: string): Promise<void> {
    // Look up user by email — silently return if not found (AUTH-04 anti-enumeration)
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    // Generate CSPRNG token (raw token sent to user, only hash stored)
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // Store token hash with 1 hour expiry
    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Build reset URL with raw token
    const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;

    // Send password reset email
    await emailService.sendPasswordReset({
      to: user.email,
      locale: user.locale,
      resetUrl,
    });
  },

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ success: true } | { success: false; reason: 'invalid_or_expired' }> {
    const tokenHash = hashToken(rawToken);

    // ATOMIC consumption (AUTH-05 TOCTOU-safe):
    // updateMany WHERE usedAt IS NULL AND expiresAt > now ensures only one concurrent request succeeds
    const result = await prisma.passwordResetToken.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    // count === 0 means token was already used, expired, or not found
    if (result.count === 0) {
      return { success: false, reason: 'invalid_or_expired' };
    }

    // Fetch the token to get userId (it's now marked as used)
    const token = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!token) {
      // Should not happen after a successful updateMany, but guard anyway
      return { success: false, reason: 'invalid_or_expired' };
    }

    // Hash the new password using the shared hashPassword function from auth-service
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await prisma.user.update({
      where: { id: token.userId },
      data: { password: hashedPassword },
    });

    // Delete ALL refresh tokens for this user (AUTH-03 ghost session prevention)
    await prisma.refreshToken.deleteMany({ where: { userId: token.userId } });

    return { success: true };
  },
};
