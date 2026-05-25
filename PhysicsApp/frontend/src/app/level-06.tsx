/**
 * Level 06 — Energy Conservation (KE ↔ PE on a friction-valley track).
 *
 * Cart starts at adjustable height h_start on a left hill. It slides down
 * (frictionless), across a flat valley with friction μ over width w, then up
 * a right hill (frictionless). The cart eventually stops at height h_final
 * on the right hill, where:
 *
 *   h_final = h_start − μ·w
 *
 * Mass cancels out completely — both the driving PE and the friction loss
 * scale with m. This level's pedagogical payoff is the player discovering
 * the mass slider has no effect on the outcome, because energy is the
 * invariant, not the body.
 *
 * Player adjusts h_start (and a "pedagogical" mass slider that doesn't
 * actually affect h_final). Goal: cart's final resting height on the right
 * hill is in the target zone.
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

import { useSounds } from '@/hooks/useSounds';
import { ActionButton } from '@/ui/ActionButton';
import { EqRow } from '@/ui/EqRow';
import { FineStepper } from '@/ui/FineStepper';
import { GoalCounter } from '@/ui/GoalCounter';
import { GoalTileStrip } from '@/ui/GoalTileStrip';
import { LevelCompleteOverlay } from '@/ui/LevelCompleteOverlay';
import { Slider } from '@/ui/Slider';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

let useKeepAwake: () => void = () => {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useKeepAwake = require('expo-keep-awake').useKeepAwake;
} catch {}

const GRAVITY = 9.81;
const HILL_TOP_M = 10; // both hills' max height
const HILL_ANGLE_DEG = 45;
const HILL_ANGLE_RAD = (HILL_ANGLE_DEG * Math.PI) / 180;
const STOP_THRESHOLD = 0.02;

const H_MIN = 0.5;
const H_MAX = 10;
const M_MIN = 0.5;
const M_MAX = 10;
const DEFAULT_H = 5;
const DEFAULT_M = 1;

type Goal = {
  frictionMu: number;
  valleyWidthM: number;
  targetHeightM: number;
  zoneHeightM: number;
  hint: string;
};

const GOALS: Goal[] = [
  {
    frictionMu: 0.2,
    valleyWidthM: 2,
    targetHeightM: 3,
    zoneHeightM: 1,
    hint: 'Warm-up — small friction loss',
  },
  {
    frictionMu: 0.3,
    valleyWidthM: 3,
    targetHeightM: 5,
    zoneHeightM: 0.8,
    hint: 'Wider valley, more loss',
  },
  {
    frictionMu: 0.5,
    valleyWidthM: 2,
    targetHeightM: 2,
    zoneHeightM: 0.6,
    hint: 'Heavy friction, short valley',
  },
  {
    frictionMu: 0.1,
    valleyWidthM: 5,
    targetHeightM: 7,
    zoneHeightM: 0.8,
    hint: 'Slippery valley, far target',
  },
  {
    frictionMu: 0.4,
    valleyWidthM: 4,
    targetHeightM: 4,
    zoneHeightM: 0.5,
    hint: 'Try the mass slider — does it matter?',
  },
  {
    frictionMu: 0.6,
    valleyWidthM: 3,
    targetHeightM: 1,
    zoneHeightM: 0.4,
    hint: 'Almost all energy lost in valley',
  },
  {
    frictionMu: 0.2,
    valleyWidthM: 8,
    targetHeightM: 6,
    zoneHeightM: 0.5,
    hint: 'Long valley — accumulated friction',
  },
  {
    frictionMu: 0.5,
    valleyWidthM: 5,
    targetHeightM: 3,
    zoneHeightM: 0.4,
    hint: 'Mass STILL doesn\'t matter — try changing it',
  },
  {
    frictionMu: 0.3,
    valleyWidthM: 10,
    targetHeightM: 4,
    zoneHeightM: 0.4,
    hint: 'Wide friction zone',
  },
  {
    frictionMu: 0.7,
    valleyWidthM: 6,
    targetHeightM: 2,
    zoneHeightM: 0.3,
    hint: 'Final — heavy friction + tight target',
  },
];

const CLOSE_BUFFER_M = 0.6;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Outcome =
  | 'idle'
  | 'phase1'
  | 'phase2'
  | 'phase3'
  | 'hit'
  | 'close'
  | 'miss'
  | 'level-complete';

export default function Level06Energy() {
  useKeepAwake();
  const playSound = useSounds();

  const { width: screenWidth } = useWindowDimensions();
  const canvasHeight = 280;
  const baselineY = canvasHeight - 30;

  const [hStart, setHStart] = useState(DEFAULT_H);
  const [cartMass, setCartMass] = useState(DEFAULT_M);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [finalHeight, setFinalHeight] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);

  const currentGoal = GOALS[Math.min(currentGoalIndex, GOALS.length - 1)];

  // Track geometry derived from current goal's valley width.
  // World layout (in meters, with y=0 at ground):
  //   left hill goes from (0, HILL_TOP) down to (HILL_RUN, 0)
  //   valley spans from (HILL_RUN, 0) to (HILL_RUN + valleyWidth, 0)
  //   right hill goes from (HILL_RUN + valleyWidth, 0) up to (HILL_RUN*2 + valleyWidth, HILL_TOP)
  const HILL_RUN = HILL_TOP_M / Math.tan(HILL_ANGLE_RAD); // 10 at 45°
  const valleyStartX = HILL_RUN;
  const valleyEndX = HILL_RUN + currentGoal.valleyWidthM;
  const rightHillEndX = valleyEndX + HILL_RUN;
  // Add 1m of breathing room on each side so the track doesn't kiss the edges.
  const WORLD_WIDTH_M = rightHillEndX + 2;
  const pxPerM = screenWidth / WORLD_WIDTH_M;
  const leftHillTopX = 1; // 1m margin on left

  // Snapshots taken at launch (so worklet has stable values)
  const hStartSnap = useSharedValue(DEFAULT_H);
  const muSnap = useSharedValue(currentGoal.frictionMu);
  const wSnap = useSharedValue(currentGoal.valleyWidthM);
  const L1Snap = useSharedValue(DEFAULT_H / Math.sin(HILL_ANGLE_RAD));

  // Phase: 0 idle, 1 left hill, 2 valley, 3 right hill, 4 stopped
  const phase = useSharedValue(0);
  const s = useSharedValue(0); // arc length from start of left hill (cart's launch point)
  const v = useSharedValue(0); // velocity along track

  // Reset when goal advances or replay
  useEffect(() => {
    phase.value = 0;
    s.value = 0;
    v.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGoalIndex, sessionVersion]);

  // Predicted h_final
  const predicted = useMemo(() => {
    const peStart = cartMass * GRAVITY * hStart;
    const eLoss = currentGoal.frictionMu * cartMass * GRAVITY * currentGoal.valleyWidthM;
    const hFinal = Math.max(0, hStart - currentGoal.frictionMu * currentGoal.valleyWidthM);
    const cartReachesRight = hStart > currentGoal.frictionMu * currentGoal.valleyWidthM;
    return { peStart, eLoss, hFinal, cartReachesRight };
  }, [hStart, cartMass, currentGoal]);

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
      if (next >= GOALS.length) {
        setOutcome('level-complete');
        triggerFeedback('level-complete');
        return idx;
      }
      setOutcome('idle');
      setFinalHeight(null);
      setHStart(DEFAULT_H);
      setCartMass(DEFAULT_M);
      return next;
    });
  }, [triggerFeedback]);

  const onSettled = useCallback(
    (hFinal: number) => {
      setFinalHeight(hFinal);
      const zoneLow = currentGoal.targetHeightM - currentGoal.zoneHeightM / 2;
      const zoneHigh = currentGoal.targetHeightM + currentGoal.zoneHeightM / 2;
      let result: Outcome;
      if (hFinal >= zoneLow && hFinal <= zoneHigh) result = 'hit';
      else if (Math.abs(hFinal - currentGoal.targetHeightM) <= currentGoal.zoneHeightM / 2 + CLOSE_BUFFER_M)
        result = 'close';
      else result = 'miss';

      setOutcome(result);
      triggerFeedback(result);
      if (result === 'hit') {
        setCompletedCount((c) => c + 1);
        advanceTimer.current = setTimeout(advanceToNextGoal, 1500);
      }
    },
    [currentGoal.targetHeightM, currentGoal.zoneHeightM, triggerFeedback, advanceToNextGoal],
  );

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  useFrameCallback((info) => {
    'worklet';
    const p = phase.value;
    if (p === 0 || p === 4) return;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.667) / 1000, 0.025);

    let a = 0;
    if (p === 1) a = GRAVITY * Math.sin(HILL_ANGLE_RAD);
    else if (p === 2) a = -muSnap.value * GRAVITY;
    else if (p === 3) a = -GRAVITY * Math.sin(HILL_ANGLE_RAD);

    v.value += a * dt;
    if (v.value <= STOP_THRESHOLD) {
      // Stopped on whatever segment
      v.value = 0;
      phase.value = 4;
      // Compute h_final from s
      const L1 = L1Snap.value;
      const L2 = wSnap.value;
      if (s.value <= L1) {
        // Stopped on left hill — shouldn't happen physically but handle
        runOnJS(onSettled)(hStartSnap.value * (1 - s.value / L1));
      } else if (s.value <= L1 + L2) {
        // Stopped in valley
        runOnJS(onSettled)(0);
      } else {
        // Stopped on right hill
        const sOnRightHill = s.value - L1 - L2;
        const hOnRight = sOnRightHill * Math.sin(HILL_ANGLE_RAD);
        runOnJS(onSettled)(hOnRight);
      }
      return;
    }
    s.value += v.value * dt;

    const L1 = L1Snap.value;
    const L2 = wSnap.value;
    if (p === 1 && s.value >= L1) {
      phase.value = 2;
    } else if (p === 2 && s.value >= L1 + L2) {
      phase.value = 3;
    }
  });

  // Derive cart's world (x, y) from s
  const cartWorldXY = useDerivedValue(() => {
    const L1 = L1Snap.value;
    const L2 = wSnap.value;
    const p = phase.value;
    if (p === 0) {
      // At launch position on left hill (top of cart's slide path)
      const h = hStartSnap.value;
      const xRun = h / Math.tan(HILL_ANGLE_RAD);
      // Cart starts at this point: (leftHillTopX, h)... wait this is for s=0 with h=hStart
      return { x: leftHillTopX, y: h };
    }
    if (p === 1) {
      const h = hStartSnap.value;
      const t = s.value / L1;
      return {
        x: leftHillTopX + t * (h / Math.tan(HILL_ANGLE_RAD)),
        y: h - t * h,
      };
    }
    if (p === 2) {
      const distInValley = s.value - L1;
      return { x: valleyStartX + distInValley, y: 0 };
    }
    // p === 3 or 4
    const distOnRight = s.value - L1 - L2;
    const xRight = distOnRight * Math.cos(HILL_ANGLE_RAD);
    const yRight = distOnRight * Math.sin(HILL_ANGLE_RAD);
    return { x: valleyEndX + xRight, y: yRight };
  });

  const cartCanvasX = useDerivedValue(() => cartWorldXY.value.x * pxPerM);
  const cartCanvasY = useDerivedValue(() => baselineY - cartWorldXY.value.y * pxPerM);

  // Idle: when phase=0, also reflect the current hStart in the visual.
  // The derivation above uses hStartSnap, which is set when launch fires.
  // So we mirror hStart -> hStartSnap when idle (before launch).
  useEffect(() => {
    if (phase.value === 0 || phase.value === 4) {
      hStartSnap.value = hStart;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hStart]);

  // Track path (drawn once for current valley)
  const trackPath = useMemo(() => {
    const path = Skia.Path.Make();
    const left_top_x_px = leftHillTopX * pxPerM;
    const left_top_y_px = baselineY - HILL_TOP_M * pxPerM;
    const left_bottom_x_px = valleyStartX * pxPerM;
    const right_bottom_x_px = valleyEndX * pxPerM;
    const right_top_x_px = rightHillEndX * pxPerM;
    const right_top_y_px = baselineY - HILL_TOP_M * pxPerM;
    path.moveTo(left_top_x_px, left_top_y_px);
    path.lineTo(left_bottom_x_px, baselineY);
    path.lineTo(right_bottom_x_px, baselineY);
    path.lineTo(right_top_x_px, right_top_y_px);
    return path;
  }, [leftHillTopX, pxPerM, valleyStartX, valleyEndX, rightHillEndX, baselineY]);

  // Friction zone shaded slightly differently
  const frictionZoneX = valleyStartX * pxPerM;
  const frictionZoneWidth = currentGoal.valleyWidthM * pxPerM;

  // Goal zone on right hill — a band at the target height
  const zoneLowH = currentGoal.targetHeightM - currentGoal.zoneHeightM / 2;
  const zoneHighH = currentGoal.targetHeightM + currentGoal.zoneHeightM / 2;
  // Convert these heights to (x, y) on the right hill surface:
  //   x = valleyEndX + h/tan(α), y = h
  const zoneLowXpx = (valleyEndX + zoneLowH / Math.tan(HILL_ANGLE_RAD)) * pxPerM;
  const zoneLowYpx = baselineY - zoneLowH * pxPerM;
  const zoneHighXpx = (valleyEndX + zoneHighH / Math.tan(HILL_ANGLE_RAD)) * pxPerM;
  const zoneHighYpx = baselineY - zoneHighH * pxPerM;

  const launch = () => {
    if (outcome === 'level-complete') return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    hStartSnap.value = hStart;
    muSnap.value = currentGoal.frictionMu;
    wSnap.value = currentGoal.valleyWidthM;
    L1Snap.value = hStart / Math.sin(HILL_ANGLE_RAD);
    s.value = 0;
    v.value = 0;
    phase.value = 1;
    setOutcome('phase1');
    setFinalHeight(null);
    triggerFeedback('launch');
    launchPulse.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 840 }),
    );
  };

  const reset = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    phase.value = 0;
    s.value = 0;
    v.value = 0;
    setOutcome('idle');
    setFinalHeight(null);
    setHStart(DEFAULT_H);
    setCartMass(DEFAULT_M);
  };

  const resetLevel = () => {
    reset();
    setCurrentGoalIndex(0);
    setCompletedCount(0);
    setSessionVersion((v) => v + 1);
  };

  const isControlsDisabled =
    outcome === 'phase1' ||
    outcome === 'phase2' ||
    outcome === 'phase3' ||
    outcome === 'level-complete';
  const isLevelComplete = outcome === 'level-complete';

  const outcomeColor =
    outcome === 'hit'
      ? colors.success
      : outcome === 'close'
        ? colors.warning
        : outcome === 'miss'
          ? colors.failure
          : colors.textSecondary;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.canvasWrap}>
        <Canvas style={{ width: screenWidth, height: canvasHeight }}>
          {/* Background */}
          <Rect x={0} y={0} width={screenWidth} height={baselineY} color="#0d1117" />
          <Rect
            x={0}
            y={baselineY}
            width={screenWidth}
            height={canvasHeight - baselineY}
            color="#1a1f2a"
          />
          {/* Friction zone — shaded band in valley */}
          <Rect
            x={frictionZoneX}
            y={baselineY - 4}
            width={frictionZoneWidth}
            height={8}
            color="#3a2820"
          />
          {/* Track */}
          <Path path={trackPath} color={colors.primary} style="stroke" strokeWidth={2} />
          {/* Goal zone (band on right hill) */}
          <Line
            p1={{ x: zoneLowXpx, y: zoneLowYpx }}
            p2={{ x: zoneHighXpx, y: zoneHighYpx }}
            color={colors.success}
            strokeWidth={6}
          />
          {/* Cart */}
          <Circle cx={cartCanvasX} cy={cartCanvasY} r={6} color={colors.primary} />
        </Canvas>

        {/* Friction zone label */}
        <View
          style={[
            styles.markerLabel,
            { left: frictionZoneX + frictionZoneWidth / 2 - 26, top: baselineY + 8 },
          ]}
        >
          <Text style={[styles.markerText, { color: colors.warning }]}>
            μ={currentGoal.frictionMu.toFixed(2)}
          </Text>
        </View>

        {/* Target height label */}
        <View
          style={[
            styles.markerLabel,
            {
              left: zoneHighXpx + 6,
              top: (zoneLowYpx + zoneHighYpx) / 2 - 6,
            },
          ]}
        >
          <Text style={[styles.markerText, { color: colors.success }]}>
            {currentGoal.targetHeightM}m
          </Text>
        </View>
      </View>

      <View style={styles.hud}>
        <GoalCounter
          index={currentGoalIndex}
          total={GOALS.length}
          title={`STOP CART @ ${currentGoal.targetHeightM}m HEIGHT // VALLEY: ${currentGoal.valleyWidthM}m, μ=${currentGoal.frictionMu.toFixed(2)}`}
          hint={currentGoal.hint}
        />

        <View style={styles.controlsRow}>
          <View style={styles.controlCol}>
            <Slider
              label="START HEIGHT h"
              value={hStart}
              min={H_MIN}
              max={H_MAX}
              unit="m"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setHStart(round1(clamp(v, H_MIN, H_MAX)))}
            />
            <FineStepper
              onAdjust={(d) => setHStart((prev) => round1(clamp(prev + d, H_MIN, H_MAX)))}
              disabled={isControlsDisabled}
            />
          </View>
          <View style={styles.controlCol}>
            <Slider
              label="CART MASS m"
              value={cartMass}
              min={M_MIN}
              max={M_MAX}
              unit="kg"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setCartMass(round1(clamp(v, M_MIN, M_MAX)))}
            />
            <FineStepper
              onAdjust={(d) =>
                setCartMass((prev) => round1(clamp(prev + d, M_MIN, M_MAX)))
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
          <Text style={styles.equationEyebrow}>CONSERVATION OF ENERGY</Text>
          <Text style={styles.equationSymbolic}>
            mgh_start − μ·m·g·w = mgh_final → h_final = h_start − μ·w
          </Text>

          <View style={styles.eqValuesBlock}>
            <EqRow symbol="h₀" value={hStart.toFixed(1)} unit="m" />
            <EqRow symbol="m" value={cartMass.toFixed(1)} unit="kg" muted />
            <EqRow symbol="μ" value={currentGoal.frictionMu.toFixed(2)} unit="" muted />
            <EqRow symbol="w" value={currentGoal.valleyWidthM.toFixed(1)} unit="m" muted />
            <View style={styles.eqDivider} />
            <EqRow
              symbol="ΔE"
              value={predicted.eLoss.toFixed(2)}
              unit="J (lost)"
            />
            <EqRow
              symbol="hf"
              value={predicted.cartReachesRight ? predicted.hFinal.toFixed(2) : '0.00'}
              unit="m (predicted)"
              emphasis
            />
          </View>

          {!predicted.cartReachesRight && (
            <Text style={[styles.equationActualValue, { color: colors.warning, marginTop: 6 }]}>
              ⚠ h₀ ≤ μ·w — all energy lost in valley, cart never climbs
            </Text>
          )}

          <Text style={styles.equationActualRow}>
            <Text style={styles.equationActualLabel}>CART STOPPED AT: </Text>
            <Text style={[styles.equationActualValue, { color: outcomeColor }]}>
              {finalHeight === null ? '—' : `${finalHeight.toFixed(2)} m`}
            </Text>
            {outcome === 'hit' && (
              <Text style={[styles.equationActualValue, { color: colors.success }]}>
                {' // GOAL '}
                {currentGoalIndex + 1}
                {' CLEARED'}
              </Text>
            )}
            {outcome === 'close' && finalHeight !== null && (
              <Text style={[styles.equationActualValue, { color: colors.warning }]}>
                {' // CLOSE — off by '}
                {Math.abs(finalHeight - currentGoal.targetHeightM).toFixed(2)}
                {' m'}
              </Text>
            )}
            {outcome === 'miss' && finalHeight !== null && (
              <Text style={[styles.equationActualValue, { color: colors.failure }]}>
                {' // MISS — off by '}
                {Math.abs(finalHeight - currentGoal.targetHeightM).toFixed(2)}
                {' m'}
              </Text>
            )}
          </Text>
        </Animated.View>

        <GoalTileStrip
          total={GOALS.length}
          currentIndex={currentGoalIndex}
          levelComplete={isLevelComplete}
        />
      </View>

      {showInstructions && <InstructionsOverlay onClose={() => setShowInstructions(false)} />}

      {isLevelComplete && (
        <LevelCompleteOverlay
          completedCount={completedCount}
          totalGoals={GOALS.length}
          levelName="Level 06 — Energy Conservation"
          nextHint="You've completed the foundational physics curriculum. More experiments to come — orbital mechanics, EM, and beyond."
          onReset={resetLevel}
          onBack={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

function InstructionsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={styles.overlayCard} onStartShouldSetResponder={() => true}>
        <Text style={styles.overlayEyebrow}>ENERGY // CONSERVATION + DISSIPATION</Text>
        <Text style={styles.overlayTitle}>KE ↔ PE Exchange</Text>
        <Text style={styles.formula}>mgh₀ − μ·m·g·w = mgh_f</Text>
        <Text style={styles.overlayBody}>
          A frictionless track conserves mechanical energy: all PE at the start
          becomes KE at the bottom, then KE becomes PE again climbing the other
          hill. Friction in the valley dissipates energy at rate μ·m·g per unit
          horizontal distance.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Mass cancels!</Text> Both the
          driving PE and the friction loss scale with m, so h_f = h₀ − μw is
          mass-independent. Try changing the mass slider — the result doesn't
          move. This is energy doing its job as the invariant.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Path doesn't matter</Text> for the
          frictionless segments. Whether the hills are steep or gentle, only the
          height change converts to / from KE.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Friction is the dissipator.</Text>{' '}
          Without friction, the cart would oscillate between hills forever. The
          valley's μ·w product fully determines energy lost per trip.
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
    fontSize: 15,
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
