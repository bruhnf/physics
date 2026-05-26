/**
 * Bundled offline fallback for goal configs.
 *
 * Identical to what the backend seeded for the 6 starter Physics
 * experiments. If the backend is unreachable on first launch, the app
 * still works using this data.
 *
 * Keep in sync with PhysicsApp/backend/prisma/seed.ts. (Eventually a
 * codegen step could derive both from one source; for now, manual sync.)
 *
 * Once a backend fetch succeeds, the fresh data overrides this fallback
 * for the rest of the session.
 */
export type GoalLike = {
  order: number;
  hint: string;
  config: Record<string, unknown>;
};

export const STARTER_PACK: Record<string, GoalLike[]> = {
  trajectory: [
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
  collisions: [
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
  'inclined-plane': [
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
  pendulum: [
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
  springs: [
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
  energy: [
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
};
