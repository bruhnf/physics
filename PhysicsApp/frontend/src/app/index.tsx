import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, letterSpacing, radii, spacing } from '@/ui/theme';

type LevelStatus = 'available' | 'locked';

// href typed as string because expo-router's typedRoutes only regenerates the
// route union when `expo start` runs; new level stubs added in the same session
// aren't visible to tsc yet. Cast to Href at the Link call site.
type LevelDef = {
  number: string;
  name: string;
  subtitle: string;
  href: string;
  status: LevelStatus;
};

const LEVELS: LevelDef[] = [
  {
    number: '01',
    name: 'Trajectory',
    subtitle: 'Projectile motion // Earth gravity',
    href: '/level-01',
    status: 'available',
  },
  {
    number: '02',
    name: 'Collisions',
    subtitle: 'Momentum // 1D elastic',
    href: '/level-02',
    status: 'available',
  },
  {
    number: '03',
    name: 'Inclined Plane',
    subtitle: "Friction // Newton's 2nd law",
    href: '/level-03',
    status: 'available',
  },
  {
    number: '04',
    name: 'Pendulum',
    subtitle: 'Periodic motion // SHM',
    href: '/level-04',
    status: 'available',
  },
  {
    number: '05',
    name: 'Springs',
    subtitle: "Hooke's law // oscillation",
    href: '/level-05',
    status: 'available',
  },
  {
    number: '06',
    name: 'Energy',
    subtitle: 'KE // PE // conservation',
    href: '/level-06',
    status: 'available',
  },
];

export default function LevelSelect() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>EXPERIMENT INDEX</Text>
        <Text style={styles.intro}>
          Each experiment isolates one concept of physics. Tune the variables to satisfy the
          mission profile.
        </Text>

        <View style={styles.list}>
          {LEVELS.map((level) => (
            <LevelTile key={level.number} level={level} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LevelTile({ level }: { level: LevelDef }) {
  if (level.status === 'locked') {
    return (
      <View style={[styles.tile, styles.tileLocked]}>
        <Text style={styles.tileNumber}>{level.number}</Text>
        <View style={styles.tileMeta}>
          <Text style={[styles.tileName, styles.tileNameLocked]}>{level.name}</Text>
          <Text style={styles.tileSubtitle}>LOCKED</Text>
        </View>
      </View>
    );
  }

  return (
    <Link href={level.href as Href} asChild>
      <Pressable style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
        <Text style={styles.tileNumber}>{level.number}</Text>
        <View style={styles.tileMeta}>
          <Text style={styles.tileName}>{level.name}</Text>
          <Text style={styles.tileSubtitle}>{level.subtitle}</Text>
        </View>
        <Text style={styles.tileChevron}></Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.four,
    gap: spacing.five,
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
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.four,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.four,
    paddingHorizontal: spacing.four,
  },
  tilePressed: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  tileLocked: { opacity: 0.5 },
  tileNumber: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: letterSpacing.label,
    minWidth: 36,
  },
  tileMeta: { flex: 1, gap: spacing.one },
  tileName: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: letterSpacing.label,
  },
  tileNameLocked: { color: colors.textDim },
  tileSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
  },
  tileChevron: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 18,
  },
});
