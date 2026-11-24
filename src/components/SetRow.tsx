import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DEFAULT_FIELDS, FIELDS, type FieldId } from '@/data/fields';
import type { DistanceUnit, Units, WeightUnit } from '@/data/settings';
import type { CategoryKind, WorkoutSet } from '@/data/types';
import type { SetPatch } from '@/data/workouts';
import { fieldUnit, fieldValue, fromDisplayField, toDisplayField } from '@/lib/fields';
import { parseNumber } from '@/lib/numbers';
import { otherDistanceUnit, otherWeightUnit } from '@/lib/units';
import { MAX_REPS, wheelOptions } from '@/lib/wheel';
import { tint, useTheme } from '@/theme';
import { DifficultyButton } from './DifficultyButton';
import { DurationButton } from './DurationButton';
import { Icon, sym } from './Icon';
import { UnitPill } from './UnitPill';
import { WheelButton } from './WheelSheet';

type Props = {
  kind: CategoryKind;
  /** What the exercise records, in order; its category's default when left out. */
  fields?: readonly FieldId[];
  set: WorkoutSet;
  /** Sets don't store a duration target; it comes from the workout exercise. */
  targetDurationMin?: number | null;
  /** The user's settings; a set entered in the other unit keeps showing in that unit. */
  unit: WeightUnit;
  distanceUnit?: DistanceUnit;
  /** Names a cardio, yoga or mobility entry, which has no set number. */
  exerciseName?: string;
  onChange: (patch: SetPatch) => void;
  /** Omit for a row that can't be removed on its own (an exercise's only entry). */
  onRemove?: () => void;
  /** The day's next set to do, whose number is lit with the accent. */
  isNext?: boolean;
};

const show = (n: number | null) => (n === null ? '' : String(n));

/** Fields whose unit follows the set's distance unit: miles or km, yards or meters, feet or meters. */
const DISTANCE_LIKE: readonly string[] = ['distance', 'shortDistance', 'elevation'];

/**
 * A typed number. With `onSuffixPress` the suffix is a button (a unit to switch); it gets the
 * number on screen, including unsaved typing, which it takes over instead of `onCommit`.
 * `integer` takes whole numbers, rounding what's typed.
 */
function NumField({
  label, value, suffix, suffixLabel, onSuffixPress, onCommit, integer,
}: {
  label: string; value: number | null; suffix: string; suffixLabel?: string;
  onSuffixPress?: (current: number | null) => void; onCommit: (n: number | null) => void; integer?: boolean;
}) {
  const t = useTheme();
  // `draft` holds in-progress typing; null means "show the stored value".
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? show(value);
  const parse = (typed: string) => {
    const n = parseNumber(typed);
    return integer && n !== null ? Math.round(n) : n;
  };
  const commit = () => {
    if (draft === null) return;
    const parsed = parse(draft);
    setDraft(null);
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <View style={[styles.field, { backgroundColor: t.surface }]}>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        placeholder="–"
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text }]}
      />
      {onSuffixPress ? (
        <UnitPill
          label={suffixLabel ?? `${label} unit`}
          unit={suffix}
          onPress={() => {
            const current = draft === null ? value : parse(draft);
            setDraft(null);
            onSuffixPress(current);
          }}
        />
      ) : !!suffix && (
        <Text style={[styles.suffix, { color: t.muted }]} numberOfLines={1}>{suffix}</Text>
      )}
    </View>
  );
}

/** Reps open on the logged value, or the target so a planned set takes one tap to log. */
function RepsField({ set, onCommit }: { set: WorkoutSet; onCommit: (reps: number | null) => void }) {
  const t = useTheme();
  const { reps, targetReps } = set;
  const start = reps ?? targetReps;
  const unlogged = targetReps === null ? 'Not logged' : `Not logged, target ${targetReps}`;
  return (
    <View style={[styles.field, { backgroundColor: t.surface }]}>
      <WheelButton
        label={`Reps for set ${set.setNumber}`}
        valueText={reps === null ? unlogged : String(reps)}
        text={show(start)}
        muted={reps === null}
        title={`Set ${set.setNumber}`}
        columns={[{ label: 'Reps', options: wheelOptions(0, MAX_REPS, start), value: start }]}
        onDone={([next]) => {
          if (next !== reps) onCommit(next);
        }}
        style={styles.wheelButton}
      />
      <Text style={[styles.suffix, { color: t.muted }]}>reps</Text>
    </View>
  );
}

/** How hard it felt, 1 to 10. */
function DifficultyField({ label, title, value, onCommit }: {
  label: string; title: string; value: number | null; onCommit: (n: number | null) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.field, { backgroundColor: t.surface }]}>
      <DifficultyButton label={label} title={title} value={value} onChange={onCommit} style={styles.wheelButton} />
      <Text style={[styles.suffix, { color: t.muted }]}>/10</Text>
    </View>
  );
}

/** Column headings that line up with the fields of strength SetRows below them. */
export function SetHeader({ fields = DEFAULT_FIELDS.strength }: { fields?: readonly FieldId[] }) {
  const t = useTheme();
  const head = [styles.headText, { color: t.muted }];
  return (
    <View style={styles.header} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[head, styles.num]}>Set</Text>
      {fields.map((f) => <Text key={f} style={[head, styles.headCol]} numberOfLines={1}>{FIELDS[f].label}</Text>)}
      <View style={styles.headActions} />
    </View>
  );
}

