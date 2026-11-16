import { StyleSheet, Text, View } from 'react-native';

import { TrendChart } from '@/components/charts/TrendChart';
import { Card, Eyebrow } from '@/components/ui';
import type { ExerciseSession } from '@/data/history';
import type { WeightUnit } from '@/data/settings';
import type { TrendPoint } from '@/data/stats';
import { parseDateKey } from '@/lib/dates';
import { toDisplayWeight } from '@/lib/units';
import { useTheme } from '@/theme';

/** How many recent sessions an exercise's own page charts. */
const RECENT_SESSIONS = 12;

const shortDate = (date: string) => parseDateKey(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The last few sessions' estimated 1RM, oldest first, from history that comes newest first. */
export function recentTrend(sessions: ExerciseSession[]): TrendPoint[] {
  return sessions
    .filter((s) => s.estimatedOneRepMax !== null)
    .slice(0, RECENT_SESSIONS)
    .reverse()
    .map((s) => ({ date: s.date, oneRepMax: s.estimatedOneRepMax! }));
}

/**
 * A lift's estimated 1RM over `points` (stored lb, oldest first). With fewer than two points there is
 * no line to draw: it shows `emptyText`, or nothing.
 */
export function LiftProgress({
  name, points: stored, unit, emptyText,
}: { name: string; points: TrendPoint[]; unit: WeightUnit; emptyText?: string }) {
  const t = useTheme();
  if (stored.length < 2) return emptyText ? <Text style={{ color: t.muted }}>{emptyText}</Text> : null;
  const points = stored.map((p) => ({ key: p.date, value: toDisplayWeight(p.oneRepMax, unit)! }));
  const first = points[0];
  const last = points[points.length - 1];
  const best = Math.max(...points.map((p) => p.value));
  const delta = round1(last.value - first.value);
  const deltaText = `${delta > 0 ? '+' : ''}${delta} ${unit} since ${shortDate(first.key)}`;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ gap: 2 }}>
          <Eyebrow>Est. 1RM</Eyebrow>
          <Text style={[styles.big, { color: t.text }]}>{last.value} <Text style={[styles.unit, { color: t.muted }]}>{unit}</Text></Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.delta, { color: delta > 0 ? t.success : t.muted }]}>{deltaText}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>Best {best} {unit}</Text>
        </View>
      </View>
      <TrendChart
        points={points}
        label={`${name} estimated 1RM, ${points.length} sessions, from ${first.value} to ${last.value} ${unit}`}
      />
      <View style={styles.dates}>
        <Text style={[styles.date, { color: t.muted }]}>{shortDate(first.key)}</Text>
        <Text style={[styles.date, { color: t.muted }]}>{shortDate(last.key)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  big: { fontSize: 30, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, fontWeight: '700' },
  right: { alignItems: 'flex-end', gap: 2 },
  delta: { fontSize: 14, fontWeight: '800' },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { fontSize: 11, fontWeight: '700' },
});
