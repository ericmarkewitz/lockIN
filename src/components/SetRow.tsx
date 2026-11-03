import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { WeightUnit } from '@/data/settings';
import type { CategoryKind, WorkoutSet } from '@/data/types';
import type { SetPatch } from '@/data/workouts';
import { parseNumber } from '@/lib/numbers';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/units';
import { MAX_REPS, wheelOptions } from '@/lib/wheel';
import { useTheme } from '@/theme';
import { DurationButton } from './DurationButton';
import { WheelButton } from './WheelSheet';

type Props = {
  kind: CategoryKind;
  set: WorkoutSet;
  /** Sets don't store a duration target; it comes from the workout exercise. */
  targetDurationMin?: number | null;
  unit: WeightUnit;
  onChange: (patch: SetPatch) => void;
  onRemove: () => void;
};

const show = (n: number | null) => (n === null ? '' : String(n));

function NumField({
  label, value, suffix, onCommit,
}: { label: string; value: number | null; suffix: string; onCommit: (n: number | null) => void }) {
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
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      />
      <Text style={[styles.suffix, { color: t.muted }]}>{suffix}</Text>
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
    <View style={styles.field}>
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

export function SetRow({ kind, set, targetDurationMin = null, unit, onChange, onRemove }: Props) {
  const t = useTheme();
  const n = set.setNumber;
  return (
    <View style={styles.row}>
      <Text style={[styles.num, { color: t.muted }]}>{n}</Text>
      {kind === 'strength' ? (
        <>
          <NumField label={`Weight for set ${n}`} value={toDisplayWeight(set.weight, unit)} suffix={unit}
            onCommit={(weight) => onChange({ weight: fromDisplayWeight(weight, unit) })} />
          <RepsField set={set} onCommit={(reps) => onChange({ reps })} />
        </>
      ) : (
        <>
          <DurationButton
            label={`Duration for set ${n}`}
            title={`Set ${n}`}
            value={set.durationMin}
            target={targetDurationMin}
            onChange={(durationMin) => onChange({ durationMin })}
            style={styles.wheelButton}
          />
          <NumField label={`Distance for set ${n}`} value={set.distance} suffix="dist" onCommit={(distance) => onChange({ distance })} />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark set ${n} ${set.completed ? 'not done' : 'done'}`}
        onPress={() => onChange({ completed: !set.completed })}
        style={[styles.check, { borderColor: set.completed ? t.success : t.border, backgroundColor: set.completed ? t.success : 'transparent' }]}
      >
        <Text style={{ color: set.completed ? '#fff' : t.muted }}>✓</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove set ${n}`} onPress={onRemove} hitSlop={8}>
        <Text style={{ color: t.muted, fontSize: 18 }}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  num: { width: 18, textAlign: 'center', fontWeight: '600' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, textAlign: 'center', fontSize: 16 },
  wheelButton: { flex: 1, minWidth: 0 },
  suffix: { fontSize: 12, width: 30 },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
