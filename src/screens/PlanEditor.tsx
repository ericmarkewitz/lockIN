import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Button, Card } from '@/components/ui';
import { DragHandle } from '@/components/DragHandle';
import { ExercisePicker } from '@/components/ExercisePicker';
import { getPlan, markPlanComplete, setPlanDay } from '@/data/plan';
import type { CategoryKind, Exercise } from '@/data/types';
import { refreshUntouchedWorkouts } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { DAY_NAMES } from '@/lib/calendar';
import { todayKey } from '@/lib/dates';
import { parseNumber } from '@/lib/numbers';
import { dropIndex, moveItem } from '@/lib/reorder';
import { useTheme } from '@/theme';

type Draft = {
  key: string; exerciseId: number; name: string; kind: CategoryKind;
  sets: string; reps: string; duration: string; distance: string;
};
type DayDraft = { weekday: number; isRest: boolean; items: Draft[] };

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const ROW_GAP = 8; // Card gap between rows; part of the drag pitch
const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function PlanEditor({ onSaved }: { onSaved: () => void }) {
  const db = useDb();
  const t = useTheme();
  const [days, setDays] = useState<DayDraft[] | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<{ weekday: number; from: number; over: number; pitch: number } | null>(null);
  const dragRef = useRef(drag);
  const [dragY] = useState(() => new Animated.Value(0));
  const rowHeights = useRef(new Map<string, number>());
  const nextKey = useRef(0);
  const newKey = () => `row-${nextKey.current++}`;

  useEffect(() => {
    getPlan(db).then((plan) =>
      setDays(
        ORDER.map((w) => {
          const d = plan.find((p) => p.weekday === w)!;
          return {
            weekday: w,
            isRest: d.isRest,
            items: d.items.map((i) => ({
              key: newKey(), exerciseId: i.exerciseId, name: i.exerciseName, kind: i.categoryKind,
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

  const reorder = (weekday: number, from: number, to: number) =>
    patchDay(weekday, (d) => ({ ...d, items: moveItem(d.items, from, to) }));

  const setDragState = (next: typeof drag) => {
    dragRef.current = next;
    setDrag(next);
  };
  const startDrag = (weekday: number, from: number, key: string) => {
    dragY.setValue(0);
    setDragState({ weekday, from, over: from, pitch: (rowHeights.current.get(key) ?? 0) + ROW_GAP });
  };
  const moveDrag = (d: DayDraft, dy: number) => {
    const cur = dragRef.current;
    if (!cur) return;
    dragY.setValue(dy);
    const over = dropIndex(cur.from, dy, cur.pitch, d.items.length);
    if (over !== cur.over) setDragState({ ...cur, over });
  };
  const endDrag = (d: DayDraft, dy: number) => {
    const cur = dragRef.current;
    if (!cur) return;
    reorder(d.weekday, cur.from, dropIndex(cur.from, dy, cur.pitch, d.items.length));
    cancelDrag();
  };
  const cancelDrag = () => {
    dragY.setValue(0);
    setDragState(null);
  };
  /** Rows between the dragged row and its drop slot slide one pitch out of the way. */
  const rowShift = (weekday: number, idx: number) => {
    if (!drag || drag.weekday !== weekday || idx === drag.from) return 0;
    const { pitch } = drag;
    if (drag.from < drag.over && idx > drag.from && idx <= drag.over) return -pitch;
    if (drag.from > drag.over && idx < drag.from && idx >= drag.over) return pitch;
    return 0;
  };

  const addExercise = (weekday: number, e: Exercise) => {
    patchDay(weekday, (d) => ({
      ...d,
      isRest: false,
      items: [...d.items, {
        key: newKey(), exerciseId: e.id, name: e.name, kind: e.categoryKind,
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
      <ScrollView scrollEnabled={!drag} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.wrap} style={{ backgroundColor: t.bg }}>
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
                  <Animated.View
                    key={it.key}
                    onLayout={(e) => rowHeights.current.set(it.key, e.nativeEvent.layout.height)}
                    style={[
                      styles.item,
                      drag?.weekday === d.weekday && drag.from === idx
                        ? [styles.dragging, { backgroundColor: t.card, transform: [{ translateY: dragY }] }]
                        : { transform: [{ translateY: rowShift(d.weekday, idx) }] },
                    ]}
                  >
                    <DragHandle
                      label={`Reorder ${it.name} on ${DAY_NAMES[d.weekday]}`}
                      onStart={() => startDrag(d.weekday, idx, it.key)}
                      onMove={(dy) => moveDrag(d, dy)}
                      onEnd={(dy) => endDrag(d, dy)}
                      onCancel={cancelDrag}
                      onMoveUp={() => reorder(d.weekday, idx, idx - 1)}
                      onMoveDown={() => reorder(d.weekday, idx, idx + 1)}
                    />
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
                  </Animated.View>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52 },
  dragging: { zIndex: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  itemName: { flex: 1, fontSize: 15 },
  num: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  numInput: { width: 46, borderWidth: 1, borderRadius: 8, paddingVertical: 6, textAlign: 'center' },
});
