/**
 * Level 02 — Collisions & Momentum.
 *
 * Player ball approaches a stationary target ball on a horizontal track. Both
 * balls feel kinematic (Coulomb) friction. Player adjusts player-ball mass and
 * velocity; goal is to push the target into a ground zone and have it COME TO
 * REST within the zone (not just pass through).
 *
 * Physics — 1D elastic collision with target initially at rest (v₂=0):
 *   v₁' = ((m₁-m₂) / (m₁+m₂)) · v₁
 *   v₂' = (2m₁     / (m₁+m₂)) · v₁
 * Coulomb friction deceleration: a = μ·g, independent of mass.
 * Stop distance from initial velocity v: d = v² / (2μg)
 *
 * Single collision per launch (gateway flag) — in 1D elastic with target at
 * rest, the post-collision velocities always diverge so re-collisions are
 * physically impossible anyway; the flag just keeps the worklet clean.
 *
 * Same scaffold pattern as Level 01: physics in shared values, tick driven by
 * useFrameCallback on the UI thread, JS-thread callbacks invoked via runOnJS
 * only at meaningful state transitions (collision, settled, level complete).
 */
import { Canvas, Circle, Line, Rect } from '@shopify/react-native-skia';
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

// Lazy-require expo-keep-awake so older dev clients don't crash on import
let useKeepAwake: () => void = () => {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useKeepAwake = require('expo-keep-awake').useKeepAwake;
} catch {}

// ---------- Physics constants ----------
const GRAVITY = 9.81; // m/s²
const FRICTION_MU = 0.4; // kinematic friction coefficient (track surface)
const STOP_THRESHOLD = 0.05; // m/s — below this, treat as stopped

// ---------- Viewport ----------
const WORLD_WIDTH_M = 75; // fits hardest goal (target end at ~62m)
const PLAYER_START_X = 5;

// ---------- Controls ----------
const MASS_MIN = 0.5;
const MASS_MAX = 5;
const VEL_MIN = 1;
const VEL_MAX = 20;
const DEFAULT_MASS = 1.0;
const DEFAULT_VEL = 5;

// Visual ball radius scales with mass so the player can see relative weights.
function ballRadiusM(massKg: number) {
  return 0.25 + 0.12 * Math.sqrt(massKg); // 0.5kg → 0.34m, 5kg → 0.52m, 10kg → 0.63m
}

// ---------- Goals ----------
type Goal = {
  targetMassKg: number;
  targetStartM: number;
  zoneCenterM: number;
  zoneWidthM: number;
  hint: string;
};

const GOALS: Goal[] = [
  {
    targetMassKg: 1.0,
    targetStartM: 15,
    zoneCenterM: 25,
    zoneWidthM: 10,
    hint: 'Equal masses — what happens to the player ball?',
  },
  {
    targetMassKg: 2.0,
    targetStartM: 20,
    zoneCenterM: 32,
    zoneWidthM: 5,
    hint: 'Heavier target needs more momentum',
  },
  {
    targetMassKg: 0.5,
    targetStartM: 15,
    zoneCenterM: 38,
    zoneWidthM: 4,
    hint: 'Light target — small mass with high v transfers a lot',
  },
  {
    targetMassKg: 3.0,
    targetStartM: 25,
    zoneCenterM: 37,
    zoneWidthM: 4,
    hint: 'Heavy target, short throw — try matching masses',
  },
  {
    targetMassKg: 1.0,
    targetStartM: 10,
    zoneCenterM: 47,
    zoneWidthM: 4,
    hint: 'Long throw — friction eats your reach',
  },
  {
    targetMassKg: 5.0,
    targetStartM: 20,
    zoneCenterM: 30,
    zoneWidthM: 3,
    hint: 'Heavy + precise — m₁ ≈ m₂ delivers cleanly',
  },
  {
    targetMassKg: 2.0,
    targetStartM: 15,
    zoneCenterM: 51,
    zoneWidthM: 3,
    hint: 'Far + medium target — crank velocity',
  },
  {
    targetMassKg: 4.0,
    targetStartM: 30,
    zoneCenterM: 49,
    zoneWidthM: 3,
    hint: 'Heavy + far — push m₁ high',
  },
  {
    targetMassKg: 0.5,
    targetStartM: 10,
    zoneCenterM: 60,
    zoneWidthM: 4,
    hint: 'Very light target — lean on v₁',
  },
  {
    targetMassKg: 10.0,
    targetStartM: 25,
    zoneCenterM: 36,
    zoneWidthM: 2,
    hint: 'Bowling-ball target — needs maximum m₁',
  },
];

