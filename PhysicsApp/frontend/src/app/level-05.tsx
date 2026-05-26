/**
 * Level 05 — Springs (Hooke's law + energy conservation).
 *
 * Spring-loaded launcher. Player compresses the spring by displacement x and
 * picks spring stiffness k. On release, spring PE converts to block KE:
 *   ½·k·x² = ½·m·v²    →    v = x·√(k/m)
 * Block then slides on friction track and stops at d = v²/(2μg).
 *
 * Goal: stop the block inside a target zone on the track.
 *
 * Physics:
 *   Spring force during release:  F = −k·(x_block − x_natural)
 *   Integrated as ODE during the spring-expansion phase (brief, but visible
 *   for low-k springs where it takes ~half a second).
 *   Once block reaches natural-length position with velocity v, transitions
 *   to friction-decel phase on the track.
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
const FRICTION_MU = 0.2;
const STOP_THRESHOLD = 0.05;

const WORLD_WIDTH_M = 55;
const WALL_WORLD_X = 1;
const NATURAL_SPRING_LENGTH_M = 2; // distance from wall to spring's relaxed end

const X_MIN = 0.05;
const X_MAX = 1.0;
const K_MIN = 10;
const K_MAX = 500;
const DEFAULT_X = 0.5;
const DEFAULT_K = 100;

type Goal = {
  massKg: number;
  zoneCenterM: number;
  zoneWidthM: number;
  hint: string;
};

// All distances measured from where the natural spring end is — i.e., the
// block's "rest" position before compression. Block exits spring at x=0
// (in track coords) and rolls forward.
// Goal data fetched via useGoals('springs') from the backend;
// bundled fallback in src/data/starter-pack.ts. DEFAULT_GOAL is a safety
// stub for the (unlikely) case where goals is empty during first render.
const DEFAULT_GOAL: Goal = { massKg: 1, zoneCenterM: 6, zoneWidthM: 3, hint: '' };

const CLOSE_BUFFER_M = 2;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Outcome = 'idle' | 'releasing' | 'rolling' | 'hit' | 'close' | 'miss' | 'level-complete';

export default function Level05Springs() {
  useKeepAwake();
  const playSound = useSounds();

  const { width: screenWidth } = useWindowDimensions();
  const canvasHeight = 220;
  const trackY = canvasHeight - 50;
  const pxPerM = screenWidth / WORLD_WIDTH_M;
  const wallPxX = WALL_WORLD_X * pxPerM;
  const naturalEndPxX = (WALL_WORLD_X + NATURAL_SPRING_LENGTH_M) * pxPerM;

  const [x, setX] = useState(DEFAULT_X);
  const [k, setK] = useState(DEFAULT_K);
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [finalBlockX, setFinalBlockX] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const instructionsEnabled = useSettings((s) => s.showInstructions);
  const sessionDismissed = useSettings((s) => !!s.dismissedThisSession['level-05']);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const showStartOverlay = instructionsEnabled && !sessionDismissed && !overlayDismissed;
  const [sessionVersion, setSessionVersion] = useState(0);

  const { goals: fetchedGoals } = useGoals<Omit<Goal, 'hint'>>('springs');
  const goals = useMemo<Goal[]>(
    () => fetchedGoals.map((g) => ({ ...g.config, hint: g.hint ?? '' })),
    [fetchedGoals],
  );
  const currentGoal = goals[Math.min(currentGoalIndex, Math.max(0, goals.length - 1))] ?? DEFAULT_GOAL;

  // Snapshots taken at launch (worklet reads these)
  const kSnap = useSharedValue(DEFAULT_K);
  const mSnap = useSharedValue(currentGoal.massKg);

  // Phase: 0 idle, 1 releasing (on spring), 2 rolling (on track), 3 stopped
  const phase = useSharedValue(0);
  // blockPos: world x position of block, measured from natural spring end (x=0)
  // Negative means compressed into spring; positive means on track.
  const blockPos = useSharedValue(-DEFAULT_X);
  const blockVx = useSharedValue(0);

  // Reset on goal change / replay
  useEffect(() => {
    phase.value = 0;
    blockPos.value = -x;
    blockVx.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGoalIndex, sessionVersion]);

  // Update idle block position when x changes (so visual matches slider)
  useEffect(() => {
    if (phase.value === 0 || phase.value === 3) {
      blockPos.value = -x;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x]);

  const predicted = useMemo(() => {
    const m = currentGoal.massKg;
    const v_launch = x * Math.sqrt(k / m);
    const d_track = (v_launch * v_launch) / (2 * FRICTION_MU * GRAVITY);
    const pe = 0.5 * k * x * x;
    const ke = 0.5 * m * v_launch * v_launch;
    return { v_launch, d_track, pe, ke };
  }, [x, k, currentGoal]);

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
      setFinalBlockX(null);
      return next;
    });
  }, [triggerFeedback]);

  const onSettled = useCallback(
    (finalX: number) => {
      setFinalBlockX(finalX);
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
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.667) / 1000, 0.01);

    if (p === 1) {
      // On spring: restoring force F = −k·blockPos (since natural position is x=0)
      // Block compressed → blockPos < 0 → force is positive (pushes right)
      const F = -kSnap.value * blockPos.value;
      const a = F / mSnap.value;
      blockVx.value += a * dt;
      blockPos.value += blockVx.value * dt;
      if (blockPos.value >= 0) {
        // Block has reached natural spring end — released onto track
        blockPos.value = 0;
        phase.value = 2;
      }
    } else if (p === 2) {
      // On track: friction decel
      const decel = FRICTION_MU * GRAVITY;
      blockVx.value = Math.max(0, blockVx.value - decel * dt);
      blockPos.value += blockVx.value * dt;
      if (blockVx.value < STOP_THRESHOLD) {
        blockVx.value = 0;
        phase.value = 3;
        runOnJS(onSettled)(blockPos.value);
      }
    }
  });

  // Spring visual — zigzag pattern from wall to block position
  const COILS = 12;
  const SPRING_AMPLITUDE = 12;
  const springPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    // Block position in pixels (relative to natural end at naturalEndPxX)
    const blockPxX = naturalEndPxX + blockPos.value * pxPerM;
    const springLen = blockPxX - wallPxX;
    if (springLen <= 0) return path;
    const step = springLen / (COILS + 1);
    path.moveTo(wallPxX, trackY);
    for (let i = 1; i <= COILS; i++) {
      const cx = wallPxX + step * i;
      const cy = trackY + (i % 2 === 0 ? SPRING_AMPLITUDE : -SPRING_AMPLITUDE);
      path.lineTo(cx, cy);
    }
    path.lineTo(blockPxX, trackY);
    return path;
  });

  const blockPxX = useDerivedValue(() => naturalEndPxX + blockPos.value * pxPerM);

  const launch = () => {
    if (outcome === 'level-complete') return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    kSnap.value = k;
    mSnap.value = currentGoal.massKg;
    blockPos.value = -x;
    blockVx.value = 0;
    phase.value = 1;
    setOutcome('releasing');
    setFinalBlockX(null);
    triggerFeedback('launch');
    launchPulse.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 840 }),
    );
  };

  const reset = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    phase.value = 0;
    blockPos.value = -DEFAULT_X;
    blockVx.value = 0;
    setOutcome('idle');
    setFinalBlockX(null);
  };

  const resetLevel = () => {
    reset();
    setCurrentGoalIndex(0);
    setCompletedCount(0);
    setSessionVersion((v) => v + 1);
  };

  const isControlsDisabled =
    outcome === 'releasing' || outcome === 'rolling' || outcome === 'level-complete';
  const isLevelComplete = outcome === 'level-complete';

  const outcomeColor =
    outcome === 'hit'
      ? colors.success
      : outcome === 'close'
        ? colors.warning
        : outcome === 'miss'
          ? colors.failure
          : colors.textSecondary;

  const zoneStartPx = naturalEndPxX + (currentGoal.zoneCenterM - currentGoal.zoneWidthM / 2) * pxPerM;
  const zoneWidthPx = currentGoal.zoneWidthM * pxPerM;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.canvasWrap}>
        <Canvas style={{ width: screenWidth, height: canvasHeight }}>
          {/* Background — warm dark machinist tone */}
          <Rect x={0} y={0} width={screenWidth} height={trackY + 8} color="#140c0c" />
          {/* Ground band — crimson industrial */}
          <Rect
            x={0}
            y={trackY + 8}
            width={screenWidth}
            height={canvasHeight - trackY - 8}
            color="#2a1a1d"
          />
          {/* Wall on left — red industrial */}
          <Rect x={wallPxX - 6} y={trackY - 30} width={6} height={48} color="#7d2828" />
          {/* Track baseline */}
          <Line
            p1={{ x: wallPxX, y: trackY + 8 }}
            p2={{ x: screenWidth, y: trackY + 8 }}
            color={colors.border}
            strokeWidth={1}
          />
          {/* 5m gridlines on track */}
          {Array.from({ length: 10 }).map((_, i) => {
            const xPx = naturalEndPxX + (i + 1) * 5 * pxPerM;
            if (xPx > screenWidth) return null;
            return (
              <Line
                key={i}
                p1={{ x: xPx, y: trackY + 8 }}
                p2={{ x: xPx, y: trackY + 14 }}
                color={colors.textDim}
                strokeWidth={1}
              />
            );
          })}
          {/* Natural-end marker */}
          <Line
            p1={{ x: naturalEndPxX, y: trackY - 12 }}
            p2={{ x: naturalEndPxX, y: trackY + 8 }}
            color={colors.textDim}
            strokeWidth={1}
          />
          {/* Goal zone */}
          <Rect
            x={zoneStartPx}
            y={trackY + 4}
            width={zoneWidthPx}
            height={8}
            color={colors.success}
          />
          {/* Spring */}
          <Path path={springPath} color={colors.primary} style="stroke" strokeWidth={2} />
          {/* Block */}
          <Circle cx={blockPxX} cy={trackY} r={8} color={colors.primary} />
        </Canvas>

        <View
          style={[
            styles.markerLabel,
            { left: zoneStartPx + zoneWidthPx / 2 - 14, top: trackY + 18 },
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
          title={`STOP ${currentGoal.massKg.toFixed(1)} kg BLOCK IN ZONE @ ${currentGoal.zoneCenterM}m`}
          hint={currentGoal.hint}
        />

        <View style={styles.controlsRow}>
          <View style={styles.controlCol}>
            <Slider
              label="COMPRESSION x"
              value={x}
              min={X_MIN}
              max={X_MAX}
              unit="m"
              precision={2}
              disabled={isControlsDisabled}
              onChange={(v) => setX(round2(clamp(v, X_MIN, X_MAX)))}
            />
            <FineStepper
              coarse={0.1}
              fine={0.01}
              onAdjust={(d) => setX((prev) => round2(clamp(prev + d, X_MIN, X_MAX)))}
              disabled={isControlsDisabled}
            />
          </View>
          <View style={styles.controlCol}>
            <Slider
              label="SPRING k"
              value={k}
              min={K_MIN}
              max={K_MAX}
              unit="N/m"
              precision={0}
              disabled={isControlsDisabled}
              onChange={(v) => setK(Math.round(clamp(v, K_MIN, K_MAX)))}
            />
            <FineStepper
              coarse={10}
              fine={1}
              onAdjust={(d) => setK((prev) => Math.round(clamp(prev + d, K_MIN, K_MAX)))}
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
          <Text style={styles.equationEyebrow}>HOOKE'S LAW // ENERGY TRANSFER</Text>
          <Text style={styles.equationSymbolic}>½·k·x² = ½·m·v² → v = x·√(k/m)</Text>

          <View style={styles.eqValuesBlock}>
            <EqRow symbol="x" value={x.toFixed(2)} unit="m" />
            <EqRow symbol="k" value={k.toFixed(0)} unit="N/m" />
            <EqRow symbol="m" value={currentGoal.massKg.toFixed(1)} unit="kg" muted />
            <EqRow symbol="μ" value={FRICTION_MU.toFixed(2)} unit="" muted />
            <View style={styles.eqDivider} />
            <EqRow symbol="PE" value={predicted.pe.toFixed(2)} unit="J (stored)" />
            <EqRow symbol="v" value={predicted.v_launch.toFixed(2)} unit="m/s (launch)" />
            <EqRow symbol="d" value={predicted.d_track.toFixed(2)} unit="m (predicted)" emphasis />
          </View>

          <Text style={styles.equationActualRow}>
            <Text style={styles.equationActualLabel}>BLOCK STOPPED AT: </Text>
            <Text style={[styles.equationActualValue, { color: outcomeColor }]}>
              {finalBlockX === null ? '—' : `${finalBlockX.toFixed(2)} m`}
            </Text>
            {outcome === 'hit' && (
              <Text style={[styles.equationActualValue, { color: colors.success }]}>
                {' // GOAL '}
                {currentGoalIndex + 1}
                {' CLEARED'}
              </Text>
            )}
            {outcome === 'close' && finalBlockX !== null && (
              <Text style={[styles.equationActualValue, { color: colors.warning }]}>
                {' // CLOSE — off by '}
                {Math.abs(finalBlockX - currentGoal.zoneCenterM).toFixed(2)}
                {' m'}
              </Text>
            )}
            {outcome === 'miss' && finalBlockX !== null && (
              <Text style={[styles.equationActualValue, { color: colors.failure }]}>
                {' // MISS — off by '}
                {Math.abs(finalBlockX - currentGoal.zoneCenterM).toFixed(2)}
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
          levelName="Level 05 — Springs"
          nextHint="Next experiment: energy conservation — KE ↔ PE on a curved track."
          onReset={resetLevel}
          onBack={() => router.back()}
        />
      )}

      {showStartOverlay && (
        <LevelInstructions
          levelId="level-05"
          title="Level 05 — Springs"
          explanation="Compress the SPRING by x meters and pick its STIFFNESS k. On release, spring energy launches the block down a friction track. Goal: block comes to rest inside the green zone."
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
        <Text style={styles.overlayEyebrow}>HOOKE'S LAW // ELASTIC PE</Text>
        <Text style={styles.overlayTitle}>Spring Energy</Text>
        <Text style={styles.formula}>F = −k·x{'\n'}PE = ½·k·x²</Text>
        <Text style={styles.overlayBody}>
          A compressed spring stores potential energy proportional to compression
          squared. On release, that PE converts entirely (in this idealization)
          to the block's kinetic energy.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Energy → velocity:</Text>{' '}
          ½·k·x² = ½·m·v² gives v = x·√(k/m). Heavier block, lower v for the same
          stored energy.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Quadratic in x:</Text> doubling
          compression QUADRUPLES the energy and DOUBLES the launch velocity.
        </Text>
        <Text style={styles.overlayBullet}>
          • <Text style={styles.overlayBold}>Spring stiffness k</Text> determines how
          much energy you store per unit compression. Stiff springs (high k) launch
          harder for the same x.
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
    fontSize: 17,
    letterSpacing: letterSpacing.label,
    textAlign: 'center',
    paddingVertical: spacing.two,
    lineHeight: 24,
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
