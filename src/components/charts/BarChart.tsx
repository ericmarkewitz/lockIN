import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { tint, useTheme } from '@/theme';

export type Bar = { key: string; label: string; value: number; valueLabel: string };

/** Most labels that fit under the bars on a phone; past that, only every other (or third...) bar is labelled. */
const MAX_LABELS = 7;

/**
 * Columns scaled to the tallest bar; the last one (the current period) is drawn in full accent.
 * Labels are thinned counting back from the last bar, so the current period is always labelled.
 */
export function BarChart({ bars, height = 120 }: { bars: Bar[]; height?: number }) {
  const t = useTheme();
  const max = Math.max(0, ...bars.map((b) => b.value));
  const step = Math.ceil(bars.length / MAX_LABELS);
  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { height }]}>
        {bars.map((b, i) => {
          const pct = max > 0 ? Math.round((b.value / max) * 100) : 0;
          const height: DimensionValue = `${b.value > 0 ? Math.max(pct, 3) : 0}%`;
          return (
            <View key={b.key} style={styles.col}>
              <View
                accessible
                accessibilityLabel={`${b.label}: ${b.valueLabel}`}
                style={[styles.bar, { height, backgroundColor: i === bars.length - 1 ? t.primary : tint(t.primary, 0.35) }]}
              />
            </View>
          );
        })}
      </View>
      <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
        {bars.map((b, i) => (
          <Text key={b.key} numberOfLines={1} style={[styles.label, { color: t.muted }]}>
            {(bars.length - 1 - i) % step === 0 ? b.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  col: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 6 },
  label: { flex: 1, fontSize: 10, fontWeight: '700', textAlign: 'center', paddingTop: 4, marginHorizontal: -12 },
});
