/**
 * Level 04 — Pendulum (periodic motion + SHM).
 *
 * Bob hangs from a pivot by a string of length L. Player sets L and initial
 * swing amplitude θ_max, then taps LAUNCH. The bob swings (nonlinear pendulum
 * ODE integrated honestly), auto-releases at its first bottom-crossing where
 * velocity is purely horizontal and at maximum magnitude, then projectiles
 * onto the ground. Goal is for the bob to land in a target zone.
 *
 * Physics:
 *   Equation of motion (nonlinear): θ̈ = −(g/L)·sin θ
 *   Period (small-angle):           T = 2π·√(L/g)
 *   Max swing speed:                v_max = √(2gL·(1 − cos θ_max))
 *   Fall time from h:               t_fall = √(2h/g)
 *   Landing distance from pivot:    x = v_max · t_fall
 *                                     = 2·√(L·(1 − cos θ_max)·(H − L))
 *
 * Pedagogical highlight: T = 2π·√(L/g) is the SMALL-ANGLE APPROXIMATION.
 * For large θ_max the actual period is longer; players can observe this
 * by watching swings at θ=60°+ take noticeably longer than the formula
 * predicts. The instructional overlay calls this out.
 */
import { Canvas, Circle, Line, Path, Rect, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { useGoals } from '@/hooks/useGoals';
import { useSounds } from '@/hooks/useSounds';
import { useSettings } from '@/store/useSettings';
import { ActionButton } from '@/ui/ActionButton';
import { EqRow } from '@/ui/EqRow';
import { FineStepper } from '@/ui/FineStepper';
import { GoalCounter } from '@/ui/GoalCounter';
import { GoalTileStrip } from '@/ui/GoalTileStrip';
import { LevelCompleteOverlay } from '@/ui/LevelCompleteOverlay';
import { LevelInstructions } from '@/ui/LevelInstructions';
import { Slider } from '@/ui/Slider';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

let useKeepAwake: () => void = () => {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useKeepAwake = require('expo-keep-awake').useKeepAwake;
} catch {}

const GRAVITY = 9.81;
const H_TOTAL_M = 10; // pivot height above ground (fixed)
const PIVOT_WORLD_X = 2;
const WORLD_WIDTH_M = 16; // pivot at 2m + max landing ~9m + margin
const STOP_FALL_Y = 0; // ground level

const L_MIN = 0.5;
const L_MAX = 8;
const THETA_MIN = 5;
const THETA_MAX = 85;
const DEFAULT_L = 3;
const DEFAULT_THETA = 30;

type Goal = {
  zoneCenterM: number; // measured from pivot_x
  zoneWidthM: number;
  hint: string;
};

// Goal data fetched via useGoals('pendulum') from the backend;
// bundled fallback in src/data/starter-pack.ts. DEFAULT_GOAL is a safety
// stub for the (unlikely) case where goals is empty during first render.
const DEFAULT_GOAL: Goal = { zoneCenterM: 2, zoneWidthM: 1.5, hint: '' };

const CLOSE_BUFFER_M = 1;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Outcome = 'idle' | 'swinging' | 'flying' | 'hit' | 'close' | 'miss' | 'level-complete';

export default function Level04Pendulum() {
  useKeepAwake();
  const playSound = useSounds();

  const { width: screenWidth } = useWindowDimensions();
  const canvasHeight = 320;
  const baselineY = canvasHeight - 30;
  const pxPerM = screenWidth / WORLD_WIDTH_M;
  const pivotPxX = PIVOT_WORLD_X * pxPerM;
  const pivotPxY = baselineY - H_TOTAL_M * pxPerM;

  // Deterministic star field for the night sky backdrop
  const STARS = useMemo(() => {
    const arr: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const x = (i * 173 + 37) % screenWidth;
      const y = ((i * 97 + 19) % (baselineY - 30)) + 10;
      const r = 0.6 + ((i * 31) % 100) / 200;
      arr.push({ x, y, r });
    }
    return arr;
  }, [screenWidth, baselineY]);

  const [L, setL] = useState(DEFAULT_L);
  const [thetaMax, setThetaMax] = useState(DEFAULT_THETA);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [landingX, setLandingX] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const instructionsEnabled = useSettings((s) => s.showInstructions);
  const sessionDismissed = useSettings((s) => !!s.dismissedThisSession['level-04']);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const showStartOverlay = instructionsEnabled && !sessionDismissed && !overlayDismissed;
  const [sessionVersion, setSessionVersion] = useState(0);

  const { goals: fetchedGoals } = useGoals<Omit<Goal, 'hint'>>('pendulum');
  const goals = useMemo<Goal[]>(
    () => fetchedGoals.map((g) => ({ ...g.config, hint: g.hint ?? '' })),
    [fetchedGoals],
  );
  const currentGoal = goals[Math.min(currentGoalIndex, Math.max(0, goals.length - 1))] ?? DEFAULT_GOAL;

  // Snapshots captured at launch
  const LSnap = useSharedValue(DEFAULT_L);
  const thetaMaxSnap = useSharedValue((DEFAULT_THETA * Math.PI) / 180);

  // Phase: 0 idle, 1 swinging, 2 flying, 3 landed
  const phase = useSharedValue(0);
  const bobAngle = useSharedValue((-DEFAULT_THETA * Math.PI) / 180); // radians, 0 = straight down
  const bobAngularVel = useSharedValue(0);
  const projX = useSharedValue(0); // world x (meters from pivot)
  const projY = useSharedValue(0); // world y (meters above ground)
  const projVx = useSharedValue(0);
  const projVy = useSharedValue(0);
  // Trail for swing path + projectile (flat array of x,y pixel pairs)
  const trail = useSharedValue<number[]>([]);

  // Reset when goal advances or replay
  useEffect(() => {
    phase.value = 0;
    bobAngle.value = (-thetaMax * Math.PI) / 180;
    bobAngularVel.value = 0;
    projX.value = 0;
    projY.value = 0;
    projVx.value = 0;
    projVy.value = 0;
    trail.value = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGoalIndex, sessionVersion]);

  // Update idle bob angle when amplitude changes (so visual matches slider pre-launch)
  useEffect(() => {
    if (phase.value === 0 || phase.value === 3) {
      bobAngle.value = (-thetaMax * Math.PI) / 180;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thetaMax]);

  // Predicted values (live)
  const predicted = useMemo(() => {
    const thetaMaxRad = (thetaMax * Math.PI) / 180;
    const v_max = Math.sqrt(2 * GRAVITY * L * (1 - Math.cos(thetaMaxRad)));
    const fall_h = Math.max(0.001, H_TOTAL_M - L);
    const t_fall = Math.sqrt((2 * fall_h) / GRAVITY);
    const x_land = v_max * t_fall;
    const period_small_angle = 2 * Math.PI * Math.sqrt(L / GRAVITY);
    return { v_max, t_fall, x_land, period_small_angle };
  }, [L, thetaMax]);

  // Launch-flash on equation panel
  const launchPulse = useSharedValue(0);
  const animatedPanelStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(launchPulse.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor: interpolateColor(
      launchPulse.value,
      [0, 1],
      [colors.surface, colors.surfaceAlt],
    ),
  }));

  type FeedbackKind = 'hit' | 'close' | 'miss' | 'level-complete' | 'launch';
  const triggerFeedback = useCallback(
    (kind: FeedbackKind) => {
      const swallow = () => {};
      if (kind === 'hit' || kind === 'level-complete')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow);
      else if (kind === 'close')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(swallow);
      else if (kind === 'miss')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(swallow);
      else if (kind === 'launch')
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow);

      if (kind === 'hit') playSound('hit');
      else if (kind === 'close') playSound('close');
      else if (kind === 'miss') playSound('miss');
      else if (kind === 'level-complete') playSound('levelComplete');
      else if (kind === 'launch') playSound('launch');
    },
    [playSound],
  );

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceToNextGoal = useCallback(() => {
    setCurrentGoalIndex((idx) => {
      const next = idx + 1;
      if (next >= goals.length) {
        setOutcome('level-complete');
        triggerFeedback('level-complete');
        return idx;
      }
      setOutcome('idle');
      setLandingX(null);
      return next;
    });
  }, [triggerFeedback]);

  const onLanded = useCallback(
    (finalX: number) => {
      setLandingX(finalX);
      const zoneLow = currentGoal.zoneCenterM - currentGoal.zoneWidthM / 2;
      const zoneHigh = currentGoal.zoneCenterM + currentGoal.zoneWidthM / 2;
      let result: Outcome;
      if (finalX >= zoneLow && finalX <= zoneHigh) result = 'hit';
      else if (Math.abs(finalX - currentGoal.zoneCenterM) <= currentGoal.zoneWidthM / 2 + CLOSE_BUFFER_M)
        result = 'close';
      else result = 'miss';

      setOutcome(result);
      triggerFeedback(result);
      if (result === 'hit') {
        setCompletedCount((c) => c + 1);
        advanceTimer.current = setTimeout(advanceToNextGoal, 1500);
      }
    },
    [currentGoal.zoneCenterM, currentGoal.zoneWidthM, triggerFeedback, advanceToNextGoal],
  );

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  useFrameCallback((info) => {
    'worklet';
    const p = phase.value;
    if (p === 0 || p === 3) return;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.667) / 1000, 0.025);

    if (p === 1) {
      // Pendulum swing — integrate nonlinear ODE: θ̈ = −(g/L)·sin θ
      const angularAccel = -(GRAVITY / LSnap.value) * Math.sin(bobAngle.value);
      bobAngularVel.value += angularAccel * dt;
      const prevAngle = bobAngle.value;
      bobAngle.value += bobAngularVel.value * dt;

      // Append to trail (in canvas pixels)
      const bobPxX = pivotPxX + LSnap.value * Math.sin(bobAngle.value) * pxPerM;
      const bobPxY = pivotPxY + LSnap.value * Math.cos(bobAngle.value) * pxPerM;
      const next = trail.value.slice();
      next.push(bobPxX, bobPxY);
      if (next.length > 200) next.splice(0, next.length - 200);
      trail.value = next;

      // Bottom crossing — bob's angle transitioned from negative to non-negative,
      // moving right (positive angular velocity)
      if (prevAngle < 0 && bobAngle.value >= 0 && bobAngularVel.value > 0) {
        // Release as horizontal projectile at bottom of swing
        const v_at_bottom = bobAngularVel.value * LSnap.value;
        projVx.value = v_at_bottom;
        projVy.value = 0;
        projX.value = 0; // measured from pivot, bottom of swing is x=0
        projY.value = H_TOTAL_M - LSnap.value;
        phase.value = 2;
        // Clear swing trail; projectile gets its own
        trail.value = [];
      }
    } else if (p === 2) {
      // Projectile motion
      projVy.value -= GRAVITY * dt;
      projX.value += projVx.value * dt;
      projY.value += projVy.value * dt;

      // Trail in canvas pixels
      const bobPxX = pivotPxX + projX.value * pxPerM;
      const bobPxY = baselineY - projY.value * pxPerM;
      const next = trail.value.slice();
      next.push(bobPxX, bobPxY);
      if (next.length > 200) next.splice(0, next.length - 200);
      trail.value = next;

      if (projY.value <= STOP_FALL_Y) {
        projY.value = STOP_FALL_Y;
        phase.value = 3;
        runOnJS(onLanded)(projX.value);
      }
    }
  });

  // Bob visual position
  const bobCanvasX = useDerivedValue(() => {
    const p = phase.value;
    if (p === 0 || p === 1) {
      // Hanging from pivot
      return pivotPxX + LSnap.value * Math.sin(bobAngle.value) * pxPerM;
    }
    // Projectile or landed
    return pivotPxX + projX.value * pxPerM;
  });

  const bobCanvasY = useDerivedValue(() => {
    const p = phase.value;
    if (p === 0 || p === 1) {
      return pivotPxY + LSnap.value * Math.cos(bobAngle.value) * pxPerM;
    }
    return baselineY - projY.value * pxPerM;
  });

  // String visual: from pivot to bob (only during idle/swing phases)
  const stringPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const p = phase.value;
    if (p === 0 || p === 1) {
      const bx = pivotPxX + LSnap.value * Math.sin(bobAngle.value) * pxPerM;
      const by = pivotPxY + LSnap.value * Math.cos(bobAngle.value) * pxPerM;
      path.moveTo(pivotPxX, pivotPxY);
      path.lineTo(bx, by);
    }
    return path;
  });

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

  // Update LSnap and thetaMaxSnap from React state when in idle (so visual reflects sliders)
  useEffect(() => {
    if (phase.value === 0 || phase.value === 3) {
      LSnap.value = L;
      thetaMaxSnap.value = (thetaMax * Math.PI) / 180;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, thetaMax]);

  const launch = () => {
    if (outcome === 'level-complete') return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);

    LSnap.value = L;
    thetaMaxSnap.value = (thetaMax * Math.PI) / 180;
    bobAngle.value = -(thetaMax * Math.PI) / 180;
    bobAngularVel.value = 0;
    projX.value = 0;
    projY.value = 0;
    projVx.value = 0;
    projVy.value = 0;
    trail.value = [];
    phase.value = 1;

    setOutcome('swinging');
    setLandingX(null);
    triggerFeedback('launch');
    launchPulse.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 840 }),
    );
  };

  const reset = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    phase.value = 0;
    bobAngle.value = (-DEFAULT_THETA * Math.PI) / 180;
    bobAngularVel.value = 0;
    projX.value = 0;
    projY.value = 0;
    projVx.value = 0;
    projVy.value = 0;
    trail.value = [];
    setOutcome('idle');
    setLandingX(null);
  };

  const resetLevel = () => {
    reset();
    setCurrentGoalIndex(0);
    setCompletedCount(0);
    setSessionVersion((v) => v + 1);
  };

  const isControlsDisabled =
    outcome === 'swinging' || outcome === 'flying' || outcome === 'level-complete';
  const isLevelComplete = outcome === 'level-complete';

  const outcomeColor =
    outcome === 'hit'
      ? colors.success
      : outcome === 'close'
        ? colors.warning
        : outcome === 'miss'
          ? colors.failure
          : colors.textSecondary;

  const zoneStartPx = pivotPxX + (currentGoal.zoneCenterM - currentGoal.zoneWidthM / 2) * pxPerM;
  const zoneWidthPx = currentGoal.zoneWidthM * pxPerM;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.canvasWrap}>
        <Canvas style={{ width: screenWidth, height: canvasHeight }}>
          {/* Night sky — deep indigo */}
          <Rect x={0} y={0} width={screenWidth} height={baselineY} color="#0a0e22" />
          {/* Star field */}
          {STARS.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} color="#E6EDF3" />
          ))}
          {/* Ground */}
          <Rect
            x={0}
            y={baselineY}
            width={screenWidth}
            height={canvasHeight - baselineY}
            color="#1a1429"
          />
          <Line
            p1={{ x: 0, y: baselineY }}
            p2={{ x: screenWidth, y: baselineY }}
            color={colors.border}
            strokeWidth={1}
          />
          {/* 1m gridlines on the ground (from pivot) */}
          {Array.from({ length: 12 }).map((_, i) => {
            const xPx = pivotPxX + (i + 1) * pxPerM;
            if (xPx > screenWidth) return null;
            return (
              <Line
                key={i}
                p1={{ x: xPx, y: baselineY }}
                p2={{ x: xPx, y: baselineY + 3 }}
                color={colors.textDim}
                strokeWidth={1}
              />
            );
          })}
          {/* Pivot beam (small horizontal line at top) */}
          <Line
            p1={{ x: pivotPxX - 14, y: pivotPxY }}
            p2={{ x: pivotPxX + 14, y: pivotPxY }}
            color={colors.primary}
            strokeWidth={2}
          />
          <Circle cx={pivotPxX} cy={pivotPxY} r={3} color={colors.primaryLight} />
          {/* Goal zone */}
          <Rect
            x={zoneStartPx}
            y={baselineY - 4}
            width={zoneWidthPx}
            height={8}
            color={colors.success}
          />
          {/* String + trail + bob */}
          <Path path={stringPath} color={colors.textSecondary} style="stroke" strokeWidth={1} />
          <Path path={trailPath} color={colors.primaryLight} style="stroke" strokeWidth={1.5} />
          <Circle cx={bobCanvasX} cy={bobCanvasY} r={7} color={colors.primary} />
        </Canvas>

        <View
          style={[
            styles.markerLabel,
            { left: zoneStartPx + zoneWidthPx / 2 - 14, top: baselineY + 8 },
          ]}
        >
          <Text style={[styles.markerText, { color: colors.success }]}>
            {currentGoal.zoneCenterM}m
          </Text>
        </View>
      </View>

      <View style={styles.hud}>
        <GoalCounter
          index={currentGoalIndex}
          total={goals.length}
          title={`LAND BOB IN ZONE @ ${currentGoal.zoneCenterM}m FROM PIVOT`}
          hint={currentGoal.hint}
        />

        <View style={styles.controlsRow}>
          <View style={styles.controlCol}>
            <Slider
              label="STRING L"
              value={L}
              min={L_MIN}
              max={L_MAX}
              unit="m"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setL(round1(clamp(v, L_MIN, L_MAX)))}
            />
            <FineStepper
              onAdjust={(d) => setL((prev) => round1(clamp(prev + d, L_MIN, L_MAX)))}
              disabled={isControlsDisabled}
            />
          </View>
          <View style={styles.controlCol}>
            <Slider
              label="AMPLITUDE θₘₐₓ"
              value={thetaMax}
              min={THETA_MIN}
              max={THETA_MAX}
              unit="°"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setThetaMax(round1(clamp(v, THETA_MIN, THETA_MAX)))}
            />
            <FineStepper
              onAdjust={(d) =>
                setThetaMax((prev) => round1(clamp(prev + d, THETA_MIN, THETA_MAX)))
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
          <Text style={styles.equationEyebrow}>PENDULUM // SHM</Text>
          <Text style={styles.equationSymbolic}>
            T = 2π·√(L/g) ; x = 2·√(L·(1−cos θₘₐₓ)·(H−L))
          </Text>

          <View style={styles.eqValuesBlock}>
            <EqRow symbol="L" value={L.toFixed(1)} unit="m" />
            <EqRow symbol="θₘ" value={thetaMax.toFixed(1)} unit="°" />
            <EqRow symbol="H" value={H_TOTAL_M.toFixed(1)} unit="m" muted />
            <EqRow symbol="g" value="9.81" unit="m/s²" muted />
            <View style={styles.eqDivider} />
            <EqRow symbol="T" value={predicted.period_small_angle.toFixed(2)} unit="s" />
            <EqRow symbol="v" value={predicted.v_max.toFixed(2)} unit="m/s (bottom)" />
            <EqRow symbol="x" value={predicted.x_land.toFixed(2)} unit="m (predicted)" emphasis />
          </View>

          <Text style={styles.equationActualRow}>
            <Text style={styles.equationActualLabel}>BOB LANDED: </Text>
            <Text style={[styles.equationActualValue, { color: outcomeColor }]}>
              {landingX === null ? '—' : `${landingX.toFixed(2)} m`}
            </Text>
            {outcome === 'hit' && (
              <Text style={[styles.equationActualValue, { color: colors.success }]}>
                {' // GOAL '}
                {currentGoalIndex + 1}
                {' CLEARED'}
              </Text>
            )}
            {outcome === 'close' && landingX !== null && (
              <Text style={[styles.equationActualValue, { color: colors.warning }]}>
                {' // CLOSE — off by '}
                {Math.abs(landingX - currentGoal.zoneCenterM).toFixed(2)}
                {' m'}
              </Text>
            )}
            {outcome === 'miss' && landingX !== null && (
              <Text style={[styles.equationActualValue, { color: colors.failure }]}>
                {' // MISS — off by '}
                {Math.abs(landingX - currentGoal.zoneCenterM).toFixed(2)}
                {' m'}
              </Text>
            )}
          </Text>
        </Animated.View>

        <GoalTileStrip
          total={goals.length}
          currentIndex={currentGoalIndex}
          levelComplete={isLevelComplete}
        />
      </View>

      {showInstructions && <InstructionsOverlay onClose={() => setShowInstructions(false)} />}

      {isLevelComplete && (
        <LevelCompleteOverlay
          completedCount={completedCount}
          totalGoals={goals.length}
          levelName="Level 04 — Pendulum"
          nextHint="Next experiment: springs — Hooke's law and the other classic SHM system."
          onReset={resetLevel}
          onBack={() => router.back()}
        />
      )}

      {showStartOverlay && (
        <LevelInstructions
          levelId="level-04"
          title="Level 04 — Pendulum"
          explanation="Tune the STRING LENGTH and SWING AMPLITUDE. The bob swings down and auto-releases at the bottom — becoming a horizontal projectile. Goal: bob lands in the green zone on the ground."
          onDismiss={() => setOverlayDismissed(true)}
        />
      )}
    </SafeAreaView>
  );
}

function InstructionsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={styles.overlayCard} onStartShouldSetResponder={() => true}>
        <Text style={styles.overlayEyebrow}>PERIODIC MOTION // PENDULUM</Text>
        <Text style={styles.overlayTitle}>Simple Pendulum</Text>
        <Text style={styles.formula}>T = 2π · √(L/g)</Text>
        <Text style={styles.overlayBody}>
          Period depends only on length L (and gravity). Mass doesn't matter.
          Amplitude — for small angles — doesn't matter either. Isochronism.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Small-angle approximation:</Text> The period
          equation above assumes sin θ ≈ θ. For θₘₐₓ &gt; ~20°, actual period is
          slightly longer. Watch swings at 60–80° — they take noticeably more
          time than T predicts.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Bottom-of-swing release.</Text> The bob
          auto-releases the moment it crosses the lowest point — where velocity
          is purely horizontal and at maximum.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Range trade-off:</Text> Longer L gives
          more energy per cycle but less fall height. Maximum range is at L ≈ H/2.
        </Text>
        <Pressable onPress={onClose} style={styles.overlayClose}>
          <Text style={styles.overlayCloseText}>CLOSE</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

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

  controlsRow: { flexDirection: 'row', gap: spacing.three },
  controlCol: { flex: 1, gap: spacing.two },
  actionsRow: { flexDirection: 'row', gap: spacing.two },

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
    fontSize: 11,
    letterSpacing: letterSpacing.label,
    fontWeight: '600',
  },
  eqValuesBlock: {
    gap: spacing.one,
    paddingLeft: spacing.three,
    paddingTop: spacing.one,
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
  equationActualLabel: { color: colors.textSecondary },
  equationActualValue: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
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
    fontSize: 18,
    letterSpacing: letterSpacing.label,
    textAlign: 'center',
    paddingVertical: spacing.two,
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
  overlayClose: {
    paddingVertical: spacing.three,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: spacing.three,
  },
  overlayCloseText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
});
