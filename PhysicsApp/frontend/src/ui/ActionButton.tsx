/**
 * Primary / ghost action button used across all levels for LAUNCH, RESET, INFO etc.
 */
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export function ActionButton({
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
          styles.text,
          kind === 'primary' ? styles.textPrimary : styles.textGhost,
          disabled && styles.textDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  text: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
  textPrimary: { color: colors.bg },
  textGhost: { color: colors.textPrimary },
  textDisabled: { opacity: 0.7 },
});
