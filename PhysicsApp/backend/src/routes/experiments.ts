import { Router } from 'express';

import { prisma } from '../db';

export const experimentsRouter: Router = Router();

/**
 * GET /api/v1/experiments/:slug
 * Returns single experiment metadata + instructional overlay content.
 */
experimentsRouter.get('/:slug', async (req, res, next) => {
  try {
    const exp = await prisma.experiment.findUnique({
      where: { slug: req.params.slug },
      include: { category: { select: { slug: true, name: true, accentHex: true } } },
    });

    if (!exp) {
      res.status(404).json({ success: false, error: `Experiment not found: ${req.params.slug}` });
      return;
    }

    res.json({
      success: true,
      data: {
        slug: exp.slug,
        name: exp.name,
        subtitle: exp.subtitle,
        conceptCode: exp.conceptCode,
        engineKey: exp.engineKey,
        tier: exp.tier,
        category: exp.category,
        instructions: exp.instructions,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/experiments/:slug/goals
 * Returns the ordered goal configs for an experiment.
 */
experimentsRouter.get('/:slug/goals', async (req, res, next) => {
  try {
    const exp = await prisma.experiment.findUnique({
      where: { slug: req.params.slug },
      include: { goals: { orderBy: { order: 'asc' } } },
    });

    if (!exp) {
      res.status(404).json({ success: false, error: `Experiment not found: ${req.params.slug}` });
      return;
    }

    res.json({
      success: true,
      data: {
        experimentSlug: exp.slug,
        engineKey: exp.engineKey,
        goals: exp.goals.map((g) => ({
          order: g.order,
          hint: g.hint,
          config: g.config,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});
