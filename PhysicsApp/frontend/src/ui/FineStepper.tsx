/**
 * Four-button row for precise value adjustment: [−coarse] [−fine] [+fine] [+coarse].
 * Pairs with <Slider> for hybrid coarse-drag + fine-tap workflow.
 *
 *   <FineStepper onAdjust={(d) => setValue(clamp(value + d, MIN, MAX))} />
 *   <FineStepper coarse={5} fine={0.5} onAdjust={...} />
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export function FineStepper({
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
    <View style={styles.row}>
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
        styles.btn,
        pressed && styles.btnPressed,
        disabled && styles.btnDisabled,
      ]}
    >
      <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.one },
  btn: {
    flex: 1,
    paddingVertical: spacing.two,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnPressed: { backgroundColor: colors.primaryDeep, borderColor: colors.primary },
  btnDisabled: { opacity: 0.35 },
  btnText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    fontVariant: ['tabular-nums'],
  },
  btnTextDisabled: { opacity: 0.7 },
});
