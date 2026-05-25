/**
 * A single labeled row inside an equation panel: `symbol = value unit`.
 * Used to display kinematic / dynamic variables consistently across levels.
 *
 *   <EqRow symbol="v" value="25.0" unit="m/s" />
 *   <EqRow symbol="R" value="63.7" unit="m" emphasis />   // bigger, brighter
 *   <EqRow symbol="g" value="9.81" unit="m/s²" muted />   // dimmer, signals constant
 */
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, letterSpacing } from '@/ui/theme';

export function EqRow({
  symbol,
  value,
  unit,
  emphasis,
  muted,
}: {
  symbol: string;
  value: string;
  unit: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.symbol, emphasis && styles.symbolEmphasis, muted && styles.muted]}>
        {symbol}
      </Text>
      <Text style={[styles.equals, muted && styles.muted]}>=</Text>
      <Text
        style={[styles.valueText, emphasis && styles.valueTextEmphasis, muted && styles.muted]}
      >
        {value}
      </Text>
      <Text style={[styles.unit, muted && styles.muted]}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  symbol: {
    color: colors.primary,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    width: 18,
  },
  symbolEmphasis: {
    color: colors.primaryLight,
    fontSize: 16,
  },
  equals: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 13,
  },
  valueText: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 56,
  },
  valueTextEmphasis: {
    color: colors.primaryLight,
    fontSize: 18,
    fontWeight: '700',
  },
  unit: {
    color: colors.textSecondary,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: letterSpacing.hud,
  },
  muted: {
    opacity: 0.55,
  },
});
