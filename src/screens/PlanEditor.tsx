import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { ExercisePicker } from '@/components/ExercisePicker';
import { getPlan, markPlanComplete, setPlanDay } from '@/data/plan';
import type { CategoryKind, Exercise } from '@/data/types';
import { refreshUntouchedWorkouts } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { DAY_NAMES } from '@/lib/calendar';
import { todayKey } from '@/lib/dates';
import { parseNumber } from '@/lib/numbers';
import { useTheme } from '@/theme';

type Draft = {
  exerciseId: number; name: string; kind: CategoryKind;
  sets: string; reps: string; duration: string; distance: string;
};
type DayDraft = { weekday: number; isRest: boolean; items: Draft[] };

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function PlanEditor({ onSaved }: { onSaved: () => void }) {
  const db = useDb();
  const t = useTheme();
  const [days, setDays] = useState<DayDraft[] | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlan(db).then((plan) =>
      setDays(
        ORDER.map((w) => {
          const d = plan.find((p) => p.weekday === w)!;
          return {
            weekday: w,
            isRest: d.isRest,
            items: d.items.map((i) => ({
              exerciseId: i.exerciseId, name: i.exerciseName, kind: i.categoryKind,
              sets: txt(i.targetSets), reps: txt(i.targetReps), duration: txt(i.targetDurationMin), distance: txt(i.targetDistance),
            })),
          };
        }),
      ),
    );
  }, [db]);

  if (!days) return null;

  const patchDay = (weekday: number, fn: (d: DayDraft) => DayDraft) =>
    setDays(days.map((d) => (d.weekday === weekday ? fn(d) : d)));
  const patchItem = (weekday: number, idx: number, p: Partial<Draft>) =>
    patchDay(weekday, (d) => ({ ...d, items: d.items.map((it, i) => (i === idx ? { ...it, ...p } : it)) }));

  const addExercise = (weekday: number, e: Exercise) => {
    patchDay(weekday, (d) => ({
      ...d,
      isRest: false,
      items: [...d.items, {
        exerciseId: e.id, name: e.name, kind: e.categoryKind,
        sets: e.categoryKind === 'strength' ? '3' : '', reps: e.categoryKind === 'strength' ? '10' : '', duration: '', distance: '',
      }],
    }));
    setPickerFor(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const d of days) {
        await setPlanDay(db, d.weekday, {
          isRest: d.isRest,
          items: d.items.map((i) => ({
            exerciseId: i.exerciseId,
            targetSets: i.kind === 'strength' ? parseNumber(i.sets) : null,
            targetReps: i.kind === 'strength' ? parseNumber(i.reps) : null,
            targetDurationMin: i.kind === 'strength' ? null : parseNumber(i.duration),
            targetDistance: i.kind === 'cardio' ? parseNumber(i.distance) : null,
          })),
        });
      }
      await markPlanComplete(db);
      await refreshUntouchedWorkouts(db, todayKey());
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.wrap} style={{ backgroundColor: t.bg }}>
        <Text style={{ color: t.muted }}>Pick the exercises for each day, or mark it as a rest day.</Text>
        {days.map((d) => (
          <Card key={d.weekday} style={{ gap: 8 }}>
            <View style={styles.dayHead}>
              <Text style={[styles.dayName, { color: t.text }]}>{DAY_NAMES[d.weekday]}</Text>
              <View style={styles.restRow}>
                <Text style={{ color: t.muted }}>Rest</Text>
                <Switch
                  accessibilityLabel={`${DAY_NAMES[d.weekday]} rest day`}
                  value={d.isRest}
                  onValueChange={(v) => patchDay(d.weekday, (x) => ({ ...x, isRest: v, items: v ? [] : x.items }))}
                />
              </View>
            </View>
            {!d.isRest && (
              <>
                {d.items.map((it, idx) => (
                  <View key={`${it.exerciseId}-${idx}`} style={styles.item}>
                    <Text style={[styles.itemName, { color: t.text }]}>{it.name}</Text>
                    {it.kind === 'strength' ? (
                      <>
                        <Num label={`${d.weekday} ${it.name} sets`} v={it.sets} suffix="sets" onChange={(sets) => patchItem(d.weekday, idx, { sets })} />
                        <Num label={`${d.weekday} ${it.name} reps`} v={it.reps} suffix="reps" onChange={(reps) => patchItem(d.weekday, idx, { reps })} />
                      </>
                    ) : (
                      <>
                        <Num label={`${d.weekday} ${it.name} minutes`} v={it.duration} suffix="min" onChange={(duration) => patchItem(d.weekday, idx, { duration })} />
                        {it.kind === 'cardio' && (
                          <Num label={`${d.weekday} ${it.name} distance`} v={it.distance} suffix="dist" onChange={(distance) => patchItem(d.weekday, idx, { distance })} />
                        )}
                      </>
                    )}
                    <Button
                      title="×" variant="secondary" label={`Remove ${it.name} from ${DAY_NAMES[d.weekday]}`}
                      onPress={() => patchDay(d.weekday, (x) => ({ ...x, items: x.items.filter((_, i) => i !== idx) }))}
                      style={{ paddingHorizontal: 10, paddingVertical: 4 }}
                    />
                  </View>
                ))}
                <Button title="+ Add exercise" variant="secondary" label={`Add exercise to ${DAY_NAMES[d.weekday]}`} onPress={() => setPickerFor(d.weekday)} />
              </>
            )}
          </Card>
        ))}
        <Button title="Save plan" onPress={save} disabled={saving} />
      </ScrollView>
      <ExercisePicker
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(e) => pickerFor !== null && addExercise(pickerFor, e)}
      />
    </>
  );
}

function Num({ label, v, suffix, onChange }: { label: string; v: string; suffix: string; onChange: (s: string) => void }) {
  const t = useTheme();
  return (
    <View style={styles.num}>
      <TextInput
        accessibilityLabel={label}
        value={v}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={[styles.numInput, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      />
      <Text style={{ color: t.muted, fontSize: 12 }}>{suffix}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontSize: 18, fontWeight: '700' },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName: { flex: 1, fontSize: 15 },
  num: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  numInput: { width: 46, borderWidth: 1, borderRadius: 8, paddingVertical: 6, textAlign: 'center' },
});
