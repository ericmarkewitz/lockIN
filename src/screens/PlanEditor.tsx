import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddButton, Button } from '@/components/ui';
import { Icon, sym } from '@/components/Icon';
import { ExerciseMotionFor } from '@/components/motion/ExerciseMotion';
import { DragHandle } from '@/components/DragHandle';
import { ExercisePicker } from '@/components/ExercisePicker';
import { KeyboardAvoider, keyboardScrollProps } from '@/components/KeyboardAvoider';
import { DurationButton } from '@/components/DurationButton';
import { WheelButton } from '@/components/WheelSheet';
import { getPlan, markPlanComplete, setPlanDay } from '@/data/plan';
import type { CategoryKind, Exercise } from '@/data/types';
import { refreshUntouchedWorkouts } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { DAY_NAMES } from '@/lib/calendar';
import { todayKey } from '@/lib/dates';
import { parseNumber } from '@/lib/numbers';
import { dropIndex, moveItem } from '@/lib/reorder';
import { MAX_REPS, MAX_SETS, wheelOptions } from '@/lib/wheel';
import { tint, useTheme } from '@/theme';

type Draft = {
  key: string; exerciseId: number; name: string; kind: CategoryKind; isCustom: boolean;
  sets: string; reps: string; duration: string; distance: string;
};
type DayDraft = { weekday: number; isRest: boolean; items: Draft[] };

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const ROW_GAP = 8; // Card gap between rows; part of the drag pitch
/** One line under a day's name: how much is planned for it. */
const summarize = (d: DayDraft) =>
  d.isRest ? 'Rest day' : d.items.length ? `${d.items.length} exercise${d.items.length === 1 ? '' : 's'}` : 'Nothing planned';
