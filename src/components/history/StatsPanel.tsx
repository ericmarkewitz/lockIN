import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { Card, Eyebrow, Segmented, SectionTitle, tapFeedback } from '@/components/ui';
import { getStatsRange, setStatsRange, type StatsRange, type WeightUnit } from '@/data/settings';
import { getLiftTrend, getLifetimeStats, getVolumeSeries, listTrackedLifts, type VolumeSeries } from '@/data/stats';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { parseDateKey } from '@/lib/dates';
import { formatCompact } from '@/lib/numbers';
import { toDisplayWeight } from '@/lib/units';
import { tint, useTheme } from '@/theme';
import { LiftProgress } from './LiftProgress';

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: '1m', label: '1M' }, { value: '3m', label: '3M' }, { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' }, { value: 'all', label: 'All' },
];

/** "10/26" for a week; "Jun" for a month, or "Jun ’25" once the bars span more than a year. */
function barLabel(start: string, series: VolumeSeries): string {
  const d = parseDateKey(start);
  if (series.bucket === 'week') return `${d.getMonth() + 1}/${d.getDate()}`;
  const month = d.toLocaleString('en-US', { month: 'short' });
  return series.bars.length > 12 ? `${month} ’${String(d.getFullYear()).slice(2)}` : month;
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const t = useTheme();
  return (
    <Card style={styles.stat}>
      <View accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`} style={{ gap: 4 }}>
        <Eyebrow>{label}</Eyebrow>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: t.text }]}>
          {value}{unit && <Text style={[styles.statUnit, { color: t.muted }]}> {unit}</Text>}
        </Text>
      </View>
    </Card>
  );
}

/**
 * Lifetime totals, then volume and per-lift progress over a range the user picks (and that is remembered).
 * The range only changes the charts; the totals are always all time.
 */
export function StatsPanel({ unit }: { unit: WeightUnit }) {
  const db = useDb();
  const t = useTheme();
  const stats = useLoad(() => getLifetimeStats(db), [db]).data;
  const savedRange = useLoad(() => getStatsRange(db), [db]).data;
  const [chosenRange, setChosenRange] = useState<StatsRange | null>(null);
  const range = chosenRange ?? savedRange;
  const volume = useLoad(async () => (range ? getVolumeSeries(db, { range }) : null), [db, range]).data;
  const lifts = useLoad(() => listTrackedLifts(db), [db]).data;
  const [picked, setPicked] = useState<number | null>(null);
  const lift = lifts?.find((l) => l.id === picked) ?? lifts?.[0];
  const trend = useLoad(
    async () => (lift && range ? getLiftTrend(db, lift.id, { range }) : null),
    [db, lift?.id, range],
  ).data;

  const pickRange = (r: StatsRange) => {
    setChosenRange(r);
    setStatsRange(db, r).catch(() => {});
  };

  const weight = (lb: number) => formatCompact(toDisplayWeight(lb, unit) ?? 0);

  return (
    <View style={{ gap: 12 }}>
      {stats && (
        <View style={styles.grid}>
          <Eyebrow style={styles.fullRow}>All time</Eyebrow>
          <Stat label="Total volume" value={weight(stats.volume)} unit={unit} />
          <Stat label="Sets" value={formatCompact(stats.sets)} />
          <Stat label="Workouts" value={formatCompact(stats.workouts)} />
          <Stat label="Unique exercises" value={formatCompact(stats.exercises)} />
        </View>
      )}

      {range && <View style={styles.range}><Segmented options={RANGE_OPTIONS} value={range} onChange={pickRange} /></View>}

      {volume && (
        <Card style={{ gap: 12 }}>
          <View style={styles.cardHead}>
            <Eyebrow>Volume</Eyebrow>
            <Text style={{ color: t.muted, fontSize: 13 }}>{volume.bucket === 'week' ? 'Per week' : 'Per month'}</Text>
          </View>
          <BarChart
            bars={volume.bars.map((b) => ({
              key: b.start,
              label: barLabel(b.start, volume),
              value: b.volume,
              valueLabel: `${weight(b.volume)} ${unit}`,
            }))}
          />
        </Card>
      )}

      <SectionTitle title="Lift progress" />
      {lifts && (lifts.length === 0 ? (
        <Text style={{ color: t.muted }}>Log a lift on two different days to see its progress.</Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {lifts.map((l) => {
              const on = l.id === lift?.id;
              return (
                <Pressable
                  key={l.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Chart ${l.name}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => { tapFeedback(); setPicked(l.id); }}
                  style={[styles.chip, { backgroundColor: on ? t.text : tint(t.primary, 0.08) }]}
                >
                  <Text style={[styles.chipText, { color: on ? t.bg : t.text }]}>{l.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {lift && trend && (
            <LiftProgress name={lift.name} points={trend} unit={unit} emptyText={`Not enough ${lift.name} sessions in this range.`} />
          )}
        </>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fullRow: { width: '100%', marginBottom: -4 },
  range: { marginTop: 8 },
  stat: { flexBasis: '45%', flexGrow: 1, paddingVertical: 14 },
  statValue: { fontSize: 28, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 15, fontWeight: '700', letterSpacing: 0 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: '800' },
});
