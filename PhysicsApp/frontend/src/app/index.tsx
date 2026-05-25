/**
 * Top-level category select.
 *
 * On first launch (hasSeenIntro=false), redirects to /intro to show the
 * "What is STEM?" overlay. Otherwise renders a scrollable list of STEM
 * categories — each leads to a per-category experiment list.
 */
import { Link, router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/data/catalog';
import { useSettings } from '@/store/useSettings';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

export default function CategorySelect() {
  const hasSeenIntro = useSettings((s) => s.hasSeenIntro);

  useEffect(() => {
    if (!hasSeenIntro) {
      router.replace('/intro' as Href);
    }
  }, [hasSeenIntro]);

  // Avoid rendering a flash of the index before the intro replace fires
  if (!hasSeenIntro) return null;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>STEM LAB // CATEGORIES</Text>
        <Text style={styles.intro}>
          Pick a category to explore. Each category has experiments organized by
          difficulty — start with Base and work up to Advanced.
        </Text>

        <View style={styles.list}>
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.slug} cat={cat} />
          ))}
        </View>

        <Link href={'/settings' as Href} asChild>
          <Pressable style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}>
            <Text style={styles.settingsBtnText}>⚙ SETTINGS</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryCard({ cat }: { cat: (typeof CATEGORIES)[number] }) {
  const expCount = cat.experiments.length;
  const isEmpty = expCount === 0;

  return (
    <Link href={`/category/${cat.slug}` as Href} asChild disabled={isEmpty}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { borderColor: cat.accentHex + '88' }, // 53% opacity hex suffix
          pressed && !isEmpty && [styles.cardPressed, { borderColor: cat.accentHex }],
          isEmpty && styles.cardEmpty,
        ]}
      >
        <View style={[styles.iconBox, { borderColor: cat.accentHex + '66', backgroundColor: cat.accentHex + '15' }]}>
          <Text style={[styles.iconText, { color: cat.accentHex }]}>{cat.iconText}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={[styles.name, isEmpty && styles.nameEmpty]}>{cat.name}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {cat.description}
          </Text>
          <Text style={[styles.count, { color: cat.accentHex }]}>
            {isEmpty ? 'COMING SOON' : `${expCount} experiment${expCount === 1 ? '' : 's'}`}
          </Text>
        </View>
        {!isEmpty && <Text style={[styles.chevron, { color: cat.accentHex }]}></Text>}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.four,
    gap: spacing.four,
    paddingBottom: spacing.five,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    marginTop: spacing.three,
  },
  intro: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  list: { gap: spacing.three },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.four,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.four,
    paddingHorizontal: spacing.four,
  },
  cardPressed: { backgroundColor: colors.surfaceAlt },
  cardEmpty: { opacity: 0.5 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: fonts.mono,
    fontSize: 26,
    fontWeight: '700',
  },
  meta: { flex: 1, gap: spacing.one },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: letterSpacing.label,
  },
  nameEmpty: { color: colors.textDim },
  description: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  count: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
    fontWeight: '700',
    marginTop: 2,
  },
  chevron: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
  },
  settingsBtn: {
    marginTop: spacing.four,
    paddingVertical: spacing.three,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  settingsBtnPressed: { backgroundColor: colors.surface, borderColor: colors.primary },
  settingsBtnText: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
});
