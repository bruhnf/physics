/**
 * Level 01 — Trajectory (projectile motion on Earth).
 *
 * Engine-proof level: exercises Skia rendering + Reanimated 4 worklet-driven
 * physics tick + interactive HUD. We hand-integrate projectile motion here
 * because Matter.js's gravity is unitless and complicates "real m/s²" mapping;
 * for kinematics this is three lines of math. Multi-body / collision levels
 * (Level 02+) will use Matter.js where its solver actually earns its keep.
 *
 * Physics state lives in Reanimated shared values, so the entire tick runs
 * on the UI thread — never the JS thread (per the resource-conservation
 * contract in docs/product/visualization-theme.md).
 */
import { Canvas, Circle, Line, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  runOnJS,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

const GRAVITY = 9.81; // m/s²
const TARGET_DISTANCE_M = 50;
const TARGET_HALF_WIDTH_M = 1.5;
const HIT_TOLERANCE_M = 2;
const CLOSE_TOLERANCE_M = 5;

const ANGLE_MIN = 5;
const ANGLE_MAX = 85;
const VELOCITY_MIN = 5;
const VELOCITY_MAX = 60;

type Outcome = 'idle' | 'hit' | 'close' | 'miss';

export default function Level01Trajectory() {
  const { width: screenWidth } = useWindowDimensions();
  const canvasHeight = 320;

  const [angleDeg, setAngleDeg] = useState(45);
  const [velocity, setVelocity] = useState(25);
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [landingDistanceM, setLandingDistanceM] = useState<number | null>(null);

  // Viewport: 70m of world fits across the canvas, with 5m margin on each side.
  const worldWidthM = 70;
  const pxPerM = screenWidth / worldWidthM;
  const cannonWorldX = 5;
  const groundPxY = canvasHeight - 24;

  // Physics state (UI thread)
  const posX = useSharedValue(cannonWorldX); // meters
  const posY = useSharedValue(0); // meters above ground
  const velX = useSharedValue(0); // m/s
  const velY = useSharedValue(0); // m/s
  const isFlying = useSharedValue(false);

  // Trail of recent positions (sampled each frame), in pixels
  const trail = useSharedValue<number[]>([]); // flat [x0, y0, x1, y1, ...]

  // Pixel-space derivations (UI thread, fed straight into Skia)
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

  const onLanded = useCallback((finalXMeters: number) => {
    const distance = finalXMeters - cannonWorldX;
    setLandingDistanceM(distance);
    const offset = Math.abs(distance - TARGET_DISTANCE_M);
    if (offset <= HIT_TOLERANCE_M) setOutcome('hit');
    else if (offset <= CLOSE_TOLERANCE_M) setOutcome('close');
    else setOutcome('miss');
  }, []);

  useFrameCallback((info) => {
    'worklet';
    if (!isFlying.value) return;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16.667) / 1000, 0.05);

    velY.value -= GRAVITY * dt; // y is "up positive"
    posX.value += velX.value * dt;
    posY.value += velY.value * dt;

    // Append to trail (cap length so it doesn't grow unbounded)
    const px = posX.value * pxPerM;
    const py = groundPxY - posY.value * pxPerM;
    const next = trail.value.slice();
    next.push(px, py);
    if (next.length > 240) next.splice(0, next.length - 240);
    trail.value = next;

    // Landing detection
    if (posY.value <= 0 && velY.value < 0) {
      posY.value = 0;
      isFlying.value = false;
      runOnJS(onLanded)(posX.value);
    }
  });

  const launch = () => {
    const rad = (angleDeg * Math.PI) / 180;
    posX.value = cannonWorldX;
    posY.value = 0;
    velX.value = velocity * Math.cos(rad);
    velY.value = velocity * Math.sin(rad);
    trail.value = [];
    setOutcome('idle');
    setLandingDistanceM(null);
    isFlying.value = true;
  };

  const reset = () => {
    isFlying.value = false;
    posX.value = cannonWorldX;
    posY.value = 0;
    velX.value = 0;
    velY.value = 0;
    trail.value = [];
    setOutcome('idle');
    setLandingDistanceM(null);
  };

  // Predicted range (vacuum formula) — shown live as a teaching anchor.
  const predictedRangeM = useMemo(() => {
    const rad = (angleDeg * Math.PI) / 180;
    return (velocity * velocity * Math.sin(2 * rad)) / GRAVITY;
  }, [angleDeg, velocity]);

  const targetPxX = (cannonWorldX + TARGET_DISTANCE_M) * pxPerM;
  const targetPxWidth = TARGET_HALF_WIDTH_M * 2 * pxPerM;
  const cannonPxX = cannonWorldX * pxPerM;

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
          {/* Horizon strip — augmentation-theme Earth */}
          <Rect x={0} y={groundPxY} width={screenWidth} height={canvasHeight - groundPxY} color="#1a2a1f" />
          {/* Ground line */}
          <Line
            p1={{ x: 0, y: groundPxY }}
            p2={{ x: screenWidth, y: groundPxY }}
            color={colors.border}
            strokeWidth={1}
          />
          {/* Distance gridlines every 10m */}
          {Array.from({ length: 7 }).map((_, i) => {
            const xWorld = cannonWorldX + (i + 1) * 10;
            const xPx = xWorld * pxPerM;
            return (
              <Line
                key={i}
                p1={{ x: xPx, y: groundPxY }}
                p2={{ x: xPx, y: groundPxY + 6 }}
                color={colors.textDim}
                strokeWidth={1}
              />
            );
          })}

          {/* Target zone */}
          <Rect
            x={targetPxX - targetPxWidth / 2}
            y={groundPxY - 4}
            width={targetPxWidth}
            height={8}
            color={colors.success}
          />

          {/* Cannon base */}
          <Circle cx={cannonPxX} cy={groundPxY} r={10} color={colors.primaryDeep} />
          <Circle cx={cannonPxX} cy={groundPxY} r={5} color={colors.primary} />

          {/* Trajectory trail */}
          <Path path={trailPath} color={colors.primaryLight} style="stroke" strokeWidth={1.5} />

          {/* Projectile */}
          <Circle cx={projPxX} cy={projPxY} r={5} color={colors.primaryLight} />
        </Canvas>

        {/* Distance markers (overlaid) */}
        <View style={[styles.markerLabel, { left: cannonPxX - 12, top: groundPxY + 8 }]}>
          <Text style={styles.markerText}>0 m</Text>
        </View>
        <View style={[styles.markerLabel, { left: targetPxX - 16, top: groundPxY + 8 }]}>
          <Text style={[styles.markerText, { color: colors.success }]}>{TARGET_DISTANCE_M} m</Text>
        </View>
      </View>

      <View style={styles.hud}>
        <View style={styles.controlsRow}>
          <Stepper
            label="ANGLE"
            value={angleDeg}
            unit="°"
            step={1}
            bigStep={5}
            min={ANGLE_MIN}
            max={ANGLE_MAX}
            onChange={setAngleDeg}
          />
          <Stepper
            label="VELOCITY"
            value={velocity}
            unit="m/s"
            step={1}
            bigStep={5}
            min={VELOCITY_MIN}
            max={VELOCITY_MAX}
            onChange={setVelocity}
          />
        </View>

        <View style={styles.readoutsRow}>
          <Readout label="PREDICTED RANGE" value={`${predictedRangeM.toFixed(1)} m`} />
          <Readout
            label="LANDED AT"
            value={landingDistanceM === null ? '—' : `${landingDistanceM.toFixed(1)} m`}
            valueColor={outcomeColor}
          />
        </View>

        <View style={styles.actionsRow}>
          <ActionButton label="LAUNCH" onPress={launch} kind="primary" />
          <ActionButton label="RESET" onPress={reset} kind="ghost" />
        </View>

        {outcome !== 'idle' && (
          <Text style={[styles.outcomeText, { color: outcomeColor }]}>
            {outcome === 'hit' && 'HIT // target achieved'}
            {outcome === 'close' && 'CLOSE // tune your variables'}
            {outcome === 'miss' && 'MISS // try again'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stepper({
  label,
  value,
  unit,
  step,
  bigStep,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  bigStep: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Text style={styles.stepperValue}>
        {value}
        <Text style={styles.stepperUnit}> {unit}</Text>
      </Text>
      <View style={styles.stepperButtons}>
        <StepperButton label={`−${bigStep}`} onPress={() => onChange(clamp(value - bigStep))} />
        <StepperButton label={`−${step}`} onPress={() => onChange(clamp(value - step))} />
        <StepperButton label={`+${step}`} onPress={() => onChange(clamp(value + step))} />
        <StepperButton label={`+${bigStep}`} onPress={() => onChange(clamp(value + bigStep))} />
      </View>
    </View>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
    >
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
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
}: {
  label: string;
  onPress: () => void;
  kind: 'primary' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        kind === 'primary' ? styles.actionPrimary : styles.actionGhost,
        pressed && (kind === 'primary' ? styles.actionPrimaryPressed : styles.actionGhostPressed),
      ]}
    >
      <Text
        style={[
          styles.actionText,
          kind === 'primary' ? styles.actionTextPrimary : styles.actionTextGhost,
        ]}
      >
        {label}
      </Text>
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
    padding: spacing.four,
    gap: spacing.four,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  controlsRow: { flexDirection: 'row', gap: spacing.three },
  stepper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.three,
    gap: spacing.two,
  },
  stepperLabel: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
  },
  stepperValue: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 28,
    letterSpacing: letterSpacing.label,
    fontVariant: ['tabular-nums'],
  },
  stepperUnit: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
  },
  stepperButtons: { flexDirection: 'row', gap: spacing.one, marginTop: spacing.one },
  stepBtn: {
    flex: 1,
    paddingVertical: spacing.two,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  stepBtnPressed: { backgroundColor: colors.primaryDeep },
  stepBtnText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
  },

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
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },
  readoutValue: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 16,
    letterSpacing: letterSpacing.label,
    fontVariant: ['tabular-nums'],
  },

  actionsRow: { flexDirection: 'row', gap: spacing.three },
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
  actionText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
  actionTextPrimary: { color: colors.bg },
  actionTextGhost: { color: colors.textPrimary },

  outcomeText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: letterSpacing.hud,
    textAlign: 'center',
    marginTop: spacing.two,
  },
});
