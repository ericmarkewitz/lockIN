import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView, type NativeGesture } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddButton, Button, Toggle, useRaised } from '@/components/ui';
import { Icon, sym } from '@/components/Icon';
import { ExerciseMotionFor } from '@/components/motion/ExerciseMotion';
import { DragHandle } from '@/components/DragHandle';
import { DayBadge } from '@/components/plan/DayBadge';
import { WeekHero } from '@/components/plan/WeekHero';
import { ExercisePicker } from '@/components/ExercisePicker';
import { RecordSheet } from '@/components/RecordSheet';
import { UnitPill } from '@/components/UnitPill';
import { KeyboardAvoider, keyboardScrollProps } from '@/components/KeyboardAvoider';
import { DurationButton } from '@/components/DurationButton';
import { WheelButton } from '@/components/WheelSheet';
import { getPlan, markPlanComplete, setPlanDay } from '@/data/plan';
import { FIELDS, fieldFor, type FieldId } from '@/data/fields';
import { getDistanceUnit, type DistanceUnit } from '@/data/settings';
import { defaultTargets, fieldUnit, fromDisplayField, toDisplayField } from '@/lib/fields';
import { otherDistanceUnit } from '@/lib/units';
import type { CategoryKind, Exercise } from '@/data/types';
import { refreshUntouchedWorkouts } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { DAY_NAMES } from '@/lib/calendar';
import { todayKey, weekdayOf } from '@/lib/dates';
import { parseNumber } from '@/lib/numbers';
import { clampDragOffset, dropIndex, moveItem } from '@/lib/reorder';
import { MAX_REPS, MAX_SETS, wheelOptions } from '@/lib/wheel';
import { tint, useTheme } from '@/theme';

type Draft = {
  key: string; exerciseId: number; name: string; kind: CategoryKind; isCustom: boolean;
  /** What it records; `ownFields` is what was picked for it, null following the exercise's default. */
  fields: FieldId[]; ownFields: FieldId[] | null;
  sets: string; reps: string; duration: string;
  /** Typed in `distanceUnit`. `savedDistance` is the stored miles, kept exactly if the text is left alone. */
  distance: string; distanceUnit: DistanceUnit; savedDistance: number | null;
  /** Steps, routes or whatever the exercise counts. */
  count: string;
};
type DayDraft = { weekday: number; isRest: boolean; items: Draft[] };

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const ROW_GAP = 8; // Card gap between rows; part of the drag pitch
/** One line under a day's name: how much is planned for it. */
const summarize = (d: DayDraft) =>
  d.isRest ? 'Rest day' : d.items.length ? `${d.items.length} exercise${d.items.length === 1 ? '' : 's'}` : 'Nothing planned';
const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** The units a draft's distance is typed in. Weight isn't planned. */
const draftUnits = (i: Pick<Draft, 'distanceUnit'>) => ({ weight: 'lb' as const, distance: i.distanceUnit });
/** Which distance an exercise records: miles or km, or yards or meters for a swim, row or carry. */
const distanceField = (fields: FieldId[]) => fieldFor(fields, 'distance');

/** Stored miles for a draft's typed distance, without rounding drift when it wasn't edited. */
function targetMiles(i: Draft): number | null {
  const field = distanceField(i.fields) ?? 'distance';
  const typed = parseNumber(i.distance);
  if (i.savedDistance !== null && typed === toDisplayField(field, i.savedDistance, draftUnits(i))) return i.savedDistance;
  return fromDisplayField(field, typed, draftUnits(i));
}

/** A typed whole number, rounded. */
const parseWhole = (text: string) => {
  const n = parseNumber(text);
  return n === null ? null : Math.round(n);
};

