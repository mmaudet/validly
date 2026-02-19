export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  HOST: process.env.HOST ?? '0.0.0.0',

  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://validly:validly_dev@localhost:5432/validly',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',

  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? '1025', 10),
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  SMTP_FROM: process.env.SMTP_FROM ?? 'noreply@validly.local',

  STORAGE_PATH: process.env.STORAGE_PATH ?? './storage',

  APP_URL: process.env.APP_URL ?? 'http://localhost:8080',
  API_URL: process.env.API_URL ?? 'http://localhost:3000',
} as const;
