/**
 * Per-category experiment list. Routes by category slug (e.g., /category/physics).
 *
 * Experiments are grouped by difficulty tier (BASE / INTERMEDIATE / ADVANCED).
 * Tapping an experiment navigates to its route (defined in the catalog).
 */
import { Link, useLocalSearchParams, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findCategory, TIER_LABEL, type ExperimentRef, type Tier } from '@/data/catalog';
import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

const TIER_ORDER: Tier[] = ['BASE', 'INTERMEDIATE', 'ADVANCED'];

export default function CategoryDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const category = slug ? findCategory(slug) : undefined;

  if (!category) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.root}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Category not found: {slug}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Group experiments by tier (preserve tier order within each)
  const byTier: Record<Tier, ExperimentRef[]> = {
    BASE: [],
    INTERMEDIATE: [],
    ADVANCED: [],
  };
  for (const exp of category.experiments) byTier[exp.tier].push(exp);
  for (const t of TIER_ORDER) byTier[t].sort((a, b) => a.order - b.order);

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.eyebrow, { color: category.accentHex }]}>
          STEM LAB // {category.name.toUpperCase()}
        </Text>
        <Text style={styles.description}>{category.description}</Text>

        {category.experiments.length === 0 ? (
          <View style={styles.emptyTierCard}>
            <Text style={styles.emptyTierTitle}>Coming Soon</Text>
            <Text style={styles.emptyTierBody}>
              Experiments for {category.name} are in development. Check back as
              new content rolls out.
            </Text>
          </View>
        ) : (
          TIER_ORDER.map((tier) => {
            const list = byTier[tier];
            if (list.length === 0) return null;
            return (
              <View key={tier} style={styles.tierBlock}>
                <View style={[styles.tierHeader, { borderColor: category.accentHex + '44' }]}>
                  <Text style={[styles.tierLabel, { color: category.accentHex }]}>
                    {TIER_LABEL[tier].toUpperCase()}
                  </Text>
                  <Text style={styles.tierCount}>
                    {list.length} experiment{list.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.tierList}>
                  {list.map((exp) => (
                    <ExperimentTile key={exp.slug} exp={exp} accent={category.accentHex} />
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ExperimentTile({ exp, accent }: { exp: ExperimentRef; accent: string }) {
  return (
    <Link href={exp.href as Href} asChild>
      <Pressable style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
        <View style={styles.tileMeta}>
          <Text style={styles.tileName}>{exp.name}</Text>
          <Text style={styles.tileSubtitle}>{exp.subtitle}</Text>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>—/10</Text>
        </View>
        <Text style={[styles.tileChevron, { color: accent }]}></Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.four, gap: spacing.four },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    marginTop: spacing.three,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },

  tierBlock: { gap: spacing.two },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    paddingTop: spacing.two,
    marginTop: spacing.two,
  },
  tierLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    fontWeight: '700',
  },
  tierCount: {
    color: colors.textDim,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },
  tierList: { gap: spacing.two },

  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.three,
    paddingHorizontal: spacing.four,
  },
  tilePressed: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  tileMeta: { flex: 1, gap: spacing.one },
  tileName: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: letterSpacing.label,
  },
  tileSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
  },
  progressBadge: {
    paddingHorizontal: spacing.two,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  progressBadgeText: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.hud,
    fontVariant: ['tabular-nums'],
  },
  tileChevron: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.five,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  emptyTierCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.two,
    alignItems: 'center',
  },
  emptyTierTitle: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: letterSpacing.hud,
    fontWeight: '700',
  },
  emptyTierBody: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
