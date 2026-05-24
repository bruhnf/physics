import { useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { colors, fonts, letterSpacing, spacing } from '@/ui/theme';

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 3;

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  precision?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
};

export function Slider({
  label,
  value,
  min,
  max,
  unit,
  precision = 1,
  disabled = false,
  onChange,
}: Props) {
  const trackWidth = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Sync external value -> thumb position when value or layout changes (but not during drag).
  useEffect(() => {
    if (trackWidth.value > 0 && !isDragging.value) {
      thumbX.value = ((value - min) / (max - min)) * trackWidth.value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidth.value = w;
    if (!isDragging.value) {
      thumbX.value = ((value - min) / (max - min)) * w;
    }
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      'worklet';
      isDragging.value = true;
      const w = trackWidth.value;
      if (w <= 0) return;
      const x = Math.max(0, Math.min(w, e.x));
      thumbX.value = x;
    })
    .onUpdate((e) => {
      'worklet';
      const w = trackWidth.value;
      if (w <= 0) return;
      const x = Math.max(0, Math.min(w, e.x));
      thumbX.value = x;
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
    });

  // Tap gesture to allow jumping to a position
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDuration(250)
    .onEnd((e) => {
      'worklet';
      const w = trackWidth.value;
      if (w <= 0) return;
      const x = Math.max(0, Math.min(w, e.x));
      thumbX.value = x;
    });

  const composed = Gesture.Race(pan, tap);

  // Push thumbX -> onChange. Done via useAnimatedReaction-style effect using a derived setter.
  // We sample thumb position via useAnimatedStyle which already runs on UI thread;
  // for state sync we use a poll-free approach: react to thumbX via useAnimatedReaction.
  // (Inlined here to avoid a separate hook file.)
  useAnimatedSync(thumbX, trackWidth, min, max, onChange);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: thumbX.value - THUMB_SIZE / 2 },
      { scale: isDragging.value ? 1.15 : 1 },
    ],
    opacity: disabled ? 0.4 : 1,
  }));

  const filledStyle = useAnimatedStyle(() => ({
    width: thumbX.value,
    opacity: disabled ? 0.4 : 1,
  }));

  const displayValue = value.toFixed(precision);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {displayValue}
          <Text style={styles.unit}> {unit}</Text>
        </Text>
      </View>

      <GestureDetector gesture={composed}>
        <View style={styles.touchArea} onLayout={handleLayout}>
          <View style={styles.track} />
          <Animated.View style={[styles.filled, filledStyle]} />
          <Animated.View style={[styles.thumb, thumbStyle]}>
            <View style={styles.thumbInner} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

// Helper hook: convert thumb position changes (UI thread) into onChange calls (JS thread)
// without spamming — useAnimatedReaction only fires when the derived value changes.
function useAnimatedSync(
  thumbX: SharedValue<number>,
  trackWidth: SharedValue<number>,
  min: number,
  max: number,
  onChange: (next: number) => void,
) {
  useAnimatedReaction(
    () => {
      const w = trackWidth.value;
      if (w <= 0) return min;
      return min + (thumbX.value / w) * (max - min);
    },
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runOnJS(onChange)(current);
      }
    },
    [min, max],
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 20,
    letterSpacing: letterSpacing.label,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
  },
  touchArea: {
    height: THUMB_SIZE + spacing.three * 2,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: colors.border,
    borderRadius: TRACK_HEIGHT / 2,
  },
  filled: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    backgroundColor: colors.primary,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg,
  },
});
