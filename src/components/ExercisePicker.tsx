import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { addExercise, listCategoriesWithExercises } from '@/data/exercises';
import type { Exercise } from '@/data/types';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { useTheme } from '@/theme';
import { Button } from './ui';

export function ExercisePicker({
  visible, onPick, onClose,
}: { visible: boolean; onPick: (e: Exercise) => void; onClose: () => void }) {
  const db = useDb();
  const t = useTheme();
  const { data: cats, reload } = useLoad(() => listCategoriesWithExercises(db), [db]);
  const [catId, setCatId] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = cats?.find((c) => c.id === (catId ?? cats?.[0]?.id));

  const create = async () => {
    if (!active) return;
    try {
      const ex = await addExercise(db, active.id, custom);
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
      <View style={[styles.wrap, { backgroundColor: t.bg }]}>
        <Text style={[styles.title, { color: t.text }]}>Choose exercise</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {cats?.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`Category ${c.name}`}
              onPress={() => setCatId(c.id)}
              style={[styles.chip, { borderColor: t.border, backgroundColor: c.id === active?.id ? t.primary : t.card }]}
            >
              <Text style={{ color: c.id === active?.id ? t.onPrimary : t.text }}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView style={{ flex: 1 }}>
          {active?.exercises.map((e) => (
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
        </ScrollView>
        <View style={styles.customRow}>
          <TextInput
            accessibilityLabel="New exercise name"
            value={custom}
            onChangeText={setCustom}
            placeholder={`New ${active?.name ?? ''} exercise`}
            placeholderTextColor={t.muted}
            style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
          />
          <Button title="Create" onPress={create} variant="secondary" />
        </View>
        {error && <Text style={{ color: t.danger }}>{error}</Text>}
        <Button title="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingTop: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  chips: { flexGrow: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  customRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
});