/**
 * One logged row, with a field for each thing the exercise records. Strength exercises have
 * numbered sets (weight × reps by default). Cardio, yoga and mobility log a single entry (time,
 * plus distance for cardio, by default) named after the exercise; an extra entry from before is
 * numbered so it stays distinct.
 */
export function SetRow({
  kind, fields = DEFAULT_FIELDS[kind], set, targetDurationMin = null, unit, distanceUnit = 'mi', exerciseName = 'Exercise', onChange, onRemove,
  isNext = false,
}: Props) {
  const t = useTheme();
  const n = set.setNumber;
  const units: Units = { weight: set.weightUnit ?? unit, distance: set.distanceUnit ?? distanceUnit };
  const done = set.completed;
  const isSet = kind === 'strength';
  const entry = n === 1 ? exerciseName : `${exerciseName} ${n}`;
  // "Weight for set 2" for a set; "Running duration" for an entry.
  const fieldLabel = (field: string) => (isSet ? `${field} for set ${n}` : `${entry} ${field.toLowerCase()}`);
  const subject = isSet ? `set ${n}` : entry;
  // One switch for the distance unit, on the first field that follows it; the rest show its unit.
  const switchesDistance = fields.find((f) => DISTANCE_LIKE.includes(FIELDS[f].input));

  const field = (f: FieldId) => {
    const def = FIELDS[f];
    if (def.input === 'reps') return <RepsField key={f} set={set} onCommit={(reps) => onChange({ reps })} />;
    if (def.input === 'difficulty') {
      return (
        <DifficultyField
          key={f}
          label={fieldLabel(def.label)}
          title={isSet ? `Set ${n}` : entry}
          value={set.difficulty}
          onCommit={(difficulty) => onChange({ difficulty })}
        />
      );
    }
    if (def.input === 'duration') {
      return (
        <View key={f} style={[styles.field, styles.fieldBare, { backgroundColor: t.surface }]}>
          <DurationButton
            label={fieldLabel(isSet ? 'Time' : 'Duration')}
            title={isSet ? `Set ${n}` : entry}
            value={set.durationMin}
            target={targetDurationMin}
            onChange={(durationMin) => onChange({ durationMin })}
            style={styles.wheelButton}
          />
        </View>
      );
    }
    // The number stays as typed and now means the other unit: 20 lb becomes 20 kg.
    const switchUnit = def.input === 'weight'
      ? (current: number | null) => {
        const next = { ...units, weight: otherWeightUnit(units.weight) };
        onChange({ weightUnit: next.weight, [def.key]: fromDisplayField(f, current, next) });
      }
      : f === switchesDistance
        ? (current: number | null) => {
          const next = { ...units, distance: otherDistanceUnit(units.distance) };
          onChange({ distanceUnit: next.distance, [def.key]: fromDisplayField(f, current, next) });
        }
        : undefined;
    return (
      <NumField
        key={f}
        label={fieldLabel(def.label)}
        value={toDisplayField(f, fieldValue(set, f), units)}
        suffix={fieldUnit(f, units)}
        suffixLabel={fieldLabel(`${def.label} unit`)}
        onSuffixPress={switchUnit}
        onCommit={(value) => onChange({ [def.key]: fromDisplayField(f, value, units) })}
        integer={def.input === 'count'}
      />
    );
  };

  return (
    <View style={[styles.row, done && { backgroundColor: tint(t.success, 0.1) }]}>
      {isSet && (
        <View style={[styles.num, styles.badge, { backgroundColor: done ? t.success : isNext ? t.primary : t.surface }]}>
          <Text style={[styles.numText, { color: done ? t.bg : isNext ? t.onPrimary : t.muted }]}>{n}</Text>
        </View>
      )}
      {fields.map(field)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark ${subject} ${set.completed ? 'not done' : 'done'}`}
        onPress={() => onChange({ completed: !set.completed })}
        style={({ pressed }) => [
          styles.check,
          {
            borderColor: done ? t.success : t.border, backgroundColor: done ? t.success : 'transparent',
            boxShadow: done ? `0px 3px 10px ${tint(t.success, 0.4)}` : undefined, transform: [{ scale: pressed ? 0.9 : 1 }],
          },
        ]}
      >
        <Icon name={sym('checkmark', 'check')} size={15} color={done ? t.bg : t.muted} fallback="✓" />
      </Pressable>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${subject}`} onPress={onRemove} hitSlop={10} style={styles.remove}>
          <Icon name={sym('xmark', 'close')} size={11} color={t.muted} fallback="×" />
        </Pressable>
      ) : (
        <View style={styles.remove} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 12 },
  num: { width: 26 },
  badge: { height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  field: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingRight: 10 },
  fieldBare: { paddingRight: 0 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 10, textAlign: 'center', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  wheelButton: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  suffix: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  remove: { width: 18, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  headText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  headCol: { flex: 1 },
  // Matches the check button, the remove button and the gap between them.
  headActions: { width: 36 + 8 + 18 },
});
