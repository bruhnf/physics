/**
 * Compact horizontal strip showing the player's progress through a level's goals.
 * Each tile shows the goal number, with done / current / future visual states.
 *
 *   <GoalTileStrip total={10} currentIndex={3} levelComplete={false} />
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, letterSpacing, radii } from '@/ui/theme';

export function GoalTileStrip({
  total,
  currentIndex,
  levelComplete,
}: {
  total: number;
  currentIndex: number;
  levelComplete: boolean;
}) {
  return (
    <View style={styles.strip}>
      {Array.from({ length: total }).map((_, i) => {
        const state =
          i < currentIndex || (i === currentIndex && levelComplete)
            ? 'done'
            : i === currentIndex
              ? 'current'
              : 'future';
        return <GoalTile key={i} n={i + 1} state={state} />;
      })}
    </View>
  );
}

function GoalTile({ n, state }: { n: number; state: 'done' | 'current' | 'future' }) {
  const tileStyle = [
    styles.tile,
    state === 'done'
      ? styles.tileDone
      : state === 'current'
        ? styles.tileCurrent
        : styles.tileFuture,
  ];
  const textColor =
    state === 'done' ? colors.success : state === 'current' ? colors.primary : colors.textDim;
  return (
    <View style={tileStyle}>
      <Text style={[styles.tileText, { color: textColor }]}>
        {state === 'done' ? '✓' : n.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 'auto',
    paddingTop: 8,
  },
  tile: {
    flex: 1,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDone: { borderColor: colors.success, backgroundColor: 'transparent' },
  tileCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tileFuture: { borderColor: colors.border, backgroundColor: 'transparent' },
  tileText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
    fontWeight: '600',
  },
});
