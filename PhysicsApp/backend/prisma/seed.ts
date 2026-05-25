/**
 * Seeds the STEM Lab database with:
 *   - Categories: Physics, Math, Engineering (Math + Engineering have no
 *     experiments yet — frontend handles empty categories gracefully).
 *   - 6 Physics experiments matching the bundled engines (Trajectory,
 *     Collisions, Inclined Plane, Pendulum, Springs, Energy).
 *   - 10 goals per experiment, copied from the bundled defaults so the
 *     "first launch with no backend yet" experience matches what shipped
 *     in the current binary, then becomes editable server-side from here on.
 *
 * Idempotent: upserts by slug, so running multiple times is safe.
 *
 * Usage:
 *   npm run db:seed           # seed without touching schema
 *   npm run db:reset          # full migrate reset + seed
 */
import { Prisma, PrismaClient, Tier } from '@prisma/client';

const prisma = new PrismaClient();

// ---------- Helpers ----------

async function upsertCategory(args: {
  slug: string;
  name: string;
  description: string;
  iconSlug: string;
  accentHex: string;
  order: number;
}) {
  return prisma.category.upsert({
    where: { slug: args.slug },
    create: args,
    update: {
      name: args.name,
      description: args.description,
      iconSlug: args.iconSlug,
      accentHex: args.accentHex,
      order: args.order,
    },
  });
}

type GoalSeed = { order: number; hint: string; config: Record<string, unknown> };

async function upsertExperiment(args: {
  slug: string;
  name: string;
  subtitle: string;
  conceptCode: string;
  engineKey: string;
  tier: Tier;
  order: number;
  categoryId: string;
  instructions: { title: string; explanation: string };
  goals: GoalSeed[];
}) {
  const exp = await prisma.experiment.upsert({
    where: { slug: args.slug },
    create: {
      slug: args.slug,
      name: args.name,
      subtitle: args.subtitle,
      conceptCode: args.conceptCode,
      engineKey: args.engineKey,
      tier: args.tier,
      order: args.order,
      categoryId: args.categoryId,
      instructions: args.instructions,
    },
    update: {
      name: args.name,
      subtitle: args.subtitle,
      conceptCode: args.conceptCode,
      engineKey: args.engineKey,
      tier: args.tier,
      order: args.order,
      categoryId: args.categoryId,
      instructions: args.instructions,
    },
  });

  // Replace goals atomically — simpler than diffing
  await prisma.goal.deleteMany({ where: { experimentId: exp.id } });
  await prisma.goal.createMany({
    data: args.goals.map((g) => ({
      experimentId: exp.id,
      order: g.order,
      hint: g.hint,
      config: g.config as Prisma.InputJsonValue,
    })),
  });

  return exp;
}

// ---------- Seed data ----------

