import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Segmented } from '@/components/ui';
import {
  getExerciseHistory, listLoggedExercises, listLoggedWorkouts, type ExerciseSession, type LoggedExercise,
} from '@/data/history';
import { getWeightUnit, type WeightUnit } from '@/data/settings';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { DAY_NAMES } from '@/lib/calendar';
import { parseDateKey } from '@/lib/dates';
import { toDisplayWeight } from '@/lib/units';
import { formatDuration } from '@/lib/duration';
import { useTheme } from '@/theme';

type Tab = 'workouts' | 'exercises';

const dayLabel = (date: string) => `${DAY_NAMES[parseDateKey(date).getDay()].slice(0, 3)} ${date}`;

function sessionSummary(s: ExerciseSession, unit: WeightUnit): string {
  const parts: string[] = [];
  if (s.best) parts.push(`Best ${toDisplayWeight(s.best.weight, unit)} ${unit} × ${s.best.reps}`);
  if (s.estimatedOneRepMax !== null) parts.push(`Est. 1RM ${toDisplayWeight(s.estimatedOneRepMax, unit)} ${unit}`);
  if (s.durationMin !== null) parts.push(formatDuration(s.durationMin));
  if (s.distance !== null) parts.push(`${s.distance} distance`);
  return parts.length ? parts.join(' · ') : `${s.setCount} set${s.setCount === 1 ? '' : 's'}`;
}

export function HistoryScreen() {
  const db = useDb();
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('workouts');
  const [exercise, setExercise] = useState<LoggedExercise | null>(null);

  const workouts = useLoad(() => listLoggedWorkouts(db), [db]);
  const exercises = useLoad(() => listLoggedExercises(db), [db]);
  const sessions = useLoad(
    async () => (exercise ? getExerciseHistory(db, exercise.id) : []),
    [db, exercise?.id],
  );
  const unit = useLoad(() => getWeightUnit(db), [db]).data ?? 'lb';

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.bg }} contentContainerStyle={styles.wrap}>
      <Segmented<Tab>
        options={[{ value: 'workouts', label: 'Workouts' }, { value: 'exercises', label: 'Exercises' }]}
        value={tab}
        onChange={(v) => { setTab(v); setExercise(null); }}
      />

      {tab === 'workouts' && workouts.data && (
        workouts.data.length ? workouts.data.map((w) => (
          <Pressable
            key={w.date}
            accessibilityRole="button"
            accessibilityLabel={`Open ${w.date}`}
            onPress={() => router.push({ pathname: '/day/[date]', params: { date: w.date } })}
          >
            <Card style={{ gap: 2 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{dayLabel(w.date)}</Text>
              <Text style={{ color: t.muted }}>{w.exerciseNames.join(', ')}</Text>
              <Text style={{ color: t.muted }}>{w.setCount} set{w.setCount === 1 ? '' : 's'} logged</Text>
            </Card>
          </Pressable>
        )) : <Text style={{ color: t.muted }}>No logged workouts yet.</Text>
      )}

      {tab === 'exercises' && !exercise && exercises.data && (
        exercises.data.length ? exercises.data.map((e) => (
          <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.name} history`} onPress={() => setExercise(e)}>
            <Card style={{ gap: 2 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{e.name}</Text>
              <Text style={{ color: t.muted }}>{e.sessions} session{e.sessions === 1 ? '' : 's'} · last {e.lastDate}</Text>
            </Card>
          </Pressable>
        )) : <Text style={{ color: t.muted }}>No logged exercises yet.</Text>
      )}

      {tab === 'exercises' && exercise && (
        <View style={{ gap: 12 }}>
          <Button title="‹ Exercises" label="Back to exercises" variant="secondary" onPress={() => setExercise(null)} style={styles.back} />
          <Text style={[styles.h2, { color: t.text }]}>{exercise.name}</Text>
          {(sessions.data ?? []).map((s) => (
            <Card key={s.date} style={{ gap: 2 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{s.date}</Text>
              <Text style={{ color: t.muted }}>{sessionSummary(s, unit)}</Text>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  h2: { fontSize: 20, fontWeight: '800' },
  back: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12 },
});
