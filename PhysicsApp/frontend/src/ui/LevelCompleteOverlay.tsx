/**
 * Full-screen celebration overlay shown when the player clears all goals.
 * Same shape every level; the level name and next-up hint vary per level.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export function LevelCompleteOverlay({
  completedCount,
  totalGoals,
  levelName,
  nextHint,
  onReset,
  onBack,
}: {
  completedCount: number;
  totalGoals: number;
  levelName: string;
  nextHint?: string;
  onReset: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EXPERIMENT COMPLETE</Text>
        <Text style={styles.title}>{levelName}</Text>
        <Text style={styles.bigStat}>
          {completedCount}
          <Text style={styles.bigStatTotal}>/{totalGoals}</Text>
        </Text>
        {nextHint ? <Text style={styles.body}>{nextHint}</Text> : null}
        <View style={{ gap: spacing.two, marginTop: spacing.three }}>
          <Pressable onPress={onBack} style={[styles.btn, styles.btnPrimary]}>
            <Text style={[styles.btnText, { color: colors.bg }]}>BACK TO LEVELS</Text>
          </Pressable>
          <Pressable onPress={onReset} style={styles.btn}>
            <Text style={styles.btnText}>REPLAY</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryDeep,
    padding: spacing.four,
    gap: spacing.two,
    width: '100%',
    maxWidth: 380,
  },
  eyebrow: {
    color: colors.success,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 18,
    letterSpacing: letterSpacing.label,
    fontWeight: '600',
  },
  bigStat: {
    color: colors.success,
    fontFamily: fonts.mono,
    fontSize: 56,
    letterSpacing: letterSpacing.label,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.two,
  },
  bigStatTotal: { color: colors.textSecondary, fontSize: 28 },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    paddingVertical: spacing.three,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
});
