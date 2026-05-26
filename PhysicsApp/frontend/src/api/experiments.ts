/**
 * Typed endpoints for the experiments/goals API.
 *
 * Shape of `config` inside each goal varies by experiment engine — typed
 * generically here and cast by the consuming level component.
 */
import { apiFetch } from './client';

export type ApiGoal = {
  order: number;
  hint: string | null;
  config: Record<string, unknown>;
};

export type ApiGoalsResponse = {
  experimentSlug: string;
  engineKey: string;
  goals: ApiGoal[];
};

export type ApiCategory = {
  slug: string;
  name: string;
  description: string | null;
  iconSlug: string | null;
  accentHex: string | null;
  order: number;
  experimentCount: number;
  tierCounts: Record<'BASE' | 'INTERMEDIATE' | 'ADVANCED', number>;
};

export type ApiExperimentSummary = {
  slug: string;
  name: string;
  subtitle: string | null;
  conceptCode: string | null;
  engineKey: string;
  tier: 'BASE' | 'INTERMEDIATE' | 'ADVANCED';
  order: number;
  goalCount: number;
};

export type ApiExperimentDetails = {
  slug: string;
  name: string;
  subtitle: string | null;
  conceptCode: string | null;
  engineKey: string;
  tier: 'BASE' | 'INTERMEDIATE' | 'ADVANCED';
  category: { slug: string; name: string; accentHex: string | null };
  instructions: { title: string; explanation: string } | null;
};

export function fetchGoals(slug: string): Promise<ApiGoalsResponse> {
  return apiFetch<ApiGoalsResponse>(`/api/v1/experiments/${encodeURIComponent(slug)}/goals`);
}

export function fetchExperiment(slug: string): Promise<ApiExperimentDetails> {
  return apiFetch<ApiExperimentDetails>(`/api/v1/experiments/${encodeURIComponent(slug)}`);
}

export function fetchCategories(): Promise<ApiCategory[]> {
  return apiFetch<ApiCategory[]>('/api/v1/categories');
}

export function fetchCategoryExperiments(
  slug: string,
): Promise<{ slug: string; name: string; description: string | null; accentHex: string | null; experiments: ApiExperimentSummary[] }> {
  return apiFetch(`/api/v1/categories/${encodeURIComponent(slug)}/experiments`);
}
