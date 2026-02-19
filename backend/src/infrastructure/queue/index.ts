import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

// Shared Redis connection with maxRetriesPerRequest: null (required by BullMQ)
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err: Error) => {
  console.error('Redis connection error:', err);
});

// BullMQ queue for deadline reminder jobs
export const reminderQueue = new Queue('reminders', {
  connection: redisConnection,
});
