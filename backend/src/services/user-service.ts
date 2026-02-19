import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { UserRole } from '@prisma/client';
import { prisma } from '../infrastructure/database.js';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export class UserError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'UserError';
  }
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  locale: true,
  createdAt: true,
} as const;

export const userService = {
  /**
   * List all users (for validator picker and admin panel).
   * Returns all fields except password.
   */
  async listAll() {
    return prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * Get a single user by ID.
   */
  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new UserError(404, 'User not found');
    return user;
  },

  /**
   * Create a new user (admin operation).
   */
  async create(data: {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    locale?: string;
  }) {
    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new UserError(409, 'Email already registered');

    const hashedPassword = await hashPassword(data.password);
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role: data.role,
        locale: data.locale ?? 'fr',
      },
      select: USER_SELECT,
    });
  },

  /**
   * Update a user's name, role, or locale (admin operation).
   */
  async update(id: string, data: { name?: string; role?: UserRole; locale?: string }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserError(404, 'User not found');

    return prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.locale !== undefined && { locale: data.locale }),
      },
      select: USER_SELECT,
    });
  },

  /**
   * Delete a user (admin operation).
   * Guards: cannot delete if the target is the last admin.
   */
  async delete(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserError(404, 'User not found');

    // Guard: prevent deleting the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new UserError(409, 'Cannot delete the last admin account');
      }
    }

    await prisma.user.delete({ where: { id } });
  },
};
