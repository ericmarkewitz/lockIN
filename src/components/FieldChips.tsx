import { StyleSheet, Text, View } from 'react-native';

import { FIELD_CHOICES, FIELDS, toggleField, type FieldId } from '@/data/fields';
import type { CategoryKind } from '@/data/types';
import type { Theme } from '@/theme';
import { Chips } from './MuscleGroupChips';

/** How a field is offered, where its plain label could be read two ways. */
const CHOICE_LABELS: Partial<Record<FieldId, string>> = {
  distance: 'Distance (mi/km)',
  shortDistance: 'Distance (yd/m)',
  elevation: 'Elevation gain',
};

export const choiceLabel = (id: FieldId) => CHOICE_LABELS[id] ?? FIELDS[id].label;

/**
 * What an exercise records, picked from what its kind of category offers. Picking a count
 * (Steps, Routes…) replaces the one picked before, and the last field can't be turned off.
 */
export function FieldChips({ kind, picked, onChange, t }: {
  kind: CategoryKind; picked: readonly FieldId[]; onChange: (fields: FieldId[]) => void; t: Theme;
}) {
  const chips = FIELD_CHOICES[kind].map((f) => ({ value: f, label: choiceLabel(f), a11y: `Record ${choiceLabel(f)}` }));
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.muted }]}>Records</Text>
      <Chips options={chips} picked={picked} onToggle={(f) => onChange(toggleField(picked, f as FieldId, kind))} t={t} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 10 },
  label: { fontSize: 13, fontWeight: '600' },
});
