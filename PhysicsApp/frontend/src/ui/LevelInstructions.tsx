/**
 * Pre-experiment instructional overlay. Shown when a level mounts IF:
 *   - The global `showInstructions` setting is true, AND
 *   - This level hasn't been dismissed in the current session.
 *
 * OK button dismisses for this session. The "Do not show instructions"
 * checkbox additionally flips the global setting off — so all future
 * levels skip their overlays until re-enabled from the Settings menu.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '@/store/useSettings';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export function LevelInstructions({
  levelId,
  title,
  explanation,
  onDismiss,
}: {
  levelId: string;
  title: string;
  explanation: string;
  onDismiss: () => void;
}) {
  const [dontShow, setDontShow] = useState(false);
  const setShowInstructions = useSettings((s) => s.setShowInstructions);
  const dismissLevel = useSettings((s) => s.dismissLevel);

  const handleOk = () => {
    if (dontShow) setShowInstructions(false);
    dismissLevel(levelId);
    onDismiss();
  };

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>HOW TO PLAY</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{explanation}</Text>

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setDontShow((c) => !c)}
          hitSlop={8}
        >
          <View style={[styles.checkbox, dontShow && styles.checkboxChecked]}>
            {dontShow ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>
            Do not show instructions. This can be changed in the Settings menu.
          </Text>
        </Pressable>

        <Pressable
          onPress={handleOk}
          style={({ pressed }) => [styles.okBtn, pressed && styles.okBtnPressed]}
        >
          <Text style={styles.okBtnText}>OK</Text>
        </Pressable>
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
    gap: spacing.three,
    width: '100%',
    maxWidth: 380,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 17,
    letterSpacing: letterSpacing.label,
    fontWeight: '600',
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.two,
    marginTop: spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
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
    lineHeight: 16,
  },
  checkboxLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  okBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.three,
    alignItems: 'center',
    marginTop: spacing.two,
  },
  okBtnPressed: { backgroundColor: colors.primaryDeep },
  okBtnText: {
    color: colors.bg,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: letterSpacing.hud,
  },
});
