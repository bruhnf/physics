/**
 * Level 01 — Trajectory (projectile motion on Earth).
 *
 * Engine-proof + polished:
 * - Hand-integrated projectile motion in a Reanimated useFrameCallback worklet
 *   (physics state lives in shared values, tick runs on UI thread).
 * - Matter.js NOT used here — unit mapping for "real m/s²" gets awkward; for
 *   kinematics this is three lines of math. Matter.js earns its install at
 *   Level 02+ where its solver actually matters (collisions, springs, etc.).
 * - Continuous sliders (precision matters for the hardest goals).
 * - 10-goal progression (data is inline for now; extract once Level 02 reveals
 *   what variation the abstraction needs to support).
 * - Haptic feedback via expo-haptics.
 * - Collapsible instructional overlay with the kinematics formula.
 */
import { Canvas, Circle, Line, Path, Rect, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Lazy-require: expo-keep-awake throws at IMPORT time when its native module
// isn't in the current dev client. Stub the hook to a no-op until the rebuild.
let useKeepAwake: () => void = () => {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useKeepAwake = require('expo-keep-awake').useKeepAwake;
} catch {
  // Native module not present — screen will follow normal iOS sleep timer.
}
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useSounds } from '@/hooks/useSounds';
import { Slider } from '@/ui/Slider';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

// ---------- Physics ----------
const GRAVITY = 9.81; // m/s²

// ---------- Viewport ----------
const WORLD_WIDTH_M = 130; // fits hardest goal (target at 120m) with margin
const CANNON_WORLD_X = 10; // meters from left edge

// ---------- Controls ----------
const ANGLE_MIN = 5;
const ANGLE_MAX = 85;
const VELOCITY_MIN = 5;
const VELOCITY_MAX = 60;

// ---------- Goals ----------
type Wall = { distanceM: number; heightM: number };
type Goal = {
  distanceM: number;
  widthM: number;
  hint: string;
  hasWall?: boolean;
};

const WALL_WIDTH_M = 1.0;
const WALL_VISUAL_CAP_M = 55; // canvas height budget for tallest walls

const GOALS: Goal[] = [
  { distanceM: 30, widthM: 3.0, hint: 'Warm-up — any reasonable angle works' },
  { distanceM: 50, widthM: 2.0, hint: 'Find a v + θ pair that lands here' },
  { distanceM: 70, widthM: 2.0, hint: 'Further out — more energy needed' },
  { distanceM: 40, widthM: 1.0, hint: 'First wall — steeper arc required', hasWall: true },
  { distanceM: 60, widthM: 1.0, hint: 'Wall + narrower window', hasWall: true },
  { distanceM: 80, widthM: 1.0, hint: 'Mid-field wall — favor altitude', hasWall: true },
  { distanceM: 25, widthM: 0.5, hint: 'Tiny target — almost vertical arc', hasWall: true },
  { distanceM: 90, widthM: 1.0, hint: 'Bigger wall, further out', hasWall: true },
  { distanceM: 100, widthM: 0.8, hint: 'Descend over the wall to hit the mark', hasWall: true },
  { distanceM: 110, widthM: 0.5, hint: 'Final shot — high wall + tight target', hasWall: true },
];

// Defaults always reset on goal advance / reset / replay so each fresh attempt
// starts from a known baseline. The player iterates from here.
const DEFAULT_ANGLE = 45;
const DEFAULT_VELOCITY = 25;

/**
 * Pick a wall (position + height) for a target at distance D that is:
 *   - large enough to be a meaningful obstacle (forces an arc, not a flat shot)
 *   - small enough that the goal stays solvable inside the slider ranges
 *     (v ≤ 60 m/s, θ ≤ 85°)
 *   - capped at WALL_VISUAL_CAP_M so it fits in the canvas
 *
 * Position is randomized to 30–70% of the way from launcher to target.
 * Height ceiling = 80% of the y achievable at that x by a θ=75° trajectory
 * that exactly hits the target — a generous-but-not-impossible bound.
 */
