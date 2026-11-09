import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { DistanceUnit, WeightUnit } from '@/data/settings';
import type { CategoryKind, WorkoutSet } from '@/data/types';
import type { SetPatch } from '@/data/workouts';
import { parseNumber } from '@/lib/numbers';
import {
  fromDisplayDistance, fromDisplayWeight, otherDistanceUnit, otherWeightUnit, toDisplayDistance, toDisplayWeight,
} from '@/lib/units';
import { MAX_REPS, wheelOptions } from '@/lib/wheel';
import { tint, useTheme } from '@/theme';
import { DurationButton } from './DurationButton';
import { Icon, sym } from './Icon';
import { UnitPill } from './UnitPill';
import { WheelButton } from './WheelSheet';

type Props = {
  kind: CategoryKind;
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
};

const show = (n: number | null) => (n === null ? '' : String(n));

/**
 * A typed number. With `onSuffixPress` the suffix is a button (a unit to switch); it gets the
 * number on screen, including unsaved typing, which it takes over instead of `onCommit`.
 */
function NumField({
  label, value, suffix, suffixLabel, onSuffixPress, onCommit,
}: {
  label: string; value: number | null; suffix: string; suffixLabel?: string;
  onSuffixPress?: (current: number | null) => void; onCommit: (n: number | null) => void;
}) {
  const t = useTheme();
  // `draft` holds in-progress typing; null means "show the stored value".
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? show(value);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseNumber(draft);
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
        keyboardType="decimal-pad"
        placeholder="–"
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text }]}
      />
      {onSuffixPress ? (
        <UnitPill
          label={suffixLabel ?? `${label} unit`}
          unit={suffix}
          onPress={() => {
            const current = draft === null ? value : parseNumber(draft);
            setDraft(null);
            onSuffixPress(current);
          }}
        />
      ) : (
        <Text style={[styles.suffix, { color: t.muted }]}>{suffix}</Text>
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

/** Column headings that line up with the fields of strength SetRows below them. */
export function SetHeader() {
  const t = useTheme();
  const [a, b] = ['Weight', 'Reps'];
  const head = [styles.headText, { color: t.muted }];
  return (
    <View style={styles.header} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[head, styles.num]}>Set</Text>
      <Text style={[head, styles.headCol]}>{a}</Text>
      <Text style={[head, styles.headCol]}>{b}</Text>
      <View style={styles.headActions} />
    </View>
  );
}

/**
 * One logged row. Strength exercises have numbered sets of weight × reps. Cardio, yoga and
 * mobility log a single entry (time, plus distance for cardio) named after the exercise; an
 * extra entry from before is numbered so it stays distinct.
 */
export function SetRow({
  kind, set, targetDurationMin = null, unit, distanceUnit = 'mi', exerciseName = 'Exercise', onChange, onRemove,
}: Props) {
  const t = useTheme();
  const n = set.setNumber;
  const weightUnit = set.weightUnit ?? unit;
  const distUnit = set.distanceUnit ?? distanceUnit;
  const done = set.completed;
  const isSet = kind === 'strength';
  const entry = n === 1 ? exerciseName : `${exerciseName} ${n}`;
  // "Weight for set 2" for a set; "Running duration" for an entry.
  const fieldLabel = (field: string) => (isSet ? `${field} for set ${n}` : `${entry} ${field.toLowerCase()}`);
  const subject = isSet ? `set ${n}` : entry;
  return (
    <View style={[styles.row, done && { backgroundColor: tint(t.success, 0.1) }]}>
      {isSet && (
        <View style={[styles.num, styles.badge, { backgroundColor: done ? t.success : t.surface }]}>
          <Text style={[styles.numText, { color: done ? t.bg : t.muted }]}>{n}</Text>
        </View>
      )}
      {isSet ? (
        <>
          <NumField
            label={fieldLabel('Weight')}
            value={toDisplayWeight(set.weight, weightUnit)}
            suffix={weightUnit}
            suffixLabel={fieldLabel('Weight unit')}
            // The number stays as typed and now means the other unit: 20 lb becomes 20 kg.
            onSuffixPress={(current) => {
              const next = otherWeightUnit(weightUnit);
              onChange({ weightUnit: next, weight: fromDisplayWeight(current, next) });
            }}
            onCommit={(weight) => onChange({ weight: fromDisplayWeight(weight, weightUnit) })}
          />
          <RepsField set={set} onCommit={(reps) => onChange({ reps })} />
        </>
      ) : (
        <>
          <View style={[styles.field, styles.fieldBare, { backgroundColor: t.surface }]}>
            <DurationButton
              label={fieldLabel('Duration')}
              title={entry}
              value={set.durationMin}
              target={targetDurationMin}
              onChange={(durationMin) => onChange({ durationMin })}
              style={styles.wheelButton}
            />
          </View>
          {kind === 'cardio' && (
            <NumField
              label={fieldLabel('Distance')}
              value={toDisplayDistance(set.distance, distUnit)}
              suffix={distUnit}
              suffixLabel={fieldLabel('Distance unit')}
              // As with weight: the typed number stays and now means the other unit.
              onSuffixPress={(current) => {
                const next = otherDistanceUnit(distUnit);
                onChange({ distanceUnit: next, distance: fromDisplayDistance(current, next) });
              }}
              onCommit={(distance) => onChange({ distance: fromDisplayDistance(distance, distUnit) })}
            />
          )}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark ${subject} ${set.completed ? 'not done' : 'done'}`}
        onPress={() => onChange({ completed: !set.completed })}
        style={({ pressed }) => [
          styles.check,
          { borderColor: done ? t.success : t.border, backgroundColor: done ? t.success : 'transparent', opacity: pressed ? 0.6 : 1 },
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
  numText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  field: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingRight: 10 },
  fieldBare: { paddingRight: 0 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 10, textAlign: 'center', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  wheelButton: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  suffix: { fontSize: 12, fontWeight: '600' },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  remove: { width: 18, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  headText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  headCol: { flex: 1 },
  // Matches the check button, the remove button and the gap between them.
  headActions: { width: 36 + 8 + 18 },
});
