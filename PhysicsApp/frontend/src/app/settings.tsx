import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/store/useSettings';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export default function Settings() {
  const showInstructions = useSettings((s) => s.showInstructions);
  const setShowInstructions = useSettings((s) => s.setShowInstructions);
  const clearAllDismissals = useSettings((s) => s.clearAllDismissals);
  const setHasSeenIntro = useSettings((s) => s.setHasSeenIntro);

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>PREFERENCES</Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: spacing.one }}>
              <Text style={styles.rowTitle}>Show experiment instructions</Text>
              <Text style={styles.rowHelp}>
                When ON, an overlay explains how to play each experiment before it
                starts. Turn OFF if you already know how everything works.
              </Text>
            </View>
            <Switch
              value={showInstructions}
              onValueChange={setShowInstructions}
              trackColor={{ false: colors.border, true: colors.primaryDeep }}
              thumbColor={showInstructions ? colors.primary : colors.surfaceAlt}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            onPress={() => clearAllDismissals()}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>SHOW ALL INSTRUCTIONS AGAIN</Text>
          </Pressable>
          <Text style={[styles.rowHelp, { paddingHorizontal: spacing.three, marginTop: spacing.two }]}>
            Re-enables the per-experiment overlay AND clears any per-level dismissals
            from this session, so each experiment will show its overlay next time you open it.
          </Text>
        </View>

        <View style={styles.section}>
          <Pressable
            onPress={() => setHasSeenIntro(false)}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>SHOW "WHAT IS STEM?" INTRO AGAIN</Text>
          </Pressable>
          <Text style={[styles.rowHelp, { paddingHorizontal: spacing.three, marginTop: spacing.two }]}>
            Re-shows the welcome intro on the next launch — useful for refreshers
            or showing the app to someone new.
          </Text>
        </View>

        <Text style={styles.eyebrow}>ABOUT</Text>
        <View style={styles.section}>
          <Text style={styles.aboutText}>
            Physics is a multi-level S.T.E.M. game built for high-school physics
            learners. Each experiment teaches one concept — kinematics,
            momentum, friction, periodic motion, springs, and energy.
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Text style={styles.backBtnText}>BACK TO LEVELS</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.four, gap: spacing.four },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    marginTop: spacing.three,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  rowHelp: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  btn: {
    paddingVertical: spacing.three,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnPressed: { backgroundColor: colors.surfaceAlt, borderColor: colors.primary },
  btnText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
  aboutText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.three,
    alignItems: 'center',
    marginTop: spacing.three,
  },
  backBtnPressed: { backgroundColor: colors.primaryDeep },
  backBtnText: {
    color: colors.bg,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: letterSpacing.hud,
  },
});