function randomizeWall(targetDistanceM: number): Wall {
  const distFrac = 0.3 + Math.random() * 0.4;
  const dWall = Math.max(5, Math.round(targetDistanceM * distFrac));

  const theta75 = (75 * Math.PI) / 180;
  const tan75 = Math.tan(theta75);
  const cos75sq = Math.cos(theta75) ** 2;
  const vSq = (targetDistanceM * GRAVITY) / Math.sin(2 * theta75);
  const maxYAtWall = dWall * tan75 - (GRAVITY * dWall * dWall) / (2 * vSq * cos75sq);

  const safeMax = Math.min(maxYAtWall * 0.8, WALL_VISUAL_CAP_M);
  const minH = Math.max(7, safeMax * 0.5);
  const ceiling = Math.max(safeMax, minH + 1);
  const heightM = Math.round(minH + Math.random() * (ceiling - minH));

  return { distanceM: dWall, heightM };
}

const CLOSE_BUFFER_M = 3; // "close" = beyond goal half-width but within this extra margin

// ---------- Helpers ----------
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ---------- Component ----------
type Outcome = 'idle' | 'flying' | 'hit' | 'close' | 'miss' | 'wall-hit' | 'level-complete';

export default function Level01Trajectory() {
  // Prevent the iPhone from auto-sleeping while the player is on this screen —
  // they can stare at a hard goal for minutes thinking about the math.
  useKeepAwake();

  const playSound = useSounds();

  const { width: screenWidth } = useWindowDimensions();
  const canvasHeight = 260;

  const [angleDeg, setAngleDeg] = useState(DEFAULT_ANGLE);
  const [velocity, setVelocity] = useState(DEFAULT_VELOCITY);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [landingDistanceM, setLandingDistanceM] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  // Bumped on resetLevel() to force wall re-randomization even when
  // currentGoalIndex resets to its existing value (0 → 0 wouldn't trigger
  // the goal-change effect on its own).
  const [sessionVersion, setSessionVersion] = useState(0);
  const [currentWall, setCurrentWall] = useState<Wall | null>(() =>
    GOALS[0].hasWall ? randomizeWall(GOALS[0].distanceM) : null,
  );

  const pxPerM = screenWidth / WORLD_WIDTH_M;
  const groundPxY = canvasHeight - 24;
  const cannonPxX = CANNON_WORLD_X * pxPerM;

  const currentGoal = GOALS[Math.min(currentGoalIndex, GOALS.length - 1)];
  const targetWorldX = CANNON_WORLD_X + currentGoal.distanceM;
  const targetPxX = targetWorldX * pxPerM;
  const targetPxWidth = currentGoal.widthM * pxPerM;

  // Re-roll the wall whenever we land on a new goal (or replay the level).
  useEffect(() => {
    const goal = GOALS[currentGoalIndex];
    setCurrentWall(goal.hasWall ? randomizeWall(goal.distanceM) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGoalIndex, sessionVersion]);

  // Physics state (UI thread)
  const posX = useSharedValue(CANNON_WORLD_X);
  const posY = useSharedValue(0);
  const velX = useSharedValue(0);
  const velY = useSharedValue(0);
  const isFlying = useSharedValue(false);
  const trail = useSharedValue<number[]>([]);

  // Wall state mirrored into shared values so the worklet can read it without
  // crossing the JS/UI thread boundary on every frame.
  const hasWall = useSharedValue(false);
  const wallX = useSharedValue(0);
  const wallHeight = useSharedValue(0);

  useEffect(() => {
    if (currentWall) {
      hasWall.value = true;
      wallX.value = CANNON_WORLD_X + currentWall.distanceM;
      wallHeight.value = currentWall.heightM;
    } else {
      hasWall.value = false;
      wallX.value = 0;
      wallHeight.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWall]);

  const projPxX = useDerivedValue(() => posX.value * pxPerM);
  const projPxY = useDerivedValue(() => groundPxY - posY.value * pxPerM);

  const trailPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const pts = trail.value;
    if (pts.length >= 2) {
      path.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) {
        path.lineTo(pts[i], pts[i + 1]);
      }
    }
    return path;
  });

  // Advance timer for auto-progression after a hit
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unified haptic + sound feedback. All native calls guarded — they silently
  // no-op if the corresponding native module isn't compiled into the dev client.
  type FeedbackKind = 'hit' | 'close' | 'miss' | 'wall-hit' | 'level-complete' | 'launch';
  const triggerFeedback = useCallback(
    (kind: FeedbackKind) => {
      const swallow = () => {};

      // Haptic
      if (kind === 'hit' || kind === 'level-complete')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow);
      else if (kind === 'close')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(swallow);
      else if (kind === 'miss' || kind === 'wall-hit')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(swallow);
      else if (kind === 'launch')
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow);

      // Sound
      if (kind === 'hit') playSound('hit');
      else if (kind === 'close') playSound('close');
      else if (kind === 'miss') playSound('miss');
      else if (kind === 'wall-hit') playSound('wallHit');
      else if (kind === 'level-complete') playSound('levelComplete');
      else if (kind === 'launch') playSound('launch');
    },
    [playSound],
  );

  const advanceToNextGoal = useCallback(() => {
    setCurrentGoalIndex((idx) => {
      const next = idx + 1;
      if (next >= GOALS.length) {
        setOutcome('level-complete');
        triggerFeedback('level-complete');
        return idx; // clamp
      }
      setOutcome('idle');
      setLandingDistanceM(null);
      setAngleDeg(DEFAULT_ANGLE);
      setVelocity(DEFAULT_VELOCITY);
      return next;
    });
  }, [triggerFeedback]);

  const onLanded = useCallback(
    (finalXMeters: number) => {
      const distance = finalXMeters - CANNON_WORLD_X;
      setLandingDistanceM(distance);
      const offset = Math.abs(distance - currentGoal.distanceM);
      const hitWindow = currentGoal.widthM / 2;
      let result: Outcome;
      if (offset <= hitWindow) result = 'hit';
      else if (offset <= hitWindow + CLOSE_BUFFER_M) result = 'close';
      else result = 'miss';

      setOutcome(result);
      triggerFeedback(result);

      if (result === 'hit') {
        setCompletedCount((c) => c + 1);
        // Brief celebration, then advance
        advanceTimer.current = setTimeout(advanceToNextGoal, 1500);
      }
    },
    [currentGoal.distanceM, currentGoal.widthM, triggerFeedback, advanceToNextGoal],
  );

  const onWallHit = useCallback(() => {
    setLandingDistanceM(null);
    setOutcome('wall-hit');
    triggerFeedback('wall-hit');
  }, [triggerFeedback]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  useFrameCallback((info) => {
    'worklet';
    if (!isFlying.value) return;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.667) / 1000, 0.05);

    // Snapshot previous frame position for continuous collision tests below.
    const prevX = posX.value;
    const prevY = posY.value;

    velY.value -= GRAVITY * dt;
    posX.value += velX.value * dt;
    posY.value += velY.value * dt;

    // Continuous wall collision: if the projectile crossed the wall's x this
    // frame, interpolate its y at the exact crossing point. Avoids tunneling
    // through a 1m-thick wall at high velocity.
    if (hasWall.value && prevX < wallX.value && posX.value >= wallX.value) {
      const t = (wallX.value - prevX) / (posX.value - prevX);
      const yAtWall = prevY + t * (posY.value - prevY);
      if (yAtWall < wallHeight.value) {
        // Clamp projectile to the wall face for a clean visual stop.
        posX.value = wallX.value;
        posY.value = yAtWall;
        const px = posX.value * pxPerM;
        const py = groundPxY - posY.value * pxPerM;
        const next = trail.value.slice();
        next.push(px, py);
        if (next.length > 240) next.splice(0, next.length - 240);
        trail.value = next;
        isFlying.value = false;
        runOnJS(onWallHit)();
        return;
      }
    }

    const px = posX.value * pxPerM;
    const py = groundPxY - posY.value * pxPerM;
    const next = trail.value.slice();
    next.push(px, py);
    if (next.length > 240) next.splice(0, next.length - 240);
    trail.value = next;

    if (posY.value <= 0 && velY.value < 0) {
      posY.value = 0;
      isFlying.value = false;
      runOnJS(onLanded)(posX.value);
    }
  });

  const launch = () => {
    if (outcome === 'level-complete') return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const rad = (angleDeg * Math.PI) / 180;
    posX.value = CANNON_WORLD_X;
    posY.value = 0;
    velX.value = velocity * Math.cos(rad);
    velY.value = velocity * Math.sin(rad);
    trail.value = [];
    setOutcome('flying');
    setLandingDistanceM(null);
    isFlying.value = true;
    triggerFeedback('launch');
    launchPulse.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 840 }),
    );
  };

  const reset = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    isFlying.value = false;
    posX.value = CANNON_WORLD_X;
    posY.value = 0;
    velX.value = 0;
    velY.value = 0;
    trail.value = [];
    setOutcome('idle');
    setLandingDistanceM(null);
    setAngleDeg(DEFAULT_ANGLE);
    setVelocity(DEFAULT_VELOCITY);
  };

  const resetLevel = () => {
    reset();
    setCurrentGoalIndex(0);
    setCompletedCount(0);
    // Bumping sessionVersion re-rolls the wall even though currentGoalIndex
    // stays at 0 (which it already was at when going to a goal-0 wall before).
    setSessionVersion((v) => v + 1);
  };

  const predictedRangeM = useMemo(() => {
    const rad = (angleDeg * Math.PI) / 180;
    return (velocity * velocity * Math.sin(2 * rad)) / GRAVITY;
  }, [angleDeg, velocity]);

  const isControlsDisabled = outcome === 'flying' || outcome === 'level-complete';
  const isLevelComplete = outcome === 'level-complete';

  // Launch-flash animation — pulses the equation panel's border + background
  // when LAUNCH fires so the math visibly "snaps into focus" for the shot.
  const launchPulse = useSharedValue(0);
  const animatedPanelStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      launchPulse.value,
      [0, 1],
      [colors.border, colors.primary],
    ),
    backgroundColor: interpolateColor(
      launchPulse.value,
      [0, 1],
      [colors.surface, colors.surfaceAlt],
    ),
  }));

  const outcomeColor =
    outcome === 'hit'
      ? colors.success
      : outcome === 'close'
        ? colors.warning
        : outcome === 'miss' || outcome === 'wall-hit'
          ? colors.failure
          : colors.textSecondary;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.canvasWrap}>
        <Canvas style={{ width: screenWidth, height: canvasHeight }}>
          {/* Augmentation-theme Earth strip */}
          <Rect
            x={0}
            y={groundPxY}
            width={screenWidth}
            height={canvasHeight - groundPxY}
            color="#1a2a1f"
          />
          <Line
            p1={{ x: 0, y: groundPxY }}
            p2={{ x: screenWidth, y: groundPxY }}
            color={colors.border}
            strokeWidth={1}
          />
          {/* 10m gridlines */}
          {Array.from({ length: 12 }).map((_, i) => {
            const xPx = (CANNON_WORLD_X + (i + 1) * 10) * pxPerM;
            if (xPx > screenWidth) return null;
            return (
              <Line
                key={i}
                p1={{ x: xPx, y: groundPxY }}
                p2={{ x: xPx, y: groundPxY + 4 }}
                color={colors.textDim}
                strokeWidth={1}
              />
            );
          })}

          {/* Target */}
          <Rect
            x={targetPxX - targetPxWidth / 2}
            y={groundPxY - 6}
            width={targetPxWidth}
            height={10}
            color={colors.success}
          />

          {/* Wall obstacle (goals 4+, randomized per goal) */}
          {currentWall && (
            <>
              <Rect
                x={(CANNON_WORLD_X + currentWall.distanceM - WALL_WIDTH_M / 2) * pxPerM}
                y={groundPxY - currentWall.heightM * pxPerM}
                width={WALL_WIDTH_M * pxPerM}
                height={currentWall.heightM * pxPerM}
                color="#3a4250"
              />
              <Line
                p1={{
                  x: (CANNON_WORLD_X + currentWall.distanceM - WALL_WIDTH_M / 2) * pxPerM,
                  y: groundPxY - currentWall.heightM * pxPerM,
                }}
                p2={{
                  x: (CANNON_WORLD_X + currentWall.distanceM + WALL_WIDTH_M / 2) * pxPerM,
                  y: groundPxY - currentWall.heightM * pxPerM,
                }}
                color={colors.warning}
                strokeWidth={2}
              />
            </>
          )}

          {/* Cannon */}
          <Circle cx={cannonPxX} cy={groundPxY} r={10} color={colors.primaryDeep} />
          <Circle cx={cannonPxX} cy={groundPxY} r={5} color={colors.primary} />

          {/* Trajectory + projectile */}
          <Path path={trailPath} color={colors.primaryLight} style="stroke" strokeWidth={1.5} />
          <Circle cx={projPxX} cy={projPxY} r={5} color={colors.primaryLight} />
        </Canvas>

        {/* Distance markers overlay */}
        <View style={[styles.markerLabel, { left: cannonPxX - 12, top: groundPxY + 8 }]}>
          <Text style={styles.markerText}>0 m</Text>
        </View>
        <View style={[styles.markerLabel, { left: targetPxX - 18, top: groundPxY + 8 }]}>
          <Text style={[styles.markerText, { color: colors.success }]}>
            {currentGoal.distanceM} m
          </Text>
        </View>
      </View>

      <View style={styles.hud}>
        <View style={styles.goalHeader}>
          <View style={styles.counterBox}>
            <Text style={styles.counterLabel}>GOAL</Text>
            <Text style={styles.counterValue}>
              {Math.min(currentGoalIndex + 1, GOALS.length)}
              <Text style={styles.counterTotal}>/{GOALS.length}</Text>
            </Text>
          </View>
          <View style={styles.goalText}>
            <Text style={styles.goalTitle}>
              HIT {currentGoal.widthM.toFixed(1)} m TARGET @ {currentGoal.distanceM} m
            </Text>
            <Text style={styles.goalHint} numberOfLines={2}>
              {currentGoal.hint}
            </Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.controlCol}>
            <Slider
              label="ANGLE"
              value={angleDeg}
              min={ANGLE_MIN}
              max={ANGLE_MAX}
              unit="°"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setAngleDeg(round1(clamp(v, ANGLE_MIN, ANGLE_MAX)))}
            />
            <FineStepper
              onAdjust={(d) =>
                setAngleDeg((prev) => round1(clamp(prev + d, ANGLE_MIN, ANGLE_MAX)))
              }
              disabled={isControlsDisabled}
            />
          </View>
          <View style={styles.controlCol}>
            <Slider
              label="VELOCITY"
              value={velocity}
              min={VELOCITY_MIN}
              max={VELOCITY_MAX}
              unit="m/s"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setVelocity(round1(clamp(v, VELOCITY_MIN, VELOCITY_MAX)))}
            />
            <FineStepper
              onAdjust={(d) =>
                setVelocity((prev) => round1(clamp(prev + d, VELOCITY_MIN, VELOCITY_MAX)))
              }
              disabled={isControlsDisabled}
            />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <ActionButton
            label="LAUNCH"
            onPress={launch}
            kind="primary"
            disabled={isControlsDisabled}
          />
          <ActionButton label="RESET" onPress={reset} kind="ghost" />
          <ActionButton
            label={showInstructions ? 'CLOSE' : 'INFO'}
            onPress={() => setShowInstructions((s) => !s)}
            kind="ghost"
          />
        </View>

        <Animated.View style={[styles.equationPanel, animatedPanelStyle]}>
          <Text style={styles.equationEyebrow}>RANGE EQUATION // VACUUM</Text>
          <Text style={styles.equationSymbolic}>R = v² · sin(2θ) / g</Text>

          <View style={styles.eqValuesBlock}>
            <EqRow symbol="v" value={velocity.toFixed(1)} unit="m/s" />
            <EqRow symbol="θ" value={angleDeg.toFixed(1)} unit="°" />
            <EqRow symbol="g" value="9.81" unit="m/s²" muted />
            <View style={styles.eqDivider} />
            <EqRow symbol="R" value={predictedRangeM.toFixed(1)} unit="m" emphasis />
          </View>

          <Text style={styles.equationActualRow}>
            <Text style={styles.equationActualLabel}>LAST LANDING: </Text>
            <Text style={[styles.equationActualValue, { color: outcomeColor }]}>
              {outcome === 'wall-hit'
                ? 'BLOCKED'
                : landingDistanceM === null
                  ? '—'
                  : `${landingDistanceM.toFixed(1)} m`}
            </Text>
            {outcome === 'hit' && (
              <Text style={[styles.equationActualValue, { color: colors.success }]}>
                {' // GOAL '}
                {currentGoalIndex + 1}
                {' CLEARED'}
              </Text>
            )}
            {outcome === 'close' && landingDistanceM !== null && (
              <Text style={[styles.equationActualValue, { color: colors.warning }]}>
                {' // CLOSE — off by '}
                {Math.abs(landingDistanceM - currentGoal.distanceM).toFixed(1)}
                {' m'}
              </Text>
            )}
            {outcome === 'miss' && landingDistanceM !== null && (
              <Text style={[styles.equationActualValue, { color: colors.failure }]}>
                {' // MISS — off by '}
                {Math.abs(landingDistanceM - currentGoal.distanceM).toFixed(1)}
                {' m'}
              </Text>
            )}
            {outcome === 'wall-hit' && (
              <Text style={[styles.equationActualValue, { color: colors.failure }]}>
                {' // arc not steep enough'}
              </Text>
            )}
          </Text>
        </Animated.View>

        <View style={styles.goalStrip}>
          {GOALS.map((_, i) => (
            <GoalTile
              key={i}
              n={i + 1}
              state={
                i < currentGoalIndex || (i === currentGoalIndex && isLevelComplete)
                  ? 'done'
                  : i === currentGoalIndex
                    ? 'current'
                    : 'future'
              }
            />
          ))}
        </View>
      </View>

      {showInstructions && (
        <InstructionsOverlay onClose={() => setShowInstructions(false)} />
      )}

      {isLevelComplete && (
        <LevelCompleteOverlay
          completedCount={completedCount}
          onReset={resetLevel}
          onBack={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

// ---------- Subcomponents ----------

function EqRow({
  symbol,
  value,
  unit,
  emphasis,
  muted,
}: {
  symbol: string;
  value: string;
  unit: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.eqRow}>
      <Text style={[styles.eqSymbol, emphasis && styles.eqSymbolEmphasis, muted && styles.eqMuted]}>
        {symbol}
      </Text>
      <Text style={[styles.eqEquals, muted && styles.eqMuted]}>=</Text>
      <Text
        style={[styles.eqValueText, emphasis && styles.eqValueTextEmphasis, muted && styles.eqMuted]}
      >
        {value}
      </Text>
      <Text style={[styles.eqUnit, muted && styles.eqMuted]}>{unit}</Text>
    </View>
  );
}

function FineStepper({
  onAdjust,
  disabled,
  coarse = 1,
  fine = 0.1,
}: {
  onAdjust: (delta: number) => void;
  disabled?: boolean;
  coarse?: number;
  fine?: number;
}) {
  return (
    <View style={styles.fineRow}>
      <FineBtn label={`−${coarse}`} onPress={() => onAdjust(-coarse)} disabled={disabled} />
      <FineBtn label={`−${fine}`} onPress={() => onAdjust(-fine)} disabled={disabled} />
      <FineBtn label={`+${fine}`} onPress={() => onAdjust(fine)} disabled={disabled} />
      <FineBtn label={`+${coarse}`} onPress={() => onAdjust(coarse)} disabled={disabled} />
    </View>
  );
}

function FineBtn({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.fineBtn,
        pressed && styles.fineBtnPressed,
        disabled && styles.fineBtnDisabled,
      ]}
    >
      <Text style={[styles.fineBtnText, disabled && styles.fineBtnTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function GoalTile({ n, state }: { n: number; state: 'done' | 'current' | 'future' }) {
  const tileStyle = [
    styles.tile,
    state === 'done' ? styles.tileDone : state === 'current' ? styles.tileCurrent : styles.tileFuture,
  ];
  const textColor =
    state === 'done' ? colors.success : state === 'current' ? colors.primary : colors.textDim;
  return (
    <View style={tileStyle}>
      <Text style={[styles.tileText, { color: textColor }]}>
        {state === 'done' ? '✓' : n.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

function Readout({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.readout}>
      <Text style={styles.readoutLabel}>{label}</Text>
      <Text style={[styles.readoutValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  kind,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        kind === 'primary' ? styles.actionPrimary : styles.actionGhost,
        pressed && (kind === 'primary' ? styles.actionPrimaryPressed : styles.actionGhostPressed),
        disabled && styles.actionDisabled,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          kind === 'primary' ? styles.actionTextPrimary : styles.actionTextGhost,
          disabled && styles.actionTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InstructionsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={styles.overlayCard} onStartShouldSetResponder={() => true}>
        <Text style={styles.overlayEyebrow}>KINEMATICS // PROJECTILE</Text>
        <Text style={styles.overlayTitle}>Range Equation</Text>
        <Text style={styles.formula}>R = v² · sin(2θ) / g</Text>
        <Text style={styles.overlayBody}>
          On Earth (g = 9.81 m/s²), the horizontal distance a projectile travels
          before landing depends only on launch velocity and angle — air
          resistance ignored.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>θ = 45°</Text> gives the maximum range for any given velocity (sin(2·45°) = sin(90°) = 1).
        </Text>
        <Text style={styles.overlayBullet}>
          • Two angles (θ and 90°−θ) hit the same distance — one low arc, one
          high arc. Try it.
        </Text>
        <Text style={styles.overlayBullet}>
          • Doubling velocity <Text style={styles.overlayBold}>quadruples</Text> the range (R ∝ v²).
        </Text>
        <Pressable onPress={onClose} style={styles.overlayClose}>
          <Text style={styles.overlayCloseText}>CLOSE</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function LevelCompleteOverlay({
  completedCount,
  onReset,
  onBack,
}: {
  completedCount: number;
  onReset: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.overlayCard}>
        <Text style={[styles.overlayEyebrow, { color: colors.success }]}>EXPERIMENT COMPLETE</Text>
        <Text style={styles.overlayTitle}>Level 01 Cleared</Text>
        <Text style={styles.overlayBigStat}>
          {completedCount}
          <Text style={styles.overlayBigStatTotal}>/{GOALS.length}</Text>
        </Text>
        <Text style={styles.overlayBody}>
          You've internalized projectile motion. Next experiment will introduce
          two-body interaction.
        </Text>
        <View style={{ gap: spacing.two, marginTop: spacing.three }}>
          <Pressable onPress={onBack} style={[styles.overlayClose, styles.overlayCtaPrimary]}>
            <Text style={[styles.overlayCloseText, { color: colors.bg }]}>BACK TO LEVELS</Text>
          </Pressable>
          <Pressable onPress={onReset} style={styles.overlayClose}>
            <Text style={styles.overlayCloseText}>REPLAY</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  canvasWrap: { backgroundColor: colors.bg },
  markerLabel: { position: 'absolute' },
  markerText: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },

  hud: {
    flex: 1,
    padding: spacing.three,
    gap: spacing.three,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  goalHeader: {
    flexDirection: 'row',
    gap: spacing.three,
    alignItems: 'stretch',
  },
  counterBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryDeep,
  },
  counterLabel: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: letterSpacing.hud,
  },
  counterValue: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    letterSpacing: letterSpacing.label,
  },
  counterTotal: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  goalText: { flex: 1, justifyContent: 'center', gap: spacing.one },
  goalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
  goalHint: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },

  controlsRow: { flexDirection: 'row', gap: spacing.three },
  controlCol: { flex: 1, gap: spacing.two },

  fineRow: { flexDirection: 'row', gap: spacing.one },
  fineBtn: {
    flex: 1,
    paddingVertical: spacing.two,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  fineBtnPressed: { backgroundColor: colors.primaryDeep, borderColor: colors.primary },
  fineBtnDisabled: { opacity: 0.35 },
  fineBtnText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    fontVariant: ['tabular-nums'],
  },
  fineBtnTextDisabled: { opacity: 0.7 },

  readoutsRow: { flexDirection: 'row', gap: spacing.three },
  readout: {
    flex: 1,
    gap: spacing.one,
    paddingVertical: spacing.two,
    paddingHorizontal: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readoutLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: letterSpacing.hud,
  },
  readoutValue: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 15,
    letterSpacing: letterSpacing.label,
    fontVariant: ['tabular-nums'],
  },

  actionsRow: { flexDirection: 'row', gap: spacing.two },
  action: {
    flex: 1,
    paddingVertical: spacing.three,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionPrimaryPressed: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  actionGhost: { backgroundColor: 'transparent', borderColor: colors.border },
  actionGhostPressed: { backgroundColor: colors.surface, borderColor: colors.primary },
  actionDisabled: { opacity: 0.4 },
  actionText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
  actionTextPrimary: { color: colors.bg },
  actionTextGhost: { color: colors.textPrimary },
  actionTextDisabled: { opacity: 0.7 },

  equationPanel: {
    paddingVertical: spacing.three,
    paddingHorizontal: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.one,
  },
  equationEyebrow: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: letterSpacing.hud,
  },
  equationSymbolic: {
    color: colors.primaryLight,
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: letterSpacing.label,
    fontWeight: '600',
  },
  equationSubst: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.label,
    lineHeight: 18,
  },
  eqValuesBlock: {
    gap: spacing.one,
    paddingLeft: spacing.three,
    paddingTop: spacing.one,
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.two,
  },
  eqSymbol: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    width: 18,
  },
  eqSymbolEmphasis: {
    color: colors.primaryLight,
    fontSize: 16,
  },
  eqEquals: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 13,
  },
  eqValueText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 56,
  },
  eqValueTextEmphasis: {
    color: colors.primaryLight,
    fontSize: 18,
    fontWeight: '700',
  },
  eqUnit: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
  },
  eqMuted: {
    opacity: 0.55,
  },
  eqDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.one,
  },
  equationActualRow: {
    marginTop: spacing.one,
    paddingTop: spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },
  equationActualLabel: {
    color: colors.textSecondary,
  },
  equationActualValue: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },

  goalStrip: {
    flexDirection: 'row',
    gap: spacing.one,
    marginTop: 'auto',
    paddingTop: spacing.two,
  },
  tile: {
    flex: 1,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDone: { borderColor: colors.success, backgroundColor: 'transparent' },
  tileCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tileFuture: { borderColor: colors.border, backgroundColor: 'transparent' },
  tileText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(13, 17, 23, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.four,
  },
  overlayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryDeep,
    padding: spacing.four,
    gap: spacing.two,
    width: '100%',
    maxWidth: 380,
  },
  overlayEyebrow: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },
  overlayTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 18,
    letterSpacing: letterSpacing.label,
    fontWeight: '600',
  },
  formula: {
    color: colors.primaryLight,
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: letterSpacing.label,
    textAlign: 'center',
    paddingVertical: spacing.three,
  },
  overlayBody: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  overlayBullet: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  overlayBold: { color: colors.textPrimary, fontWeight: '600' },
  overlayBigStat: {
    color: colors.success,
    fontFamily: fonts.mono,
    fontSize: 56,
    letterSpacing: letterSpacing.label,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.two,
  },
  overlayBigStatTotal: { color: colors.textSecondary, fontSize: 28 },
  overlayClose: {
    paddingVertical: spacing.three,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: spacing.three,
  },
  overlayCtaPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    marginTop: 0,
  },
  overlayCloseText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
});
