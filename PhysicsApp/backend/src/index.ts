/**
 * STEM Lab backend — Express + Prisma + Postgres.
 *
 * Serves experiment + goal content to the mobile app. Engines live in the app
 * bundle; this server is the CONTENT delivery layer.
 *
 * Response shape (every endpoint): { success: boolean, data?: T, error?: string }
 */
import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { logger } from './logger';
import { categoriesRouter } from './routes/categories';
import { experimentsRouter } from './routes/experiments';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? true,
    credentials: false,
  }),
);
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 300, // 300 req / minute / IP — generous for a content-delivery API
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: Date.now() } });
});

app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/experiments', experimentsRouter);

// 404 — everything not matched above
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` });
});

// Centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error(err instanceof Error ? err : new Error(message));
  res.status(500).json({ success: false, error: message });
});

app.listen(PORT, () => {
  logger.info(`STEM Lab backend listening on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});
