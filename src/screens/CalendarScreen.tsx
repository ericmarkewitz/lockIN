import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Segmented } from '@/components/ui';
import { getRangeSummary } from '@/data/workouts';
import type { CategoryKind, DaySummary, DayStatus } from '@/data/types';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { periodLabel, periodRange, shiftAnchor, type ViewMode, DAY_NAMES } from '@/lib/calendar';
import { monthGrid, parseDateKey, todayKey, weekDates } from '@/lib/dates';
import { useTheme, type Theme } from '@/theme';
import { WorkoutView } from './WorkoutView';

export const STATUS_LABEL: Record<DayStatus, string> = {
  none: '', rest: 'Rest', planned: 'Planned', partial: 'In progress', completed: 'Done', missed: 'Missed',
};
const KIND_LABEL: Record<CategoryKind, string> = { strength: 'Lifts', cardio: 'Cardio', mindbody: 'Yoga/Mobility' };

export function statusColor(s: DayStatus, t: Theme): string {
  switch (s) {
    case 'completed': return t.success;
    case 'partial': return t.warn;
    case 'planned': return t.primary;
    case 'rest': return t.rest;
    case 'missed': return t.danger;
    default: return t.border;
  }
}

export function CalendarScreen({ today = todayKey() }: { today?: string }) {
  const db = useDb();
  const t = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(today);
  const { from, to } = periodRange(anchor, mode);
  const { data, reload } = useLoad(() => getRangeSummary(db, from, to, today), [db, from, to, today]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const byDate = new Map<string, DaySummary>((data ?? []).map((d) => [d.date, d]));
  const open = (date: string) => router.push({ pathname: '/day/[date]', params: { date } });
  const pick = (date: string) => { setAnchor(date); setMode('day'); };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={[styles.h1, { color: t.text }]}>lockIN</Text>
        <View style={styles.topBtns}>
          <Button title="Plan" variant="secondary" onPress={() => router.push('/setup')} style={styles.small} />
          <Button title="Export" variant="secondary" onPress={() => router.push('/export')} style={styles.small} />
        </View>
      </View>
      <Segmented<ViewMode>
        options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
        value={mode}
        onChange={(m) => setMode(m)}
      />
      <View style={styles.navRow}>
        <Button title="‹" variant="secondary" label="Previous" onPress={() => setAnchor(shiftAnchor(anchor, mode, -1))} style={styles.small} />
        <Pressable accessibilityLabel="Go to today" onPress={() => setAnchor(today)}>
          <Text style={[styles.period, { color: t.text }]}>{periodLabel(anchor, mode)}</Text>
        </Pressable>
        <Button title="›" variant="secondary" label="Next" onPress={() => setAnchor(shiftAnchor(anchor, mode, 1))} style={styles.small} />
      </View>

      {mode === 'day' && <WorkoutView key={anchor} date={anchor} />}

      {mode === 'week' &&
        weekDates(anchor).map((date) => {
          const s = byDate.get(date);
          const d = parseDateKey(date);
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={`Open ${date}`}
              onPress={() => open(date)}
              style={[styles.weekRow, { backgroundColor: t.card, borderColor: date === today ? t.primary : t.border }]}
            >
              <View style={[styles.bar, { backgroundColor: statusColor(s?.status ?? 'none', t) }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700' }}>{DAY_NAMES[d.getDay()]} {d.getDate()}</Text>
                <Text style={{ color: t.muted }}>
                  {s && s.status !== 'none'
                    ? s.status === 'rest'
                      ? 'Rest day'
                      : `${s.kinds.map((k) => KIND_LABEL[k]).join(' + ')} · ${s.exerciseCount} exercise${s.exerciseCount === 1 ? '' : 's'}`
                    : 'Nothing planned'}
                </Text>
              </View>
              {s && s.status !== 'none' && <Text style={{ color: statusColor(s.status, t), fontWeight: '600' }}>{STATUS_LABEL[s.status]}</Text>}
            </Pressable>
          );
        })}

      {mode === 'month' && (
        <View>
          <View style={styles.gridRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
              <Text key={i} style={[styles.cell, { color: t.muted, textAlign: 'center' }]}>{l}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {monthGrid(parseDateKey(anchor).getFullYear(), parseDateKey(anchor).getMonth()).map((date, i) => {
              if (!date) return <View key={i} style={styles.cell} />;
              const s = byDate.get(date);
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`${date}${s && s.status !== 'none' ? ` ${STATUS_LABEL[s.status]}` : ''}`}
                  onPress={() => pick(date)}
                  style={[styles.cell, styles.day, { borderColor: date === today ? t.primary : 'transparent' }]}
                >
                  <Text style={{ color: t.text }}>{parseDateKey(date).getDate()}</Text>
                  <View style={[styles.dot, { backgroundColor: statusColor(s?.status ?? 'none', t), opacity: s && s.status !== 'none' ? 1 : 0 }]} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.legend}>
            {(['planned', 'completed', 'partial', 'missed', 'rest'] as DayStatus[]).map((st) => (
              <View key={st} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: statusColor(st, t) }]} />
                <Text style={{ color: t.muted, fontSize: 12 }}>{STATUS_LABEL[st]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBtns: { flexDirection: 'row', gap: 8 },
  h1: { fontSize: 28, fontWeight: '800' },
  small: { paddingVertical: 6, paddingHorizontal: 12 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  period: { fontSize: 17, fontWeight: '700' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  bar: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  gridRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1 },
  day: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 10, gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
