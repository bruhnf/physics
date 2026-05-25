import { Router } from 'express';

import { prisma } from '../db';

export const categoriesRouter: Router = Router();

/**
 * GET /api/v1/categories
 * Returns all categories with the count of experiments per tier.
 */
categoriesRouter.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        experiments: { select: { tier: true } },
      },
    });

    const data = categories.map((c) => {
      const tierCounts: Record<string, number> = { BASE: 0, INTERMEDIATE: 0, ADVANCED: 0 };
      for (const exp of c.experiments) tierCounts[exp.tier]++;
      return {
        slug: c.slug,
        name: c.name,
        description: c.description,
        iconSlug: c.iconSlug,
        accentHex: c.accentHex,
        order: c.order,
        experimentCount: c.experiments.length,
        tierCounts,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/categories/:slug/experiments
 * Returns all experiments in a category, grouped/ordered for display.
 */
categoriesRouter.get('/:slug/experiments', async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: {
        experiments: {
          orderBy: [{ tier: 'asc' }, { order: 'asc' }],
          select: {
            slug: true,
            name: true,
            subtitle: true,
            conceptCode: true,
            engineKey: true,
            tier: true,
            order: true,
            goals: { select: { id: true } },
          },
        },
      },
    });

    if (!category) {
      res.status(404).json({ success: false, error: `Category not found: ${req.params.slug}` });
      return;
    }

    res.json({
      success: true,
      data: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        accentHex: category.accentHex,
        experiments: category.experiments.map((exp) => ({
          slug: exp.slug,
          name: exp.name,
          subtitle: exp.subtitle,
          conceptCode: exp.conceptCode,
          engineKey: exp.engineKey,
          tier: exp.tier,
          order: exp.order,
          goalCount: exp.goals.length,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});
