import { PrismaClient } from '@prisma/client';

// Singleton Prisma client. Reuses connection pool across requests.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});
