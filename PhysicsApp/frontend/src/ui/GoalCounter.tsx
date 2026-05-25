/**
 * Top-of-HUD goal header: large X/N counter on the left, current-goal
 * title + hint on the right. Same shape across all levels; the title and
 * hint strings vary per-goal.
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export function GoalCounter({
  index,
  total,
  title,
  hint,
}: {
  index: number;
  total: number;
  title: string;
  hint: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.box}>
        <Text style={styles.label}>GOAL</Text>
        <Text style={styles.value}>
          {Math.min(index + 1, total)}
          <Text style={styles.total}>/{total}</Text>
        </Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint} numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: spacing.three,
    alignItems: 'stretch',
  },
  box: {
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
  label: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: letterSpacing.hud,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    letterSpacing: letterSpacing.label,
  },
  total: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  text: { flex: 1, justifyContent: 'center', gap: spacing.one },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
});
