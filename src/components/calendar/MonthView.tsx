import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DaySummary, DayStatus } from '@/data/types';
import { monthGrid, parseDateKey } from '@/lib/dates';
import { tint, useTheme, type Theme } from '@/theme';
import { KindIcon } from './KindIcon';
import { STATUS_LABEL, statusColor } from './status';

/** Splits the month's cells into Monday-first week rows. */
const weeks = <T,>(cells: T[]): T[][] =>
  Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

/** How strongly each status tints its day tile. */
const FILL: Partial<Record<DayStatus, number>> = { completed: 0.2, partial: 0.18, missed: 0.12, planned: 0.08 };

function Icons({ s, color }: { s: DaySummary | undefined; color: string }) {
  if (s?.status === 'rest') return <KindIcon kind="rest" color={color} />;
  if (!s?.kinds.length) return null;
  const size = s.kinds.length > 1 ? 13 : 17;
  return (
    <View style={styles.icons}>
      {s.kinds.slice(0, 3).map((k) => <KindIcon key={k} kind={k} size={size} color={color} />)}
    </View>
  );
}

const fillFor = (status: DayStatus, t: Theme) => (FILL[status] ? tint(statusColor(status, t), FILL[status]) : undefined);

const LEGEND: DayStatus[] = ['planned', 'completed', 'partial', 'missed', 'rest'];

export function MonthView({ anchor, byDate, today, onPick }: {
  anchor: string; byDate: Map<string, DaySummary>; today: string; onPick: (date: string) => void;
}) {
  const t = useTheme();
  const a = parseDateKey(anchor);
  return (
    <View testID="month-view" style={[styles.wrap, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.gridRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          <Text key={i} style={[styles.head, { color: t.muted }]}>{l}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {weeks(monthGrid(a.getFullYear(), a.getMonth())).map((week, w) => (
          <View key={w} testID="month-week" style={styles.week}>
            {week.map((date, i) => {
              if (!date) return <View key={i} style={styles.cell} />;
              const s = byDate.get(date);
              const status = s?.status ?? 'none';
              const has = status !== 'none';
              const isToday = date === today;
              const c = statusColor(status, t);
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`${date}${has ? ` ${STATUS_LABEL[status]}` : ''}`}
                  onPress={() => onPick(date)}
                  style={({ pressed }) => [
                    styles.cell,
                    styles.tile,
                    { backgroundColor: fillFor(status, t) },
                    isToday && { borderColor: t.primary },
                    pressed && { opacity: 0.5 },
                  ]}
                >
                  <View style={[styles.day, isToday && { backgroundColor: t.primary }]}>
                    <Text style={{ color: isToday ? t.onPrimary : t.text, fontWeight: isToday || has ? '700' : '400' }}>
                      {parseDateKey(date).getDate()}
                    </Text>
                  </View>
                  <Icons s={s} color={c} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        {LEGEND.map((st) => (
          <View key={st} style={[styles.legendItem, { backgroundColor: tint(statusColor(st, t), 0.12) }]}>
            <View style={[styles.swatch, { backgroundColor: statusColor(st, t) }]} />
            <Text style={{ color: t.text, fontSize: 12, fontWeight: '600' }}>{STATUS_LABEL[st]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 8 },
  gridRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  head: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  grid: { flex: 1, gap: 4 },
  week: { flex: 1, flexDirection: 'row', gap: 4 },
  cell: { flex: 1 },
  tile: { alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  day: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  icons: { flexDirection: 'row', gap: 1 },
  swatch: { width: 8, height: 8, borderRadius: 2.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
});