const CLOSE_BUFFER_M = 3;

// ---------- Helpers ----------
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Outcome = 'idle' | 'rolling' | 'hit' | 'close' | 'miss' | 'level-complete';

export default function Level02Collisions() {
  useKeepAwake();
  const playSound = useSounds();

  const { width: screenWidth } = useWindowDimensions();
  const canvasHeight = 200;

  const [m1, setM1] = useState(DEFAULT_MASS);
  const [v1, setV1] = useState(DEFAULT_VEL);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [finalTargetX, setFinalTargetX] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const currentGoal = GOALS[Math.min(currentGoalIndex, GOALS.length - 1)];
  const pxPerM = screenWidth / WORLD_WIDTH_M;
  const trackY = canvasHeight - 50;

  // Physics state (UI thread)
  const playerX = useSharedValue(PLAYER_START_X);
  const playerVx = useSharedValue(0);
  const targetX = useSharedValue(currentGoal.targetStartM);
  const targetVx = useSharedValue(0);
  const isRolling = useSharedValue(false);
  const hasCollided = useSharedValue(false);

  // Mass + collision distance snapshots taken at launch so the worklet has
  // stable values to work with (React state is JS-thread, doesn't auto-sync).
  const m1Snap = useSharedValue(DEFAULT_MASS);
  const m2Snap = useSharedValue(currentGoal.targetMassKg);
  const collisionDistM = useSharedValue(0);

  const playerPxX = useDerivedValue(() => playerX.value * pxPerM);
  const targetPxX = useDerivedValue(() => targetX.value * pxPerM);

  const playerRadiusPx = ballRadiusM(m1) * pxPerM;
  const targetRadiusPx = ballRadiusM(currentGoal.targetMassKg) * pxPerM;

  // Reset positions when goal changes (or on level reset via sessionVersion)
  const [sessionVersion, setSessionVersion] = useState(0);
  useEffect(() => {
    playerX.value = PLAYER_START_X;
    playerVx.value = 0;
    targetX.value = currentGoal.targetStartM;
    targetVx.value = 0;
    isRolling.value = false;
    hasCollided.value = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGoalIndex, sessionVersion]);

  // Predicted result (recomputes live as m₁, v₁, or goal change).
  const predicted = useMemo(() => {
    const m2 = currentGoal.targetMassKg;
    const v1Prime = ((m1 - m2) / (m1 + m2)) * v1;
    const v2Prime = ((2 * m1) / (m1 + m2)) * v1;
    const targetTravelM = (v2Prime * v2Prime) / (2 * FRICTION_MU * GRAVITY);
    const targetFinalX = currentGoal.targetStartM + targetTravelM;
    const p_initial = m1 * v1;
    return { v1Prime, v2Prime, targetTravelM, targetFinalX, p_initial };
  }, [m1, v1, currentGoal]);

  // Launch-flash animation on the equation panel
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

  // Haptic + sound feedback
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
      setFinalTargetX(null);
      return next;
    });
  }, [triggerFeedback]);

  const onSettled = useCallback(
    (finalX: number) => {
      setFinalTargetX(finalX);
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
    if (!isRolling.value) return;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.667) / 1000, 0.05);
    const decel = FRICTION_MU * GRAVITY;

    // Coulomb friction on both balls
    if (Math.abs(playerVx.value) > 0) {
      const sign = playerVx.value > 0 ? 1 : -1;
      const newSpeed = Math.max(0, Math.abs(playerVx.value) - decel * dt);
      playerVx.value = newSpeed * sign;
    }
    if (Math.abs(targetVx.value) > 0) {
      const sign = targetVx.value > 0 ? 1 : -1;
      const newSpeed = Math.max(0, Math.abs(targetVx.value) - decel * dt);
      targetVx.value = newSpeed * sign;
    }

    // Integrate positions
    playerX.value += playerVx.value * dt;
    targetX.value += targetVx.value * dt;

    // Single 1D elastic collision (gated by hasCollided)
    if (
      !hasCollided.value &&
      playerX.value >= targetX.value - collisionDistM.value &&
      playerVx.value > targetVx.value
    ) {
      const m1L = m1Snap.value;
      const m2L = m2Snap.value;
      const v1L = playerVx.value;
      const v2L = targetVx.value;
      playerVx.value = ((m1L - m2L) * v1L + 2 * m2L * v2L) / (m1L + m2L);
      targetVx.value = ((m2L - m1L) * v2L + 2 * m1L * v1L) / (m1L + m2L);
      hasCollided.value = true;
    }

    // Settled when both balls have stopped. Doesn't require a collision —
    // the player ball might run out of friction before reaching the target;
    // in that case the goal is a definite miss but the simulation should
    // still settle, not spin forever.
    if (
      Math.abs(playerVx.value) < STOP_THRESHOLD &&
      Math.abs(targetVx.value) < STOP_THRESHOLD
    ) {
      playerVx.value = 0;
      targetVx.value = 0;
      isRolling.value = false;
      runOnJS(onSettled)(targetX.value);
    }
  });

  const launch = () => {
    if (outcome === 'level-complete') return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    playerX.value = PLAYER_START_X;
    targetX.value = currentGoal.targetStartM;
    playerVx.value = v1;
    targetVx.value = 0;
    m1Snap.value = m1;
    m2Snap.value = currentGoal.targetMassKg;
    collisionDistM.value = ballRadiusM(m1) + ballRadiusM(currentGoal.targetMassKg);
    hasCollided.value = false;
    isRolling.value = true;
    setOutcome('rolling');
    setFinalTargetX(null);
    triggerFeedback('launch');
    launchPulse.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 840 }),
    );
  };

  const reset = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    isRolling.value = false;
    hasCollided.value = false;
    playerX.value = PLAYER_START_X;
    targetX.value = currentGoal.targetStartM;
    playerVx.value = 0;
    targetVx.value = 0;
    setOutcome('idle');
    setFinalTargetX(null);
  };

  const resetLevel = () => {
    reset();
    setCurrentGoalIndex(0);
    setCompletedCount(0);
    setSessionVersion((v) => v + 1);
  };

  const isControlsDisabled = outcome === 'rolling' || outcome === 'level-complete';
  const isLevelComplete = outcome === 'level-complete';

  const outcomeColor =
    outcome === 'hit'
      ? colors.success
      : outcome === 'close'
        ? colors.warning
        : outcome === 'miss'
          ? colors.failure
          : colors.textSecondary;

  // Pixel-space helpers for canvas
  const playerStartPx = PLAYER_START_X * pxPerM;
  const zoneLowPx = (currentGoal.zoneCenterM - currentGoal.zoneWidthM / 2) * pxPerM;
  const zonePxWidth = currentGoal.zoneWidthM * pxPerM;
  const targetStartPx = currentGoal.targetStartM * pxPerM;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.canvasWrap}>
        <Canvas style={{ width: screenWidth, height: canvasHeight }}>
          {/* Background — warm industrial tint */}
          <Rect x={0} y={0} width={screenWidth} height={trackY + 6} color="#15110d" />
          {/* Track surface */}
          <Rect
            x={0}
            y={trackY + 6}
            width={screenWidth}
            height={canvasHeight - trackY - 6}
            color="#2a221c"
          />
          <Line
            p1={{ x: 0, y: trackY + 6 }}
            p2={{ x: screenWidth, y: trackY + 6 }}
            color={colors.border}
            strokeWidth={1}
          />

          {/* 5m gridlines */}
          {Array.from({ length: 14 }).map((_, i) => {
            const xPx = (i + 1) * 5 * pxPerM;
            if (xPx > screenWidth) return null;
            return (
              <Line
                key={i}
                p1={{ x: xPx, y: trackY + 6 }}
                p2={{ x: xPx, y: trackY + 12 }}
                color={colors.textDim}
                strokeWidth={1}
              />
            );
          })}

          {/* Goal zone (green band) */}
          <Rect
            x={zoneLowPx}
            y={trackY - 4}
            width={zonePxWidth}
            height={10}
            color={colors.success}
          />

          {/* Player start mark */}
          <Line
            p1={{ x: playerStartPx, y: trackY - 14 }}
            p2={{ x: playerStartPx, y: trackY + 6 }}
            color={colors.primaryDeep}
            strokeWidth={1}
          />

          {/* Target start mark (ghost) */}
          {targetStartPx !== zoneLowPx && (
            <Line
              p1={{ x: targetStartPx, y: trackY - 14 }}
              p2={{ x: targetStartPx, y: trackY + 6 }}
              color={colors.warning}
              strokeWidth={1}
            />
          )}

          {/* Target ball */}
          <Circle cx={targetPxX} cy={trackY} r={targetRadiusPx} color={colors.warning} />

          {/* Player ball */}
          <Circle cx={playerPxX} cy={trackY} r={playerRadiusPx} color={colors.primary} />
        </Canvas>

        {/* Position labels */}
        <View style={[styles.markerLabel, { left: playerStartPx - 8, top: trackY + 14 }]}>
          <Text style={styles.markerText}>0</Text>
        </View>
        <View style={[styles.markerLabel, { left: targetStartPx - 12, top: trackY + 14 }]}>
          <Text style={[styles.markerText, { color: colors.warning }]}>
            {currentGoal.targetStartM}m
          </Text>
        </View>
        <View style={[styles.markerLabel, { left: zoneLowPx + zonePxWidth / 2 - 14, top: trackY + 14 }]}>
          <Text style={[styles.markerText, { color: colors.success }]}>
            {currentGoal.zoneCenterM}m
          </Text>
        </View>
      </View>

      <View style={styles.hud}>
        <GoalCounter
          index={currentGoalIndex}
          total={GOALS.length}
          title={`STOP ${currentGoal.targetMassKg.toFixed(1)} kg TARGET IN ZONE @ ${currentGoal.zoneCenterM}m`}
          hint={currentGoal.hint}
        />

        <View style={styles.controlsRow}>
          <View style={styles.controlCol}>
            <Slider
              label="PLAYER MASS m₁"
              value={m1}
              min={MASS_MIN}
              max={MASS_MAX}
              unit="kg"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setM1(round1(clamp(v, MASS_MIN, MASS_MAX)))}
            />
            <FineStepper
              coarse={0.5}
              fine={0.1}
              onAdjust={(d) => setM1((prev) => round1(clamp(prev + d, MASS_MIN, MASS_MAX)))}
              disabled={isControlsDisabled}
            />
          </View>
          <View style={styles.controlCol}>
            <Slider
              label="VELOCITY v₁"
              value={v1}
              min={VEL_MIN}
              max={VEL_MAX}
              unit="m/s"
              precision={1}
              disabled={isControlsDisabled}
              onChange={(v) => setV1(round1(clamp(v, VEL_MIN, VEL_MAX)))}
            />
            <FineStepper
              onAdjust={(d) => setV1((prev) => round1(clamp(prev + d, VEL_MIN, VEL_MAX)))}
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
          <Text style={styles.equationEyebrow}>CONSERVATION OF MOMENTUM // ELASTIC</Text>
          <Text style={styles.equationSymbolic}>v₂' = 2m₁ / (m₁ + m₂) · v₁</Text>

          <View style={styles.eqValuesBlock}>
            <EqRow symbol="m₁" value={m1.toFixed(1)} unit="kg" />
            <EqRow symbol="v₁" value={v1.toFixed(1)} unit="m/s" />
            <EqRow symbol="m₂" value={currentGoal.targetMassKg.toFixed(1)} unit="kg" muted />
            <EqRow symbol="μ" value={FRICTION_MU.toFixed(2)} unit="" muted />
            <View style={styles.eqDivider} />
            <EqRow symbol="v₂'" value={predicted.v2Prime.toFixed(2)} unit="m/s" />
            <EqRow
              symbol="d"
              value={predicted.targetTravelM.toFixed(1)}
              unit="m (target travel)"
              emphasis
            />
          </View>

          <Text style={styles.equationActualRow}>
            <Text style={styles.equationActualLabel}>FINAL TARGET: </Text>
            <Text style={[styles.equationActualValue, { color: outcomeColor }]}>
              {finalTargetX === null ? '—' : `${finalTargetX.toFixed(1)} m`}
            </Text>
            {outcome === 'hit' && (
              <Text style={[styles.equationActualValue, { color: colors.success }]}>
                {' // GOAL '}
                {currentGoalIndex + 1}
                {' CLEARED'}
              </Text>
            )}
            {outcome === 'close' && finalTargetX !== null && (
              <Text style={[styles.equationActualValue, { color: colors.warning }]}>
                {' // CLOSE — off by '}
                {Math.abs(finalTargetX - currentGoal.zoneCenterM).toFixed(1)}
                {' m'}
              </Text>
            )}
            {outcome === 'miss' && finalTargetX !== null && (
              <Text style={[styles.equationActualValue, { color: colors.failure }]}>
                {' // MISS — off by '}
                {Math.abs(finalTargetX - currentGoal.zoneCenterM).toFixed(1)}
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
          levelName="Level 02 — Collisions"
          nextHint="Next experiment: inclined plane — friction + Newton's 2nd law in action."
          onReset={resetLevel}
          onBack={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

// ---------- Instructions overlay ----------

function InstructionsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={styles.overlayCard} onStartShouldSetResponder={() => true}>
        <Text style={styles.overlayEyebrow}>DYNAMICS // 1D COLLISIONS</Text>
        <Text style={styles.overlayTitle}>Conservation of Momentum</Text>
        <Text style={styles.formula}>m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'</Text>
        <Text style={styles.overlayBody}>
          In an isolated 1D elastic collision (target initially at rest), the
          post-collision velocities are:
        </Text>
        <Text style={styles.formula}>
          v₁' = (m₁ − m₂)/(m₁ + m₂) · v₁{'\n'}
          v₂' = 2m₁/(m₁ + m₂) · v₁
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Equal masses</Text>: player ball stops dead, target takes all the velocity.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Heavy player (m₁ ≫ m₂)</Text>: target gets close to 2v₁ — maximum transfer.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Light player (m₁ ≪ m₂)</Text>: player bounces back, target barely moves.
        </Text>
        <Text style={styles.overlayBody}>
          Friction (μ = {FRICTION_MU}) decelerates the target after collision.
          It stops after distance <Text style={styles.overlayBold}>d = v² / (2μg)</Text>.
        </Text>
        <Pressable onPress={onClose} style={styles.overlayClose}>
          <Text style={styles.overlayCloseText}>CLOSE</Text>
        </Pressable>
      </View>
    </Pressable>
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
    fontSize: 14,
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
  equationActualLabel: {
    color: colors.textSecondary,
  },
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
    fontSize: 14,
    letterSpacing: letterSpacing.label,
    textAlign: 'center',
    paddingVertical: spacing.two,
    lineHeight: 22,
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
