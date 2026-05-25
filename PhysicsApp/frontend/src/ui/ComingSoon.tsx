/**
 * Placeholder for unfinished level routes. Replaced as each level is built.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export function ComingSoon({ levelName, concept }: { levelName: string; concept: string }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.eyebrow}>IN DEVELOPMENT</Text>
        <Text style={styles.title}>{levelName}</Text>
        <Text style={styles.concept}>{concept}</Text>
        <Text style={styles.body}>This experiment is being prepared.</Text>
        <Pressable onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnText}>BACK TO LEVELS</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.four,
    gap: spacing.two,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: letterSpacing.label,
    fontWeight: '600',
    marginTop: spacing.two,
    textAlign: 'center',
  },
  concept: {
    color: colors.primaryLight,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    marginTop: spacing.one,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.three,
    maxWidth: 280,
  },
  btn: {
    marginTop: spacing.five,
    paddingVertical: spacing.three,
    paddingHorizontal: spacing.five,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
});
