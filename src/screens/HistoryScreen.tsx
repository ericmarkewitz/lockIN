import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Eyebrow, Segmented } from '@/components/ui';
import {
  getExerciseHistory, listLoggedExercises, listLoggedWorkouts, type ExerciseSession, type LoggedExercise,
} from '@/data/history';
import { getUnits, type Units } from '@/data/settings';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { DAY_NAMES } from '@/lib/calendar';
import { parseDateKey } from '@/lib/dates';
import { formatDistance, toDisplayWeight } from '@/lib/units';
import { formatDuration } from '@/lib/duration';
import { tint, useTheme } from '@/theme';
import { KindIcon } from '@/components/calendar/KindIcon';
import { LiftProgress, recentTrend } from '@/components/history/LiftProgress';
import { StatsPanel } from '@/components/history/StatsPanel';

type Tab = 'stats' | 'workouts' | 'exercises';

const dayLabel = (date: string) => `${DAY_NAMES[parseDateKey(date).getDay()].slice(0, 3)} ${date}`;

function sessionSummary(s: ExerciseSession, units: Units, kind: LoggedExercise['kind']): string {
  const unit = units.weight;
  const parts: string[] = [];
  if (s.best) parts.push(`Best ${toDisplayWeight(s.best.weight, unit)} ${unit} × ${s.best.reps}`);
  if (s.estimatedOneRepMax !== null) parts.push(`Est. 1RM ${toDisplayWeight(s.estimatedOneRepMax, unit)} ${unit}`);
  if (s.durationMin !== null) parts.push(formatDuration(s.durationMin));
  if (s.distance !== null) parts.push(formatDistance(s.distance, units.distance));
  if (parts.length) return parts.join(' · ');
  return kind === 'strength' ? `${s.setCount} set${s.setCount === 1 ? '' : 's'}` : 'Done';
}

/** The month and day of a logged workout in an accent-tinted tile. */
function DateBlock({ date }: { date: string }) {
  const t = useTheme();
  const d = parseDateKey(date);
  return (
    <View style={[styles.dateBlock, { backgroundColor: tint(t.primary, 0.1) }]}>
      <Eyebrow color={t.primary} style={styles.dateMonth}>{d.toLocaleString('en-US', { month: 'short' })}</Eyebrow>
      <Text style={[styles.dateDay, { color: t.primary }]}>{d.getDate()}</Text>
    </View>
  );
}

export function HistoryScreen() {
  const db = useDb();
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stats');
  const [exercise, setExercise] = useState<LoggedExercise | null>(null);

  const workouts = useLoad(() => listLoggedWorkouts(db), [db]);
  const exercises = useLoad(() => listLoggedExercises(db), [db]);
  const sessions = useLoad(
    async () => (exercise ? getExerciseHistory(db, exercise.id) : []),
    [db, exercise?.id],
  );
  const units = useLoad(() => getUnits(db), [db]).data ?? { weight: 'lb', distance: 'mi' };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <Segmented<Tab>
        options={[{ value: 'stats', label: 'Stats' }, { value: 'workouts', label: 'Workouts' }, { value: 'exercises', label: 'Exercises' }]}
        value={tab}
        onChange={(v) => { setTab(v); setExercise(null); }}
      />

      {tab === 'stats' && <StatsPanel unit={units.weight} />}

      {tab === 'workouts' && workouts.data && (
        workouts.data.length ? workouts.data.map((w) => (
          <Pressable
            key={w.date}
            accessibilityRole="button"
            accessibilityLabel={`Open ${w.date}`}
            onPress={() => router.push({ pathname: '/day/[date]', params: { date: w.date } })}
          >
            <Card style={styles.row}>
              <DateBlock date={w.date} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: t.text }]}>{dayLabel(w.date)}</Text>
                <Text style={{ color: t.muted }} numberOfLines={2}>{w.exerciseNames.join(', ')}</Text>
                {w.setCount > 0 && <Text style={[styles.meta, { color: t.primary }]}>{w.setCount} set{w.setCount === 1 ? '' : 's'} logged</Text>}
              </View>
              <Text style={[styles.chev, { color: t.muted }]}>›</Text>
            </Card>
          </Pressable>
        )) : <Text style={{ color: t.muted }}>No logged workouts yet.</Text>
      )}

      {tab === 'exercises' && !exercise && exercises.data && (
        exercises.data.length ? exercises.data.map((e) => (
          <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.name} history`} onPress={() => setExercise(e)}>
            <Card style={styles.row}>
              <View style={[styles.thumb, { backgroundColor: tint(t.primary, 0.1) }]}>
                <KindIcon kind={e.kind} size={22} color={t.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: t.text }]}>{e.name}</Text>
                <Text style={{ color: t.muted }}>{e.sessions} session{e.sessions === 1 ? '' : 's'} · last {e.lastDate}</Text>
              </View>
              <Text style={[styles.chev, { color: t.muted }]}>›</Text>
            </Card>
          </Pressable>
        )) : <Text style={{ color: t.muted }}>No logged exercises yet.</Text>
      )}

      {tab === 'exercises' && exercise && (
        <View style={{ gap: 12 }}>
          <Button title="‹ Exercises" label="Back to exercises" variant="secondary" onPress={() => setExercise(null)} style={styles.back} />
          <Text style={[styles.h2, { color: t.text }]}>{exercise.name}</Text>
          {exercise.kind === 'strength' && sessions.data && (
            <LiftProgress name={exercise.name} points={recentTrend(sessions.data)} unit={units.weight} />
          )}
          {(sessions.data ?? []).map((s) => (
            <Card key={s.date} style={styles.row}>
              <DateBlock date={s.date} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: t.text }]}>{s.date}</Text>
                <Text style={{ color: t.muted }}>{sessionSummary(s, units, exercise.kind)}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  h2: { fontSize: 26, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  meta: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  chev: { fontSize: 24, fontWeight: '600' },
  thumb: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dateBlock: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontSize: 10, letterSpacing: 1 },
  dateDay: { fontSize: 22, fontWeight: '900', lineHeight: 24, fontVariant: ['tabular-nums'] },
  back: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12 },
});
