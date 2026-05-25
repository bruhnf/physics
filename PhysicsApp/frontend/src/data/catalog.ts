/**
 * Frontend catalog of categories + experiments.
 *
 * Mirrors what the backend serves at /api/v1/categories and per-category
 * endpoints. Bundled here for Phase B (frontend-only nav rebuild). When
 * Phase C lands, the backend becomes authoritative and this file shrinks
 * to a slug→route resolver, with everything else fetched at runtime.
 */
export type Tier = 'BASE' | 'INTERMEDIATE' | 'ADVANCED';

export const TIER_LABEL: Record<Tier, string> = {
  BASE: 'Base',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export type ExperimentRef = {
  slug: string;
  name: string;
  subtitle: string;
  conceptCode: string;
  engineKey: string;
  tier: Tier;
  order: number;
  /** Route the frontend navigates to for this experiment */
  href: string;
};

export type CategoryRef = {
  slug: string;
  name: string;
  description: string;
  accentHex: string;
  iconText: string;
  experiments: ExperimentRef[];
};

export const CATEGORIES: CategoryRef[] = [
  {
    slug: 'physics',
    name: 'Physics',
    description: 'Matter, energy, and the fundamental forces.',
    accentHex: '#378ADD',
    iconText: '⚛',
    experiments: [
      { slug: 'trajectory', name: 'Trajectory', subtitle: 'Projectile motion // Earth gravity', conceptCode: 'KINEMATICS', engineKey: 'trajectory', tier: 'BASE', order: 1, href: '/level-01' },
      { slug: 'collisions', name: 'Collisions', subtitle: 'Momentum // 1D elastic', conceptCode: 'DYNAMICS', engineKey: 'collisions', tier: 'BASE', order: 2, href: '/level-02' },
      { slug: 'inclined-plane', name: 'Inclined Plane', subtitle: "Friction // Newton's 2nd law", conceptCode: 'DYNAMICS', engineKey: 'inclined-plane', tier: 'BASE', order: 3, href: '/level-03' },
      { slug: 'pendulum', name: 'Pendulum', subtitle: 'Periodic motion // SHM', conceptCode: 'OSCILLATION', engineKey: 'pendulum', tier: 'INTERMEDIATE', order: 1, href: '/level-04' },
      { slug: 'springs', name: 'Springs', subtitle: "Hooke's law // oscillation", conceptCode: 'ELASTIC ENERGY', engineKey: 'springs', tier: 'INTERMEDIATE', order: 2, href: '/level-05' },
      { slug: 'energy', name: 'Energy', subtitle: 'KE // PE // conservation', conceptCode: 'ENERGY', engineKey: 'energy', tier: 'INTERMEDIATE', order: 3, href: '/level-06' },
    ],
  },
  {
    slug: 'math',
    name: 'Math',
    description: 'Algebra, geometry, calculus — the language of STEM.',
    accentHex: '#1D9E75',
    iconText: 'ƒ',
    experiments: [], // Phase D
  },
  {
    slug: 'engineering',
    name: 'Engineering',
    description: 'Control systems, PID tuning, autonomous vehicles.',
    accentHex: '#E0A23A',
    iconText: '⚙',
    experiments: [], // Phase D
  },
];

export function findCategory(slug: string): CategoryRef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