/** `onCancel` shows a Cancel button; omit it when there is nowhere to go back to (first run). */
export function PlanEditor({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const db = useDb();
  const t = useTheme();
  const raised = useRaised();
  const [days, setDays] = useState<DayDraft[] | null>(null);
  // The setting, for exercises added in this session.
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('mi');
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  /** An exercise picked for a day, waiting on what it should record. */
  const [adding, setAdding] = useState<{ weekday: number; exercise: Exercise } | null>(null);
  /** A plan item whose fields are being changed. */
  const [changing, setChanging] = useState<{ weekday: number; idx: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<{ weekday: number; from: number; over: number; pitch: number } | null>(null);
  const dragRef = useRef(drag);
  const [dragY] = useState(() => new Animated.Value(0));
  // Drag handles block this so the page holds still under a drag. The setter is stable and the
  // scroll view only reports a new gesture, so the scary prop name below is safe here.
  const [scrollGesture, setScrollGesture] = useState<NativeGesture | null>(null);
  const rowHeights = useRef(new Map<string, number>());
  const nextKey = useRef(0);
  const newKey = () => `row-${nextKey.current++}`;

  useEffect(() => {
    Promise.all([getPlan(db), getDistanceUnit(db)]).then(([plan, unit]) => {
      setDistanceUnit(unit);
      setDays(
        ORDER.map((w) => {
          const d = plan.find((p) => p.weekday === w)!;
          return {
            weekday: w,
            isRest: d.isRest,
            items: d.items.map((i) => ({
              key: newKey(), exerciseId: i.exerciseId, name: i.exerciseName, kind: i.categoryKind, isCustom: i.isCustom,
              fields: i.fields, ownFields: i.ownFields,
              sets: txt(i.targetSets), reps: txt(i.targetReps), duration: txt(i.targetDurationMin),
              distance: txt(toDisplayField(distanceField(i.fields) ?? 'distance', i.targetDistance ?? null, { weight: 'lb', distance: unit })),
              distanceUnit: unit, savedDistance: i.targetDistance ?? null, count: txt(i.targetCount),
            })),
          };
        }),
      );
    });
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
    // The row stays inside its own day; it can't be dropped on another one.
    dragY.setValue(clampDragOffset(cur.from, dy, cur.pitch, d.items.length));
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

  /** Adds `e` to a day, recording `fields` if they were picked for it, else the exercise's default. */
  const addExercise = (weekday: number, e: Exercise, picked: FieldId[] | null) => {
    const fields = picked ?? e.fields;
    const targets = defaultTargets({ categoryKind: e.categoryKind, fields });
    patchDay(weekday, (d) => ({
      ...d,
      isRest: false,
      items: [...d.items, {
        key: newKey(), exerciseId: e.id, name: e.name, kind: e.categoryKind, isCustom: e.isCustom, fields, ownFields: picked,
        sets: txt(targets.targetSets), reps: txt(targets.targetReps), duration: '',
        distance: '', distanceUnit, savedDistance: null, count: '',
      }],
    }));
    setAdding(null);
  };

  // Keep unsaved days in step with exercises edited or removed in the picker.
  const patchItems = (fn: (items: Draft[]) => Draft[]) =>
    setDays((ds) => ds && ds.map((d) => ({ ...d, items: fn(d.items) })));
  const renameDrafts = (e: Exercise) =>
    patchItems((items) => items.map((i) => (i.exerciseId === e.id ? { ...i, name: e.name, fields: i.ownFields ?? e.fields } : i)));
  const dropDrafts = (id: number) => patchItems((items) => items.filter((i) => i.exerciseId !== id));

  const save = async () => {
    setSaving(true);
    try {
      for (const d of days) {
        await setPlanDay(db, d.weekday, {
          isRest: d.isRest,
          items: d.items.map((i) => ({
            exerciseId: i.exerciseId,
            fields: i.ownFields,
            targetSets: i.kind === 'strength' ? parseNumber(i.sets) : null,
            targetReps: i.kind === 'strength' && i.fields.includes('reps') ? parseNumber(i.reps) : null,
            targetDurationMin: i.fields.includes('duration') ? parseNumber(i.duration) : null,
            targetDistance: distanceField(i.fields) ? targetMiles(i) : null,
            targetCount: fieldFor(i.fields, 'count') ? parseWhole(i.count) : null,
          })),
        });
      }
      await markPlanComplete(db, todayKey());
      await refreshUntouchedWorkouts(db, todayKey());
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const changingItem = changing && days.find((d) => d.weekday === changing.weekday)?.items[changing.idx];

  /** The targets an item can have: sets (and reps), time, distance and a count, as its fields allow. */
  const targetControls = (d: DayDraft, it: Draft, idx: number) => {
    const distField = distanceField(it.fields);
    const counted = fieldFor(it.fields, 'count');
    return (
      <>
        {it.kind === 'strength' && (it.fields.includes('reps') ? (
          <TargetsField
            label={`${d.weekday} ${it.name} sets and reps`}
            title={it.name}
            sets={it.sets}
            reps={it.reps}
            onChange={(sets, reps) => patchItem(d.weekday, idx, { sets, reps })}
          />
        ) : (
          <SetsField
            label={`${d.weekday} ${it.name} sets`}
            title={it.name}
            sets={it.sets}
            onChange={(sets) => patchItem(d.weekday, idx, { sets })}
          />
        ))}
        {it.fields.includes('duration') && (
          <DurationButton
            label={`${d.weekday} ${it.name} minutes`}
            title={it.name}
            value={parseNumber(it.duration)}
            onChange={(minutes) => patchItem(d.weekday, idx, { duration: txt(minutes) })}
            style={{ ...styles.chip, backgroundColor: t.card }}
            textStyle={styles.chipText}
          />
        )}
        {distField && (
          <View style={[styles.chip, styles.numChip, { backgroundColor: t.card }]}>
            <TextInput
              accessibilityLabel={`${d.weekday} ${it.name} distance`}
              value={it.distance}
              onChangeText={(distance) => patchItem(d.weekday, idx, { distance })}
              keyboardType="decimal-pad"
              placeholder="–"
              placeholderTextColor={t.muted}
              style={[styles.numInput, { color: t.text }]}
            />
            <UnitPill
              bare
              label={`${d.weekday} ${it.name} distance unit`}
              unit={fieldUnit(distField, draftUnits(it))}
              onPress={() => patchItem(d.weekday, idx, { distanceUnit: otherDistanceUnit(it.distanceUnit) })}
            />
          </View>
        )}
        {counted && (
          <View style={[styles.chip, styles.numChip, { backgroundColor: t.card }]}>
            <TextInput
              accessibilityLabel={`${d.weekday} ${it.name} ${FIELDS[counted].noun}`}
              value={it.count}
              onChangeText={(count) => patchItem(d.weekday, idx, { count })}
              keyboardType="number-pad"
              placeholder="–"
              placeholderTextColor={t.muted}
              style={[styles.numInput, styles.countInput, { color: t.text }]}
            />
            <Text style={[styles.chipUnit, { color: t.muted }]}>{FIELDS[counted].noun}</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <KeyboardAvoider>
      <ScrollView testID="plan-scroll" {...keyboardScrollProps} onGestureUpdate_CAN_CAUSE_INFINITE_RERENDER={setScrollGesture} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.wrap} style={{ backgroundColor: t.bg }}>
        <WeekHero
          today={weekdayOf(todayKey())}
          days={days.map((d) => ({ weekday: d.weekday, isRest: d.isRest, kinds: [...new Set(d.items.map((i) => i.kind))] }))}
        />
        {days.map((d) => (
          <View
            key={d.weekday}
            testID={`plan-day-${d.weekday}`}
            style={[
              styles.day,
              d.isRest ? { backgroundColor: tint(t.rest, 0.08), borderColor: tint(t.rest, 0.25) } : [{ backgroundColor: t.card, borderColor: t.border }, raised],
            ]}
          >
            {/* A big faded moon fills the corner of a rest day. */}
            {d.isRest && (
              <View pointerEvents="none" style={styles.restLayer}>
                <View style={styles.restMoon}>
                  <Icon name={sym('moon.stars.fill', 'nights_stay')} size={96} color={tint(t.rest, 0.14)} fallback="" />
                </View>
              </View>
            )}
            <View style={styles.dayHead}>
              <DayBadge weekday={d.weekday} state={d.isRest ? 'rest' : d.items.length ? 'training' : 'empty'} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.dayName, { color: t.text }]}>{DAY_NAMES[d.weekday]}</Text>
                  {d.weekday === weekdayOf(todayKey()) && (
                    <View style={[styles.todayTag, { backgroundColor: tint(t.primary, 0.14) }]}>
                      <Text style={[styles.todayText, { color: t.primary }]}>Today</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.summary, { color: d.isRest ? t.rest : t.muted }]}>
                  {summarize(d)}
                </Text>
              </View>
              <Text style={[styles.restLabel, { color: t.muted }]}>Rest</Text>
              <Toggle
                label={`${DAY_NAMES[d.weekday]} rest day`}
                value={d.isRest}
                onChange={(v) => patchDay(d.weekday, (x) => ({ ...x, isRest: v, items: v ? [] : x.items }))}
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
                      { backgroundColor: t.surface },
                      drag?.weekday === d.weekday && drag.from === idx
                        ? [styles.dragging, { backgroundColor: t.card, transform: [{ translateY: dragY }] }]
                        : { transform: [{ translateY: rowShift(d.weekday, idx) }] },
                    ]}
                  >
                    <DragHandle
                      label={`Reorder ${it.name} on ${DAY_NAMES[d.weekday]}`}
                      testID={`drag-${it.name}-${d.weekday}`}
                      blocks={scrollGesture}
                      onStart={() => startDrag(d.weekday, idx, it.key)}
                      onMove={(dy) => moveDrag(d, dy)}
                      onEnd={(dy) => endDrag(d, dy)}
                      onCancel={cancelDrag}
                      onMoveUp={() => reorder(d.weekday, idx, idx - 1)}
                      onMoveDown={() => reorder(d.weekday, idx, idx + 1)}
                    />
                    <View style={[styles.thumb, { backgroundColor: tint(t.primary, 0.1) }]}>
                      {it.isCustom
                        ? <Text style={[styles.thumbInitial, { color: t.primary }]}>{it.name.trim().charAt(0).toUpperCase()}</Text>
                        : <ExerciseMotionFor name={it.name} isCustom={it.isCustom} size={38} />}
                    </View>
                    {/* The name has the full width on its line; the targets go on the line under it. */}
                    <View style={styles.itemBody}>
                      <Text testID={`plan-name-${it.name}-${d.weekday}`} numberOfLines={2} style={[styles.itemName, { color: t.text }]}>{it.name}</Text>
                      <View testID={`plan-targets-${it.name}-${d.weekday}`} style={styles.targetLine}>
                        {targetControls(d, it, idx)}
                      </View>
                    </View>
                    {/* The item's own actions, kept apart from its targets. */}
                    <View style={styles.rowActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Change what ${it.name} records on ${DAY_NAMES[d.weekday]}`}
                        onPress={() => setChanging({ weekday: d.weekday, idx })}
                        hitSlop={6}
                        style={({ pressed }) => [styles.rowAction, { opacity: pressed ? 0.5 : 1 }]}
                      >
                        <Icon name={sym('slider.horizontal.3', 'tune')} size={15} color={t.muted} fallback="⋯" />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${it.name} from ${DAY_NAMES[d.weekday]}`}
                        onPress={() => patchDay(d.weekday, (x) => ({ ...x, items: x.items.filter((_, i) => i !== idx) }))}
                        hitSlop={6}
                        style={({ pressed }) => [styles.rowAction, { opacity: pressed ? 0.5 : 1 }]}
                      >
                        <Icon name={sym('xmark', 'close')} size={12} color={t.muted} fallback="×" />
                      </Pressable>
                    </View>
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
        onPick={(e) => {
          // Only an exercise without an obvious default asks what to record first.
          if (pickerFor !== null) {
            if (e.asksWhatToRecord) setAdding({ weekday: pickerFor, exercise: e });
            else addExercise(pickerFor, e, null);
          }
          setPickerFor(null);
        }}
        onEdited={renameDrafts}
        onRemoved={dropDrafts}
      />
      {adding && (
        <RecordSheet
          exerciseName={adding.exercise.name}
          kind={adding.exercise.categoryKind}
          initial={adding.exercise.fields}
          confirmLabel="Add"
          confirmA11yLabel={`Add ${adding.exercise.name} to the plan`}
          onConfirm={(fields) => addExercise(adding.weekday, adding.exercise, fields)}
          onClose={() => setAdding(null)}
        />
      )}
      {changing && changingItem && (
        <RecordSheet
          exerciseName={changingItem.name}
          kind={changingItem.kind}
          initial={changingItem.fields}
          confirmLabel="Save"
          onConfirm={(fields) => {
            patchItem(changing.weekday, changing.idx, { fields, ownFields: fields });
            setChanging(null);
          }}
          onClose={() => setChanging(null)}
        />
      )}
    </KeyboardAvoider>
  );
}

/** Sets alone, for a lift that has no reps (a hold, a carry). */
function SetsField({
  label, title, sets, onChange,
}: { label: string; title: string; sets: string; onChange: (sets: string) => void }) {
  const t = useTheme();
  const n = parseNumber(sets);
  return (
    <WheelButton
      label={label}
      valueText={`${sets || 'no'} sets`}
      text={n === null ? '– sets' : `${n} ${n === 1 ? 'set' : 'sets'}`}
      title={title}
      columns={[{ label: 'Sets', options: wheelOptions(1, MAX_SETS, n), value: n }]}
      onDone={([next]) => onChange(txt(next))}
      style={{ ...styles.chip, backgroundColor: t.card }}
      textStyle={styles.chipText}
    />
  );
}

function TargetsField({
  label, title, sets, reps, onChange,
}: { label: string; title: string; sets: string; reps: string; onChange: (sets: string, reps: string) => void }) {
  const t = useTheme();
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
      style={{ ...styles.chip, backgroundColor: t.card }}
      textStyle={styles.chipText}
    />
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingVertical: 8, paddingRight: 6, borderRadius: 16 },
  // Tucks into the handle's grab area, so the picture only moves over a little.
  thumb: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  thumbInitial: { fontSize: 18, fontWeight: '800' },
  itemBody: { flex: 1, minWidth: 0, gap: 6 },
  itemName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  targetLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  // One target: sets × reps, a time, a distance or a count, with its unit inside.
  chip: { minHeight: 36, minWidth: 0, borderRadius: 10, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '800' },
  chipUnit: { fontSize: 12, fontWeight: '600' },
  numChip: { flexDirection: 'row', paddingLeft: 6, paddingRight: 8, gap: 0 },
  // Right-aligned so the unit after it reads as part of the number: "3.1 mi", "8000 steps".
  numInput: { minWidth: 30, paddingVertical: 6, paddingRight: 2, textAlign: 'right', fontSize: 14, fontWeight: '800' },
  countInput: { minWidth: 40 },
  rowActions: { alignItems: 'center', gap: 4 },
  rowAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  wrap: { padding: 16, gap: 12 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, paddingVertical: 15 },
  save: { flex: 2 },
  day: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: ROW_GAP },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  todayText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  // Clips the moon to the card without clipping the card's shadow.
  restLayer: { ...StyleSheet.absoluteFill, borderRadius: 24, overflow: 'hidden' },
  restMoon: { position: 'absolute', right: -22, bottom: -30 },
  dayName: { fontSize: 20, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  summary: { fontSize: 13, fontWeight: '600' },
  restLabel: { fontSize: 13, fontWeight: '600' },
  dragging: { zIndex: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
});
