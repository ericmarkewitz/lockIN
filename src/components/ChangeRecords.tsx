import { useState } from 'react';

import { setDefaultFields } from '@/data/exercises';
import type { FieldId } from '@/data/fields';
import type { WorkoutExercise } from '@/data/types';
import { setWorkoutExerciseFields } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { ConfirmDialog } from './ConfirmDialog';
import { describeFields } from './FieldChips';
import { RecordSheet } from './RecordSheet';

const same = (a: readonly FieldId[], b: readonly FieldId[]) => a.length === b.length && a.every((f, i) => f === b[i]);

/**
 * Changes what a day records for one of its exercises. When that differs from the exercise's
 * default it then asks whether to make it the default, so new plans and days start from it.
 */
export function ChangeRecords({ exercise, onDone }: {
  exercise: WorkoutExercise;
  /** Called once it's over, saved or not; reload to show the change. */
  onDone: () => void;
}) {
  const db = useDb();
  const [asking, setAsking] = useState<FieldId[] | null>(null);
  const name = exercise.exerciseName;

  const save = async (fields: FieldId[]) => {
    await setWorkoutExerciseFields(db, exercise.id, fields);
    if (same(fields, exercise.defaultFields)) onDone();
    else setAsking(fields);
  };

  if (asking) {
    return (
      <ConfirmDialog
        title={`Make this the default for ${name}?`}
        message={`${name} will record ${describeFields(asking)} from now on, wherever you haven't picked something else. Workouts you've logged keep what they recorded.`}
        cancelLabel="Just this workout"
        confirmLabel="Make default"
        tone="primary"
        onCancel={onDone}
        onConfirm={async () => {
          await setDefaultFields(db, exercise.exerciseId, asking);
          onDone();
        }}
      />
    );
  }
  return (
    <RecordSheet
      exerciseName={name}
      kind={exercise.categoryKind}
      initial={exercise.fields}
      confirmLabel="Save"
      onConfirm={save}
      onClose={onDone}
    />
  );
}