async function main() {
  console.log('Seeding categories…');
  const physics = await upsertCategory({
    slug: 'physics',
    name: 'Physics',
    description: 'Matter, energy, and the fundamental forces.',
    iconSlug: 'atom',
    accentHex: '#378ADD',
    order: 1,
  });
  await upsertCategory({
    slug: 'math',
    name: 'Math',
    description: 'Algebra, geometry, calculus — the language of STEM.',
    iconSlug: 'function',
    accentHex: '#1D9E75',
    order: 2,
  });
  await upsertCategory({
    slug: 'engineering',
    name: 'Engineering',
    description: 'Control systems, PID tuning, autonomous vehicles.',
    iconSlug: 'cog',
    accentHex: '#E0A23A',
    order: 3,
  });

  console.log('Seeding Physics experiments…');

  await upsertExperiment({
    slug: 'trajectory',
    name: 'Trajectory',
    subtitle: 'Projectile motion // Earth gravity',
    conceptCode: 'KINEMATICS',
    engineKey: 'trajectory',
    tier: Tier.BASE,
    order: 1,
    categoryId: physics.id,
    instructions: {
      title: 'Level 01 — Trajectory',
      explanation:
        "Adjust ANGLE and VELOCITY with the sliders (or the +/− buttons for precise tuning). Your goal: land the projectile inside the green target zone. From Goal 4 onward, walls appear between you and the target — you'll need a higher arc to clear them.",
    },
    goals: [
      { order: 1, hint: 'Warm-up — any reasonable angle works', config: { distanceM: 30, widthM: 3.0 } },
      { order: 2, hint: 'Find a v + θ pair that lands here', config: { distanceM: 50, widthM: 2.0 } },
      { order: 3, hint: 'Further out — more energy needed', config: { distanceM: 70, widthM: 2.0 } },
      { order: 4, hint: 'First wall — steeper arc required', config: { distanceM: 40, widthM: 1.0, hasWall: true } },
      { order: 5, hint: 'Wall + narrower window', config: { distanceM: 60, widthM: 1.0, hasWall: true } },
      { order: 6, hint: 'Mid-field wall — favor altitude', config: { distanceM: 80, widthM: 1.0, hasWall: true } },
      { order: 7, hint: 'Tiny target — almost vertical arc', config: { distanceM: 25, widthM: 0.5, hasWall: true } },
      { order: 8, hint: 'Bigger wall, further out', config: { distanceM: 90, widthM: 1.0, hasWall: true } },
      { order: 9, hint: 'Descend over the wall to hit the mark', config: { distanceM: 100, widthM: 0.8, hasWall: true } },
      { order: 10, hint: 'Final shot — high wall + tight target', config: { distanceM: 110, widthM: 0.5, hasWall: true } },
    ],
  });

  await upsertExperiment({
    slug: 'collisions',
    name: 'Collisions',
    subtitle: 'Momentum // 1D elastic',
    conceptCode: 'DYNAMICS',
    engineKey: 'collisions',
    tier: Tier.BASE,
    order: 2,
    categoryId: physics.id,
    instructions: {
      title: 'Level 02 — Collisions',
      explanation:
        'Launch your BLUE ball at the ORANGE target. Adjust your ball\'s MASS and VELOCITY. Goal: knock the orange target into the green zone and have it come to REST inside — friction stops both balls.',
    },
    goals: [
      { order: 1, hint: 'Equal masses — what happens to the player ball?', config: { targetMassKg: 1.0, targetStartM: 15, zoneCenterM: 25, zoneWidthM: 10 } },
      { order: 2, hint: 'Heavier target needs more momentum', config: { targetMassKg: 2.0, targetStartM: 20, zoneCenterM: 32, zoneWidthM: 5 } },
      { order: 3, hint: 'Light target — small mass with high v transfers a lot', config: { targetMassKg: 0.5, targetStartM: 15, zoneCenterM: 38, zoneWidthM: 4 } },
      { order: 4, hint: 'Heavy target, short throw — try matching masses', config: { targetMassKg: 3.0, targetStartM: 25, zoneCenterM: 37, zoneWidthM: 4 } },
      { order: 5, hint: 'Long throw — friction eats your reach', config: { targetMassKg: 1.0, targetStartM: 10, zoneCenterM: 47, zoneWidthM: 4 } },
      { order: 6, hint: 'Heavy + precise — m₁ ≈ m₂ delivers cleanly', config: { targetMassKg: 5.0, targetStartM: 20, zoneCenterM: 30, zoneWidthM: 3 } },
      { order: 7, hint: 'Far + medium target — crank velocity', config: { targetMassKg: 2.0, targetStartM: 15, zoneCenterM: 51, zoneWidthM: 3 } },
      { order: 8, hint: 'Heavy + far — push m₁ high', config: { targetMassKg: 4.0, targetStartM: 30, zoneCenterM: 49, zoneWidthM: 3 } },
      { order: 9, hint: 'Very light target — lean on v₁', config: { targetMassKg: 0.5, targetStartM: 10, zoneCenterM: 60, zoneWidthM: 4 } },
      { order: 10, hint: 'Bowling-ball target — needs maximum m₁', config: { targetMassKg: 10.0, targetStartM: 25, zoneCenterM: 36, zoneWidthM: 2 } },
    ],
  });

  await upsertExperiment({
    slug: 'inclined-plane',
    name: 'Inclined Plane',
    subtitle: "Friction // Newton's 2nd law",
    conceptCode: 'DYNAMICS',
    engineKey: 'inclined-plane',
    tier: Tier.BASE,
    order: 3,
    categoryId: physics.id,
    instructions: {
      title: 'Level 03 — Inclined Plane',
      explanation:
        'A block slides down a ramp onto a flat surface. Adjust HEIGHT (h) and ANGLE (θ). Each goal uses a different surface — ICE is slippery, SANDPAPER is grippy, CARPET bites hard. Goal: stop the block inside the green zone on the flat.',
    },
    goals: [
      { order: 1, hint: 'Solid surface — moderate friction', config: { surface: 'WOOD', mu: 0.2, zoneCenterM: 10, zoneWidthM: 4 } },
      { order: 2, hint: 'Grippier surface, narrower zone', config: { surface: 'GRASS', mu: 0.3, zoneCenterM: 7, zoneWidthM: 2 } },
      { order: 3, hint: 'Slick — block carries energy far', config: { surface: 'METAL', mu: 0.1, zoneCenterM: 16, zoneWidthM: 4 } },
      { order: 4, hint: 'Heavy friction — short throw, tight target', config: { surface: 'RUBBER', mu: 0.5, zoneCenterM: 2.5, zoneWidthM: 1 } },
      { order: 5, hint: 'Carpet bites hard — moderate range, deliberate angle', config: { surface: 'CARPET', mu: 0.4, zoneCenterM: 5, zoneWidthM: 1.5 } },
      { order: 6, hint: 'Maximum friction — needs steep ramp to slide at all', config: { surface: 'SANDPAPER', mu: 0.7, zoneCenterM: 1.3, zoneWidthM: 0.6 } },
      { order: 7, hint: 'Slick + far — find the angle that maximizes range', config: { surface: 'METAL', mu: 0.1, zoneCenterM: 27, zoneWidthM: 4 } },
      { order: 8, hint: 'Near grass-friction ceiling', config: { surface: 'GRASS', mu: 0.3, zoneCenterM: 11, zoneWidthM: 2 } },
      { order: 9, hint: 'Near wood-friction ceiling', config: { surface: 'WOOD', mu: 0.2, zoneCenterM: 19.5, zoneWidthM: 3 } },
      { order: 10, hint: 'Slick + far + precise', config: { surface: 'ICE', mu: 0.05, zoneCenterM: 36, zoneWidthM: 2 } },
    ],
  });

  await upsertExperiment({
    slug: 'pendulum',
    name: 'Pendulum',
    subtitle: 'Periodic motion // SHM',
    conceptCode: 'OSCILLATION',
    engineKey: 'pendulum',
    tier: Tier.INTERMEDIATE,
    order: 1,
    categoryId: physics.id,
    instructions: {
      title: 'Level 04 — Pendulum',
      explanation:
        'Tune the STRING LENGTH and SWING AMPLITUDE. The bob swings down and auto-releases at the bottom — becoming a horizontal projectile. Goal: bob lands in the green zone on the ground.',
    },
    goals: [
      { order: 1, hint: 'Warm-up — generous zone', config: { zoneCenterM: 2, zoneWidthM: 1.5 } },
      { order: 2, hint: 'Slightly further, slightly tighter', config: { zoneCenterM: 3.5, zoneWidthM: 1 } },
      { order: 3, hint: 'Mid-range — what L gives max range?', config: { zoneCenterM: 5, zoneWidthM: 1 } },
      { order: 4, hint: 'Pull back close — short swing', config: { zoneCenterM: 1, zoneWidthM: 0.5 } },
      { order: 5, hint: 'Far + medium', config: { zoneCenterM: 6, zoneWidthM: 0.8 } },
      { order: 6, hint: 'Reaching out', config: { zoneCenterM: 7, zoneWidthM: 0.6 } },
      { order: 7, hint: 'Precise mid-range', config: { zoneCenterM: 4, zoneWidthM: 0.4 } },
      { order: 8, hint: 'Near max-range territory', config: { zoneCenterM: 8, zoneWidthM: 0.5 } },
      { order: 9, hint: 'Very close, very tight', config: { zoneCenterM: 0.6, zoneWidthM: 0.3 } },
      { order: 10, hint: 'Final shot — push to max range', config: { zoneCenterM: 9, zoneWidthM: 0.4 } },
    ],
  });

  await upsertExperiment({
    slug: 'springs',
    name: 'Springs',
    subtitle: "Hooke's law // oscillation",
    conceptCode: 'ELASTIC ENERGY',
    engineKey: 'springs',
    tier: Tier.INTERMEDIATE,
    order: 2,
    categoryId: physics.id,
    instructions: {
      title: 'Level 05 — Springs',
      explanation:
        'Compress the SPRING by x meters and pick its STIFFNESS k. On release, spring energy launches the block down a friction track. Goal: block comes to rest inside the green zone.',
    },
    goals: [
      { order: 1, hint: 'Warm-up — wide zone', config: { massKg: 1.0, zoneCenterM: 6, zoneWidthM: 3 } },
      { order: 2, hint: 'Heavier block, same launcher', config: { massKg: 2.0, zoneCenterM: 4, zoneWidthM: 2 } },
      { order: 3, hint: 'Further out', config: { massKg: 1.0, zoneCenterM: 11, zoneWidthM: 2 } },
      { order: 4, hint: 'Heavy + far — more energy needed', config: { massKg: 3.0, zoneCenterM: 16, zoneWidthM: 3 } },
      { order: 5, hint: 'Soft launch — minimize energy', config: { massKg: 1.0, zoneCenterM: 1.5, zoneWidthM: 0.8 } },
      { order: 6, hint: 'Heavy block, mid range', config: { massKg: 5.0, zoneCenterM: 13, zoneWidthM: 2 } },
      { order: 7, hint: 'Crank k or x — likely both', config: { massKg: 2.0, zoneCenterM: 22, zoneWidthM: 2 } },
      { order: 8, hint: 'Long throw — k near max', config: { massKg: 1.0, zoneCenterM: 32, zoneWidthM: 2 } },
      { order: 9, hint: 'Heavy + tight — precise energy', config: { massKg: 4.0, zoneCenterM: 9, zoneWidthM: 1 } },
      { order: 10, hint: 'Final — max compression + max k', config: { massKg: 3.0, zoneCenterM: 41, zoneWidthM: 2 } },
    ],
  });

  await upsertExperiment({
    slug: 'energy',
    name: 'Energy Conservation',
    subtitle: 'KE // PE // conservation',
    conceptCode: 'ENERGY',
    engineKey: 'energy',
    tier: Tier.INTERMEDIATE,
    order: 3,
    categoryId: physics.id,
    instructions: {
      title: 'Level 06 — Energy',
      explanation:
        'The cart starts at HEIGHT h on the left hill. It slides down, across a friction valley, then up the right hill. Goal: cart stops at the target height marker on the right hill. Try the MASS slider — does it actually matter?',
    },
    goals: [
      { order: 1, hint: 'Warm-up — small friction loss', config: { frictionMu: 0.2, valleyWidthM: 2, targetHeightM: 3, zoneHeightM: 1 } },
      { order: 2, hint: 'Wider valley, more loss', config: { frictionMu: 0.3, valleyWidthM: 3, targetHeightM: 5, zoneHeightM: 0.8 } },
      { order: 3, hint: 'Heavy friction, short valley', config: { frictionMu: 0.5, valleyWidthM: 2, targetHeightM: 2, zoneHeightM: 0.6 } },
      { order: 4, hint: 'Slippery valley, far target', config: { frictionMu: 0.1, valleyWidthM: 5, targetHeightM: 7, zoneHeightM: 0.8 } },
      { order: 5, hint: 'Try the mass slider — does it matter?', config: { frictionMu: 0.4, valleyWidthM: 4, targetHeightM: 4, zoneHeightM: 0.5 } },
      { order: 6, hint: 'Almost all energy lost in valley', config: { frictionMu: 0.6, valleyWidthM: 3, targetHeightM: 1, zoneHeightM: 0.4 } },
      { order: 7, hint: 'Long valley — accumulated friction', config: { frictionMu: 0.2, valleyWidthM: 8, targetHeightM: 6, zoneHeightM: 0.5 } },
      { order: 8, hint: "Mass STILL doesn't matter — try changing it", config: { frictionMu: 0.5, valleyWidthM: 5, targetHeightM: 3, zoneHeightM: 0.4 } },
      { order: 9, hint: 'Wide friction zone', config: { frictionMu: 0.3, valleyWidthM: 10, targetHeightM: 4, zoneHeightM: 0.4 } },
      { order: 10, hint: 'Final — heavy friction + tight target', config: { frictionMu: 0.7, valleyWidthM: 6, targetHeightM: 2, zoneHeightM: 0.3 } },
    ],
  });

  console.log('✅ Seed complete.');
  console.log('  3 categories created (Physics has 6 experiments; Math + Engineering are empty placeholders).');
  console.log('  6 experiments seeded with 10 goals each = 60 goal configs.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
