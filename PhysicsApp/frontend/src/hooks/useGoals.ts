/**
 * useGoals(slug) — fetch + cache + offline fallback + pre-warm next experiments.
 *
 * Behavior:
 *   1. On mount, returns whatever's already in cache (instant).
 *   2. If nothing cached, returns STARTER_PACK[slug] as fallback (instant).
 *   3. Fires a background fetch for this slug. On success, updates cache so
 *      subsequent renders get fresh data.
 *   4. Also pre-warms the next N experiments (catalog order) so transitions
 *      feel instant even when the network is slow.
 *   5. Never blocks the UI — fallbacks ensure goals are always available.
 *
 * The generic <T> lets callers cast `config` to their engine-specific shape.
 */
import { useEffect } from 'react';

import { fetchGoals } from '@/api/experiments';
import { CATEGORIES } from '@/data/catalog';
import { STARTER_PACK, type GoalLike } from '@/data/starter-pack';
import { useExperimentCache } from '@/store/useExperimentCache';

const PREWARM_COUNT = 2;

/** All experiment slugs across categories, in catalog order. */
function allSlugsInOrder(): string[] {
  return CATEGORIES.flatMap((c) => c.experiments.map((e) => e.slug));
}

function getNextSlugs(currentSlug: string, count: number): string[] {
  const all = allSlugsInOrder();
  const idx = all.indexOf(currentSlug);
  if (idx < 0) return [];
  return all.slice(idx + 1, idx + 1 + count);
}

type TypedGoal<TConfig> = {
  order: number;
  hint: string | null;
  config: TConfig;
};

export type UseGoalsResult<TConfig> = {
  goals: TypedGoal<TConfig>[];
  status: 'loading' | 'fresh' | 'stale' | 'fallback';
  /** True only on the very first frame before fallback or cache fills in. */
  isLoading: boolean;
};

export function useGoals<TConfig = Record<string, unknown>>(
  slug: string,
): UseGoalsResult<TConfig> {
  const cached = useExperimentCache((s) => s.entries[slug]);
  const setEntry = useExperimentCache((s) => s.setEntry);

  useEffect(() => {
    let cancelled = false;

    // 1. Fetch this experiment's goals in the background.
    fetchGoals(slug)
      .then((data) => {
        if (cancelled) return;
        setEntry(slug, {
          status: 'fresh',
          goals: data.goals.map((g) => ({ order: g.order, hint: g.hint ?? '', config: g.config })),
          fetchedAt: Date.now(),
        });
      })
      .catch(() => {
        // Backend unreachable — ensure something's in cache so future reads
        // don't keep retrying. If nothing's cached and we have a fallback,
        // surface it through the cache as well.
        if (cancelled) return;
        const current = useExperimentCache.getState().entries[slug];
        if (!current) {
          const fallback = STARTER_PACK[slug];
          if (fallback) {
            setEntry(slug, { status: 'fallback', goals: fallback, fetchedAt: 0 });
          }
        }
      });

    // 2. Pre-warm the next N experiments (best-effort; ignore failures).
    for (const next of getNextSlugs(slug, PREWARM_COUNT)) {
      const existing = useExperimentCache.getState().entries[next];
      // Only prewarm if we don't already have fresh data (avoid duplicate fetches)
      if (existing?.status === 'fresh') continue;
      fetchGoals(next)
        .then((data) => {
          setEntry(next, {
            status: 'fresh',
            goals: data.goals.map((g) => ({ order: g.order, hint: g.hint ?? '', config: g.config })),
            fetchedAt: Date.now(),
          });
        })
        .catch(() => {
          // Pre-warm failure is silent — fallback is still there if needed.
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Render-time fallback (independent of background fetch). Cached entry
  // wins if present; otherwise the bundled starter pack; otherwise empty.
  const fallbackPack = STARTER_PACK[slug];
  const source: { goals: GoalLike[]; status: 'fresh' | 'stale' | 'fallback' } | null = cached
    ? cached
    : fallbackPack
      ? { goals: fallbackPack, status: 'fallback' }
      : null;

  if (!source) {
    return { goals: [], status: 'loading', isLoading: true };
  }

  return {
    goals: source.goals.map((g) => ({
      order: g.order,
      hint: g.hint ?? '',
      config: g.config as TConfig,
    })),
    status: source.status,
    isLoading: false,
  };
}
