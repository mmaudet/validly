import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '../infrastructure/database.js';
import { env } from '../config/env.js';
import { t } from '../i18n/index.js';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const hashBuffer = Buffer.from(hash, 'hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuffer, derivedKey);
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  locale?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  locale: string;
}

export const authService = {
  async signup(input: SignupInput, signJwt: (payload: JwtPayload) => string): Promise<AuthTokens> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AuthError(409, t('auth.email_taken') || 'Email already registered');
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        name: input.name,
        locale: input.locale ?? 'en',
      },
    });

    const refreshToken = generateRefreshToken();
    const refreshExpiresMs = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    await prisma.auditEvent.create({
      data: {
        action: 'USER_SIGNUP',
        entityType: 'user',
        entityId: user.id,
        actorId: user.id,
        actorEmail: user.email,
      },
    });

    const accessToken = signJwt({
      sub: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
    });

    return { accessToken, refreshToken };
  },

  async login(input: LoginInput, signJwt: (payload: JwtPayload) => string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AuthError(401, t('auth.invalid_credentials'));
    }

    const valid = await verifyPassword(input.password, user.password);
    if (!valid) {
      throw new AuthError(401, t('auth.invalid_credentials'));
    }

    const refreshToken = generateRefreshToken();
    const refreshExpiresMs = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    await prisma.auditEvent.create({
      data: {
        action: 'USER_LOGIN',
        entityType: 'user',
        entityId: user.id,
        actorId: user.id,
        actorEmail: user.email,
      },
    });

    const accessToken = signJwt({
      sub: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
    });

    return { accessToken, refreshToken };
  },

  async refresh(token: string, signJwt: (payload: JwtPayload) => string): Promise<AuthTokens> {
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new AuthError(401, t('auth.token_expired'));
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new AuthError(401, t('auth.token_expired'));
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const newRefreshToken = generateRefreshToken();
    const refreshExpiresMs = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    const accessToken = signJwt({
      sub: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
    });

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    } else {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, locale: true, createdAt: true },
    });
    if (!user) {
      throw new AuthError(404, t('errors.not_found'));
    }
    return user;
  },

  async updateProfile(userId: string, data: { name?: string; locale?: string }) {
    if (data.name !== undefined) {
      if (data.name.length < 1 || data.name.length > 100) {
        throw new AuthError(400, 'Name must be between 1 and 100 characters');
      }
    }
    if (data.locale !== undefined) {
      if (!['en', 'fr'].includes(data.locale)) {
        throw new AuthError(400, 'Locale must be en or fr');
      }
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, locale: true, createdAt: true },
    });
    return user;
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AuthError(404, t('errors.not_found'));
    }
    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      throw new AuthError(401, 'Current password is incorrect');
    }
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.auditEvent.create({
      data: {
        action: 'PASSWORD_CHANGED',
        entityType: 'user',
        entityId: userId,
        actorId: userId,
        actorEmail: user.email,
      },
    });
  },
};

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}
