/**
 * In-memory cache of fetched goal sets, keyed by experiment slug.
 *
 * Each entry tracks where the data came from (fresh from backend / stale /
 * fallback from bundled starter pack) so the UI can show a tiny "offline"
 * indicator if we ever need one.
 *
 * Today: pure in-memory (resets on app reload). When persistence lands,
 * swap to Zustand persist middleware with expo-secure-store adapter.
 */
import { create } from 'zustand';

import type { GoalLike } from '@/data/starter-pack';

export type CacheStatus = 'fresh' | 'stale' | 'fallback';

export type CacheEntry = {
  status: CacheStatus;
  goals: GoalLike[];
  /** Epoch ms — 0 if never fetched (fallback only) */
  fetchedAt: number;
};

type CacheState = {
  entries: Record<string, CacheEntry>;
  setEntry: (slug: string, entry: CacheEntry) => void;
  markStale: (slug: string) => void;
  clear: () => void;
};

export const useExperimentCache = create<CacheState>((set) => ({
  entries: {},
  setEntry: (slug, entry) =>
    set((state) => ({ entries: { ...state.entries, [slug]: entry } })),
  markStale: (slug) =>
    set((state) => {
      const current = state.entries[slug];
      if (!current) return {};
      return { entries: { ...state.entries, [slug]: { ...current, status: 'stale' } } };
    }),
  clear: () => set({ entries: {} }),
}));
