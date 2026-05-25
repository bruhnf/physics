/**
 * "What is STEM?" first-launch overlay screen.
 *
 * Shown automatically on the first app open. Player taps GET STARTED to
 * proceed to the category index. The "Do not show this again" checkbox
 * flips a persistent setting so subsequent launches skip the intro.
 * Can be re-shown from Settings → "show intro again".
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/store/useSettings';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export default function Intro() {
  const [dontShow, setDontShow] = useState(true); // default checked — most users want this
  const setHasSeenIntro = useSettings((s) => s.setHasSeenIntro);

  const handleGetStarted = () => {
    if (dontShow) setHasSeenIntro(true);
    router.replace('/');
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>WELCOME TO STEM LAB</Text>
        <Text style={styles.title}>Where the world meets science.</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>What is STEM?</Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>S.T.E.M.</Text> stands for{' '}
            <Text style={styles.bold}>Science · Technology · Engineering · Math</Text>.
            These four disciplines are the engines behind modern progress —
            from the phone in your hand to the rockets reaching Mars.
          </Text>
          <Text style={styles.body}>
            STEM Lab turns those ideas into something you can{' '}
            <Text style={styles.bold}>touch</Text>. Every concept is a hands-on
            experiment with adjustable variables. You set the conditions, hit
            LAUNCH, and watch real physics (or math, or engineering) play out.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>How it works</Text>
          <Text style={styles.bullet}>
            • Pick a <Text style={styles.bold}>category</Text> — Physics, Math,
            Engineering, and more on the way.
          </Text>
          <Text style={styles.bullet}>
            • Each category has <Text style={styles.bold}>experiments</Text> at
            three difficulty tiers (Base → Intermediate → Advanced).
          </Text>
          <Text style={styles.bullet}>
            • Each experiment has <Text style={styles.bold}>10 goals</Text>.
            Clear them all to master the concept.
          </Text>
          <Text style={styles.bullet}>
            • Tune <Text style={styles.bold}>sliders</Text> for coarse
            adjustments; tap the <Text style={styles.bold}>+/−</Text> buttons
            for precise tuning.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Tips for first-time players</Text>
          <Text style={styles.bullet}>
            • Read the equation panel under the action buttons — it shows the
            math behind your current settings, updating live.
          </Text>
          <Text style={styles.bullet}>
            • Tap <Text style={styles.bold}>INFO</Text> inside any experiment
            for the full kinematic / dynamic explanation.
          </Text>
          <Text style={styles.bullet}>
            • Hit{' '}
            <Text style={styles.bold}>⚙ SETTINGS</Text> from the main screen to
            toggle instructions or restore them later.
          </Text>
          <Text style={styles.bullet}>
            • Don't worry about getting it perfect on the first try — every
            miss tells you what to adjust for the next shot.
          </Text>
        </View>

        <Pressable
          onPress={() => setDontShow((c) => !c)}
          style={styles.checkboxRow}
          hitSlop={8}
        >
          <View style={[styles.checkbox, dontShow && styles.checkboxChecked]}>
            {dontShow ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>
            Do not show this again. You can re-open it from the Settings menu.
          </Text>
        </Pressable>

        <Pressable
          onPress={handleGetStarted}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>GET STARTED</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.four, gap: spacing.four, paddingBottom: spacing.six },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    marginTop: spacing.three,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: letterSpacing.label,
    lineHeight: 28,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  h2: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: letterSpacing.label,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  bullet: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  bold: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.two,
    marginTop: spacing.two,
    paddingHorizontal: spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkmark: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.four,
    alignItems: 'center',
    marginTop: spacing.two,
  },
  ctaPressed: { backgroundColor: colors.primaryDeep },
  ctaText: {
    color: colors.bg,
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: letterSpacing.hud,
  },
});
