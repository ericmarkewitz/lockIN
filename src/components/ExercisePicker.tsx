import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { OTHER_SUBCATEGORY, addExercise, groupBySubcategory, listCategoriesWithExercises } from '@/data/exercises';
import type { Exercise } from '@/data/types';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { useTheme } from '@/theme';
import { keyboardAvoidance } from './KeyboardAvoider';
import { Button } from './ui';

function Chip({ title, label, selected, onPress }: { title: string; label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: t.border, backgroundColor: selected ? t.primary : t.card }]}
    >
      <Text style={{ color: selected ? t.onPrimary : t.text }}>{title}</Text>
    </Pressable>
  );
}

export function ExercisePicker({
  visible, onPick, onClose,
}: { visible: boolean; onPick: (e: Exercise) => void; onClose: () => void }) {
  const db = useDb();
  const t = useTheme();
  const { data: cats, reload } = useLoad(() => listCategoriesWithExercises(db), [db]);
  const [catId, setCatId] = useState<number | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null); // null shows the whole category
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = cats?.find((c) => c.id === (catId ?? cats?.[0]?.id));
  const groups = active ? groupBySubcategory(active) : [];
  const shownGroups = subcategory ? groups.filter((g) => g.title === subcategory) : groups;
  const hasOther = groups.some((g) => g.title === OTHER_SUBCATEGORY);
  const newExerciseGroup = subcategory === OTHER_SUBCATEGORY ? null : subcategory;

  const selectCategory = (id: number) => {
    setCatId(id);
    setSubcategory(null);
  };

  const create = async () => {
    if (!active) return;
    try {
      const ex = await addExercise(db, active.id, custom, newExerciseGroup);
      setCustom('');
      setError(null);
      await reload();
      onPick(ex);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        testID="picker-keyboard-avoider"
        // The modal fills the window, so no header offset; the custom input sits outside the list.
        {...keyboardAvoidance({ os: Platform.OS, headerHeight: 0, scrolls: false })}
        style={{ flex: 1, backgroundColor: t.bg }}
      >
        <View style={styles.wrap}>
          <Text style={[styles.title, { color: t.text }]}>Choose exercise</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {cats?.map((c) => (
              <Chip
                key={c.id}
                title={c.name}
                label={`Category ${c.name}`}
                selected={c.id === active?.id}
                onPress={() => selectCategory(c.id)}
              />
            ))}
          </ScrollView>
          {!!active?.subcategories.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              <Chip title="All" label="Show all exercises" selected={subcategory === null} onPress={() => setSubcategory(null)} />
              {[...active.subcategories, ...(hasOther ? [OTHER_SUBCATEGORY] : [])].map((s) => (
                <Chip key={s} title={s} label={`Subcategory ${s}`} selected={subcategory === s} onPress={() => setSubcategory(s)} />
              ))}
            </ScrollView>
          )}
          <ScrollView style={{ flex: 1 }}>
            {shownGroups.map((g) => (
              <View key={g.title ?? 'all'}>
                {g.title && !subcategory && (
                  <Text accessibilityRole="header" style={[styles.groupTitle, { color: t.muted }]}>{g.title}</Text>
                )}
                {g.exercises.map((e) => (
                  <Pressable
                    key={e.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${e.name}`}
                    onPress={() => onPick(e)}
                    style={[styles.item, { borderColor: t.border }]}
                  >
                    <Text style={{ color: t.text, fontSize: 16 }}>{e.name}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            {subcategory && !shownGroups.length && (
              <Text style={[styles.empty, { color: t.muted }]}>No {subcategory} exercises yet.</Text>
            )}
          </ScrollView>
          <View style={styles.customRow}>
            <TextInput
              accessibilityLabel="New exercise name"
              value={custom}
              onChangeText={setCustom}
              placeholder={`New ${newExerciseGroup ?? active?.name ?? ''} exercise`}
              placeholderTextColor={t.muted}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
            />
            <Button title="Create" onPress={create} variant="secondary" />
          </View>
          {error && <Text style={{ color: t.danger }}>{error}</Text>}
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingTop: 20, paddingBottom: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  chips: { flexGrow: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  groupTitle: { fontSize: 13, fontWeight: '700', paddingTop: 16, paddingBottom: 4 },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { paddingVertical: 14, textAlign: 'center' },
  customRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
});
