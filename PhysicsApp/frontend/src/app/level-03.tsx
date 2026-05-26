/**
 * Level 03 — Inclined Plane (friction + Newton's 2nd law).
 *
 * Block slides from height h down a ramp at angle θ, onto a flat surface,
 * decelerates from friction, and comes to rest at some horizontal distance
 * d_flat from the ramp bottom. Player adjusts h and θ; surface μ varies per
 * goal. Goal is to land the block's resting position inside a green target
 * zone on the flat.
 *
 * Physics:
 *   Ramp slide accel:  a_ramp = g·(sin θ − μ·cos θ)              [requires tan θ > μ]
 *   Velocity at bottom: v_b² = 2·a_ramp·L = 2gh·(1 − μ·cot θ)     [along ramp]
 *   Idealized "corner" at ramp→flat:  horizontal v survives,
 *                                     vertical v lost on impact
 *   Flat horizontal v: v_h = v_b·cos θ
 *   Flat decel:        a_flat = μg
 *   Stop distance:     d_flat = v_h² / (2μg)
 *                            = h·cos²θ·(sin θ − μ·cos θ) / (μ·sin θ)
 *
 * Notable: mass cancels out of d_flat — surprising consequence of
 * Newton's 2nd law combined with Coulomb friction. The instructional
 * overlay calls this out explicitly.
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

// ---------- Physics ----------
const GRAVITY = 9.81;
const STOP_THRESHOLD = 0.05;

// ---------- Viewport ----------
const WORLD_WIDTH_M = 65; // ramp (~max 17m at low θ) + flat (up to ~40m)
const RAMP_TOP_WORLD_X = 2; // canvas left margin in world meters

// ---------- Controls ----------
const H_MIN = 0.5;
const H_MAX = 10;
const THETA_MIN = 25;
const THETA_MAX = 80;
const DEFAULT_H = 3;
const DEFAULT_THETA = 45;

// ---------- Goals ----------
type Goal = {
  surface: string;
  mu: number;
  zoneCenterM: number;
  zoneWidthM: number;
  hint: string;
};

// Goal data fetched via useGoals('inclined-plane') from the backend;
// bundled fallback in src/data/starter-pack.ts. DEFAULT_GOAL is a safety
// stub for the (unlikely) case where goals is empty during first render.
const DEFAULT_GOAL: Goal = { surface: 'WOOD', mu: 0.2, zoneCenterM: 10, zoneWidthM: 4, hint: '' };

const CLOSE_BUFFER_M = 2;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Outcome = 'idle' | 'sliding' | 'hit' | 'close' | 'miss' | 'no-slide' | 'level-complete';

export default function Level03InclinedPlane() {
  useKeepAwake();
  const playSound = useSounds();

  const { width: screenWidth } = useWindowDimensions();
  const canvasHeight = 280;
  const baselineY = canvasHeight - 30;
  const pxPerM = screenWidth / WORLD_WIDTH_M;
  const rampTopXpx = RAMP_TOP_WORLD_X * pxPerM;

  const [h, setH] = useState(DEFAULT_H);
  const [theta, setTheta] = useState(DEFAULT_THETA);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [finalPosM, setFinalPosM] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const instructionsEnabled = useSettings((s) => s.showInstructions);
  const sessionDismissed = useSettings((s) => !!s.dismissedThisSession['level-03']);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const showStartOverlay = instructionsEnabled && !sessionDismissed && !overlayDismissed;
  const [sessionVersion, setSessionVersion] = useState(0);

  const { goals: fetchedGoals } = useGoals<Omit<Goal, 'hint'>>('inclined-plane');
  const goals = useMemo<Goal[]>(
    () => fetchedGoals.map((g) => ({ ...g.config, hint: g.hint ?? '' })),
    [fetchedGoals],
  );
  const currentGoal = goals[Math.min(currentGoalIndex, Math.max(0, goals.length - 1))] ?? DEFAULT_GOAL;

  // Snapshots captured at launch (so worklet sees stable values).
  const hSnap = useSharedValue(DEFAULT_H);
  const thetaSnap = useSharedValue(DEFAULT_THETA);
  const muSnap = useSharedValue(currentGoal.mu);
  const Lramp = useSharedValue(DEFAULT_H / Math.sin((DEFAULT_THETA * Math.PI) / 180));

  // Phase + per-phase shared values
  // phase encoding: 0 = idle, 1 = on-ramp, 2 = on-flat, 3 = stopped, 4 = no-slide
  const phase = useSharedValue(0);
  const sAlongRamp = useSharedValue(0);
  const vRamp = useSharedValue(0);
  const xFlat = useSharedValue(0);
  const vFlat = useSharedValue(0);

  // Reset when goal advances (or replay)
  useEffect(() => {
    phase.value = 0;
    sAlongRamp.value = 0;
    vRamp.value = 0;
    xFlat.value = 0;
    vFlat.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGoalIndex, sessionVersion]);

  // Predicted final position (live; recomputes as h, θ, or goal change)
  const predicted = useMemo(() => {
    const mu = currentGoal.mu;
    const thetaRad = (theta * Math.PI) / 180;
    const sinT = Math.sin(thetaRad);
    const cosT = Math.cos(thetaRad);
    const willSlide = sinT > mu * cosT;
    if (!willSlide) {
      return { willSlide, v_bottom: 0, v_horizontal: 0, d_flat: 0 };
    }
    const v_bottom_sq = 2 * GRAVITY * h * (1 - (mu * cosT) / sinT);
    const v_bottom = Math.sqrt(Math.max(0, v_bottom_sq));
    const v_horizontal = v_bottom * cosT;
    const d_flat = (v_horizontal * v_horizontal) / (2 * mu * GRAVITY);
    return { willSlide, v_bottom, v_horizontal, d_flat };
  }, [h, theta, currentGoal]);

  // Launch-flash animation on the equation panel
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
      setFinalPosM(null);
      return next;
    });
  }, [triggerFeedback]);

  const onSettled = useCallback(
    (finalX: number) => {
      setFinalPosM(finalX);
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
    if (p === 0 || p === 3 || p === 4) return;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.667) / 1000, 0.05);

    if (p === 1) {
      // On ramp
      const thetaRad = (thetaSnap.value * Math.PI) / 180;
      const sinT = Math.sin(thetaRad);
      const cosT = Math.cos(thetaRad);
      const a = GRAVITY * (sinT - muSnap.value * cosT);
      vRamp.value += a * dt;
      sAlongRamp.value += vRamp.value * dt;
      if (sAlongRamp.value >= Lramp.value) {
        // Transition to flat — keep horizontal component only
        sAlongRamp.value = Lramp.value;
        const v_h = vRamp.value * cosT;
        vFlat.value = v_h;
        xFlat.value = 0;
        phase.value = 2;
      }
    } else if (p === 2) {
      // On flat
      const decel = muSnap.value * GRAVITY;
      vFlat.value = Math.max(0, vFlat.value - decel * dt);
      xFlat.value += vFlat.value * dt;
      if (vFlat.value < STOP_THRESHOLD) {
        vFlat.value = 0;
        phase.value = 3;
        runOnJS(onSettled)(xFlat.value);
      }
    }
  });

  // Pixel-space helpers
  const thetaRadCurrent = (theta * Math.PI) / 180;
  const sinTCur = Math.sin(thetaRadCurrent);
  const cosTCur = Math.cos(thetaRadCurrent);
  const rampHeightPx = h * pxPerM;
  const rampHorizontalPx = (h / Math.tan(thetaRadCurrent)) * pxPerM;
  const rampTopY = baselineY - rampHeightPx;
  const rampBottomXpx = rampTopXpx + rampHorizontalPx;
  const flatStartXpx = rampBottomXpx;

  // Block visual position derived from phase + shared values
  const BLOCK_HALF = 7;
  const blockX = useDerivedValue(() => {
    const p = phase.value;
    if (p === 1) {
      // On ramp
      const t = Lramp.value > 0 ? sAlongRamp.value / Lramp.value : 0;
      const thetaRad = (thetaSnap.value * Math.PI) / 180;
      const rampHpx_snap = hSnap.value * pxPerM;
      const rampWpx_snap = (hSnap.value / Math.tan(thetaRad)) * pxPerM;
      return rampTopXpx + t * rampWpx_snap;
    }
    if (p === 2 || p === 3) {
      // On flat (use snapshot for ramp_bottom_x since visual could change otherwise)
      const thetaRad = (thetaSnap.value * Math.PI) / 180;
      const rampWpx_snap = (hSnap.value / Math.tan(thetaRad)) * pxPerM;
      return rampTopXpx + rampWpx_snap + xFlat.value * pxPerM;
    }
    // idle / no-slide: at top of ramp using current h, theta
    return rampTopXpx;
  }, [h, theta, pxPerM]);

  const blockY = useDerivedValue(() => {
    const p = phase.value;
    if (p === 1) {
      const t = Lramp.value > 0 ? sAlongRamp.value / Lramp.value : 0;
      const rampHpx_snap = hSnap.value * pxPerM;
      const topYsnap = baselineY - rampHpx_snap;
      return topYsnap + t * rampHpx_snap - BLOCK_HALF;
    }
    if (p === 2 || p === 3) {
      return baselineY - BLOCK_HALF;
    }
    // idle / no-slide: at top of ramp
    return rampTopY - BLOCK_HALF;
  }, [h, theta, rampTopY, pxPerM]);

  // Ramp visual path (a triangular wedge)
  const rampPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(rampTopXpx, rampTopY);
    path.lineTo(rampTopXpx, baselineY);
    path.lineTo(rampBottomXpx, baselineY);
    path.close();
    return path;
  }, [rampTopXpx, rampTopY, rampBottomXpx, baselineY]);

  const launch = () => {
    if (outcome === 'level-complete') return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);

    const thetaRad = (theta * Math.PI) / 180;
    const sinT = Math.sin(thetaRad);
    const cosT = Math.cos(thetaRad);
    const mu = currentGoal.mu;

    // Static friction check — block won't slide if tan θ ≤ μ
    if (sinT <= mu * cosT) {
      setOutcome('no-slide');
      setFinalPosM(0);
      triggerFeedback('miss');
      return;
    }

    hSnap.value = h;
    thetaSnap.value = theta;
    muSnap.value = mu;
    Lramp.value = h / sinT;
    sAlongRamp.value = 0;
    vRamp.value = 0;
    xFlat.value = 0;
    vFlat.value = 0;
    phase.value = 1;

    setOutcome('sliding');
    setFinalPosM(null);
    triggerFeedback('launch');
    launchPulse.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 840 }),
    );
  };

  const reset = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    phase.value = 0;
    sAlongRamp.value = 0;
    vRamp.value = 0;
    xFlat.value = 0;
    vFlat.value = 0;
    setOutcome('idle');
    setFinalPosM(null);
  };

  const resetLevel = () => {
    reset();
    setCurrentGoalIndex(0);
    setCompletedCount(0);
    setSessionVersion((v) => v + 1);
  };

  const isControlsDisabled = outcome === 'sliding' || outcome === 'level-complete';
  const isLevelComplete = outcome === 'level-complete';

  const outcomeColor =
    outcome === 'hit'
      ? colors.success
      : outcome === 'close'
        ? colors.warning
        : outcome === 'miss' || outcome === 'no-slide'
          ? colors.failure
          : colors.textSecondary;

  // Zone visual
  const zoneStartXpx = flatStartXpx + (currentGoal.zoneCenterM - currentGoal.zoneWidthM / 2) * pxPerM;
  const zoneWidthPx = currentGoal.zoneWidthM * pxPerM;
  const criticalAngle = (Math.atan(currentGoal.mu) * 180) / Math.PI;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.canvasWrap}>
        <Canvas style={{ width: screenWidth, height: canvasHeight }}>
          {/* Sky — slightly warm dark, earthy theme */}
          <Rect x={0} y={0} width={screenWidth} height={baselineY} color="#0f0e0d" />
          {/* Ground — rich brown earth */}
          <Rect
            x={0}
            y={baselineY}
            width={screenWidth}
            height={canvasHeight - baselineY}
            color="#3a261a"
          />
          {/* Baseline (flat surface) */}
          <Line
            p1={{ x: 0, y: baselineY }}
            p2={{ x: screenWidth, y: baselineY }}
            color={colors.border}
            strokeWidth={1}
          />
          {/* 5m gridlines on the flat (measured from ramp bottom) */}
          {Array.from({ length: 10 }).map((_, i) => {
            const xPx = flatStartXpx + (i + 1) * 5 * pxPerM;
            if (xPx > screenWidth) return null;
            return (
              <Line
                key={i}
                p1={{ x: xPx, y: baselineY }}
                p2={{ x: xPx, y: baselineY + 4 }}
                color={colors.textDim}
                strokeWidth={1}
              />
            );
          })}
          {/* Ramp wedge */}
          <Path path={rampPath} color="#2a3340" />
          <Line
            p1={{ x: rampTopXpx, y: rampTopY }}
            p2={{ x: rampBottomXpx, y: baselineY }}
            color={colors.primary}
            strokeWidth={1.5}
          />
          {/* Goal zone */}
          <Rect
            x={zoneStartXpx}
            y={baselineY - 4}
            width={zoneWidthPx}
            height={8}
            color={colors.success}
          />
          {/* Block */}
          <Circle cx={blockX} cy={blockY} r={BLOCK_HALF} color={colors.primary} />
        </Canvas>

        {/* Distance label at zone center */}
        <View
          style={[
            styles.markerLabel,
            { left: zoneStartXpx + zoneWidthPx / 2 - 14, top: baselineY + 8 },
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
          title={`STOP IN ZONE @ ${currentGoal.zoneCenterM}m · SURFACE: ${currentGoal.surface} (μ=${currentGoal.mu.toFixed(2)})`}
          hint={currentGoal.hint}
        />

        <View style={styles.controlsRow}>
          <View style={styles.controlCol}>
            <Slider
              label="HEIGHT h"
              value={h}
              min={H_MIN}
              max={H_MAX}
              unit="m"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setH(round1(clamp(v, H_MIN, H_MAX)))}
            />
            <FineStepper
              onAdjust={(d) => setH((prev) => round1(clamp(prev + d, H_MIN, H_MAX)))}
              disabled={isControlsDisabled}
            />
          </View>
          <View style={styles.controlCol}>
            <Slider
              label="ANGLE θ"
              value={theta}
              min={THETA_MIN}
              max={THETA_MAX}
              unit="°"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setTheta(round1(clamp(v, THETA_MIN, THETA_MAX)))}
            />
            <FineStepper
              onAdjust={(d) =>
                setTheta((prev) => round1(clamp(prev + d, THETA_MIN, THETA_MAX)))
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
          <Text style={styles.equationEyebrow}>NEWTON'S 2ND // INCLINED PLANE</Text>
          <Text style={styles.equationSymbolic}>
            d = h · cos²θ · (sin θ − μ·cos θ) / (μ · sin θ)
          </Text>

          <View style={styles.eqValuesBlock}>
            <EqRow symbol="h" value={h.toFixed(1)} unit="m" />
            <EqRow symbol="θ" value={theta.toFixed(1)} unit="°" />
            <EqRow symbol="μ" value={currentGoal.mu.toFixed(2)} unit="" muted />
            <EqRow symbol="θc" value={criticalAngle.toFixed(1)} unit="° (critical)" muted />
            <View style={styles.eqDivider} />
            <EqRow
              symbol="d"
              value={predicted.willSlide ? predicted.d_flat.toFixed(1) : '—'}
              unit="m (predicted)"
              emphasis
            />
          </View>

          {!predicted.willSlide && (
            <Text style={[styles.equationActualValue, { color: colors.warning, marginTop: 6 }]}>
              ⚠ θ ≤ θc — static friction holds the block in place
            </Text>
          )}

          <Text style={styles.equationActualRow}>
            <Text style={styles.equationActualLabel}>BLOCK STOPPED AT: </Text>
            <Text style={[styles.equationActualValue, { color: outcomeColor }]}>
              {outcome === 'no-slide'
                ? 'DID NOT SLIDE'
                : finalPosM === null
                  ? '—'
                  : `${finalPosM.toFixed(1)} m`}
            </Text>
            {outcome === 'hit' && (
              <Text style={[styles.equationActualValue, { color: colors.success }]}>
                {' // GOAL '}
                {currentGoalIndex + 1}
                {' CLEARED'}
              </Text>
            )}
            {outcome === 'close' && finalPosM !== null && (
              <Text style={[styles.equationActualValue, { color: colors.warning }]}>
                {' // CLOSE — off by '}
                {Math.abs(finalPosM - currentGoal.zoneCenterM).toFixed(1)}
                {' m'}
              </Text>
            )}
            {outcome === 'miss' && finalPosM !== null && (
              <Text style={[styles.equationActualValue, { color: colors.failure }]}>
                {' // MISS — off by '}
                {Math.abs(finalPosM - currentGoal.zoneCenterM).toFixed(1)}
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
          levelName="Level 03 — Inclined Plane"
          nextHint="Next experiment: pendulum — periodic motion and SHM."
          onReset={resetLevel}
          onBack={() => router.back()}
        />
      )}

      {showStartOverlay && (
        <LevelInstructions
          levelId="level-03"
          title="Level 03 — Inclined Plane"
          explanation="A block slides down a ramp onto a flat surface. Adjust HEIGHT (h) and ANGLE (θ). Each goal uses a different surface — ICE is slippery, SANDPAPER is grippy, CARPET bites hard. Goal: stop the block inside the green zone on the flat."
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
        <Text style={styles.overlayEyebrow}>DYNAMICS // INCLINED PLANE</Text>
        <Text style={styles.overlayTitle}>Friction + Newton's 2nd</Text>
        <Text style={styles.formula}>a = g · (sin θ − μ · cos θ)</Text>
        <Text style={styles.overlayBody}>
          Block slides only if the gravity component along the ramp beats static
          friction — that is, when{' '}
          <Text style={styles.overlayBold}>tan θ &gt; μ</Text>. Below the critical
          angle θc = arctan(μ), the block stays put.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Mass cancels out.</Text> Both the
          driving gravity force and the friction force scale with m, so the
          acceleration — and the stop distance — are independent of the block's mass.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Corner energy loss.</Text> At the
          ramp→flat transition, only the horizontal component of velocity
          survives. Steeper ramps waste more energy here.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Optimal angle</Text> for maximum stop
          distance trades off "more energy from height" vs "more loss at corner."
          For μ = 0.2 it's near 30°; for ice it's near 20°.
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
    fontSize: 12,
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
    fontSize: 16,
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