const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** `onCancel` shows a Cancel button; omit it when there is nowhere to go back to (first run). */
export function PlanEditor({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
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
              key: newKey(), exerciseId: i.exerciseId, name: i.exerciseName, kind: i.categoryKind, isCustom: i.isCustom,
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
        key: newKey(), exerciseId: e.id, name: e.name, kind: e.categoryKind, isCustom: e.isCustom,
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
    <KeyboardAvoider>
      <ScrollView testID="plan-scroll" {...keyboardScrollProps} scrollEnabled={!drag} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.wrap} style={{ backgroundColor: t.bg }}>
        <Text style={[styles.intro, { color: t.muted }]}>Pick the exercises for each day, or mark it as a rest day.</Text>
        {days.map((d) => (
          <View
            key={d.weekday}
            testID={`plan-day-${d.weekday}`}
            style={[
              styles.day,
              { backgroundColor: d.isRest ? tint(t.rest, 0.07) : t.card, borderColor: d.isRest ? tint(t.rest, 0.3) : t.border },
            ]}
          >
            <View style={styles.dayHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dayName, { color: t.text }]}>{DAY_NAMES[d.weekday]}</Text>
                <View style={styles.summaryRow}>
                  {d.isRest && <Icon name={sym('moon.zzz.fill', 'bedtime')} size={12} color={t.rest} fallback="☾" />}
                  <Text style={[styles.summary, { color: d.isRest ? t.rest : t.muted }]}>{summarize(d)}</Text>
                </View>
              </View>
              <Text style={[styles.restLabel, { color: t.muted }]}>Rest</Text>
              <Switch
                accessibilityLabel={`${DAY_NAMES[d.weekday]} rest day`}
                value={d.isRest}
                onValueChange={(v) => patchDay(d.weekday, (x) => ({ ...x, isRest: v, items: v ? [] : x.items }))}
              />
            </View>
            {!d.isRest && (
              <>
                {d.items.map((it, idx) => (
                  <Animated.View
                    key={it.key}
                    onLayout={(e) => rowHeights.current.set(it.key, e.nativeEvent.layout.height)}
                    style={[
                      styles.item,
                      { backgroundColor: t.bg },
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
                    <View style={styles.thumb}>
                      {it.isCustom
                        ? <Text style={[styles.thumbInitial, { color: t.primary }]}>{it.name.trim().charAt(0).toUpperCase()}</Text>
                        : <ExerciseMotionFor name={it.name} isCustom={it.isCustom} size={34} />}
                    </View>
                    <Text numberOfLines={2} style={[styles.itemName, { color: t.text }]}>{it.name}</Text>
                    {it.kind === 'strength' ? (
                      <TargetsField
                        label={`${d.weekday} ${it.name} sets and reps`}
                        title={it.name}
                        sets={it.sets}
                        reps={it.reps}
                        onChange={(sets, reps) => patchItem(d.weekday, idx, { sets, reps })}
                      />
                    ) : (
                      <>
                        <DurationButton
                          label={`${d.weekday} ${it.name} minutes`}
                          title={it.name}
                          value={parseNumber(it.duration)}
                          onChange={(minutes) => patchItem(d.weekday, idx, { duration: txt(minutes) })}
                          style={styles.duration}
                        />
                        {it.kind === 'cardio' && (
                          <Num label={`${d.weekday} ${it.name} distance`} v={it.distance} suffix="dist" onChange={(distance) => patchItem(d.weekday, idx, { distance })} />
                        )}
                      </>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${it.name} from ${DAY_NAMES[d.weekday]}`}
                      onPress={() => patchDay(d.weekday, (x) => ({ ...x, items: x.items.filter((_, i) => i !== idx) }))}
                      hitSlop={8}
                      style={({ pressed }) => [styles.remove, { backgroundColor: t.surface, opacity: pressed ? 0.5 : 1 }]}
                    >
                      <Icon name={sym('xmark', 'close')} size={10} color={t.muted} fallback="×" />
                    </Pressable>
                  </Animated.View>
                ))}
                <AddButton compact title="Add exercise" label={`Add exercise to ${DAY_NAMES[d.weekday]}`} onPress={() => setPickerFor(d.weekday)} />
              </>
            )}
          </View>
        ))}
      </ScrollView>
      <SafeAreaView testID="plan-footer" edges={['bottom']} style={[styles.footer, { backgroundColor: t.bg, borderColor: t.border }]}>
        {onCancel && <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={saving} style={styles.action} />}
        <Button title="Save plan" onPress={save} disabled={saving} style={{ ...styles.action, ...styles.save }} />
      </SafeAreaView>
      <ExercisePicker
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(e) => pickerFor !== null && addExercise(pickerFor, e)}
      />
    </KeyboardAvoider>
  );
}

function TargetsField({
  label, title, sets, reps, onChange,
}: { label: string; title: string; sets: string; reps: string; onChange: (sets: string, reps: string) => void }) {
  const setCount = parseNumber(sets);
  const repCount = parseNumber(reps);
  return (
    <WheelButton
      label={label}
      valueText={`${sets || 'no'} sets, ${reps || 'no'} reps`}
      text={`${sets || '–'} × ${reps || '–'}`}
      title={title}
      columns={[
        { label: 'Sets', options: wheelOptions(1, MAX_SETS, setCount), value: setCount },
        { label: 'Reps', options: wheelOptions(1, MAX_REPS, repCount), value: repCount },
      ]}
      onDone={([nextSets, nextReps]) => onChange(txt(nextSets), txt(nextReps))}
      style={styles.targets}
    />
  );
}

function Num({ label, v, suffix, onChange }:{ label: string; v: string; suffix: string; onChange: (s: string) => void }) {
  const t = useTheme();
  return (
    <View style={styles.num}>
      <TextInput
        accessibilityLabel={label}
        value={v}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={[styles.numInput, { color: t.text, backgroundColor: t.surface }]}
      />
      <Text style={{ color: t.muted, fontSize: 12 }}>{suffix}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  intro: { fontSize: 15 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, paddingVertical: 14, borderRadius: 14 },
  save: { flex: 2 },
  day: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: ROW_GAP },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  dayName: { fontSize: 18, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { fontSize: 13, fontWeight: '600' },
  restLabel: { fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 56, paddingRight: 8, borderRadius: 14 },
  dragging: { zIndex: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  thumb: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  thumbInitial: { fontSize: 16, fontWeight: '800' },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600' },
  num: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  numInput: { width: 46, minHeight: 40, borderRadius: 10, paddingVertical: 6, textAlign: 'center', fontWeight: '600' },
  targets: { minWidth: 72, minHeight: 40 },
  duration: { minWidth: 46, minHeight: 40 },
  remove: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
