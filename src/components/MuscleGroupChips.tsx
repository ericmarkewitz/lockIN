import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CategoryKind } from '@/data/types';
import type { Theme } from '@/theme';

/** What a kind's subcategories are called: a lift's are muscle groups, yoga and mobility are types. */
export const subcategoryNoun = (kind: CategoryKind) => (kind === 'strength' ? 'Muscle group' : 'Type');

/**
 * Toggles for the subcategories an exercise goes under (a lift's muscle groups, or yoga and
 * mobility); the first one picked is its main one.
 */
export function MuscleGroupChips({ options, picked, onToggle, kind, t }: {
  options: readonly string[]; picked: string[]; onToggle: (s: string) => void; kind: CategoryKind; t: Theme;
}) {
  return (
    <View style={styles.chips}>
      {options.map((s) => {
        const on = picked.includes(s);
        return (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`${subcategoryNoun(kind)} ${s}`}
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(s)}
            hitSlop={4}
            style={[styles.chip, on
              ? { backgroundColor: t.primary, borderColor: t.primary }
              : { backgroundColor: t.card, borderColor: t.border }]}
          >
            <Text style={[styles.chipLabel, { color: on ? t.onPrimary : t.text }]}>{s}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** `picked` with `s` added at the end, or taken out if it was already there. */
export const toggled = (picked: string[], s: string) =>
  picked.includes(s) ? picked.filter((g) => g !== s) : [...picked, s];

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipLabel: { fontSize: 13, fontWeight: '600' },
});
