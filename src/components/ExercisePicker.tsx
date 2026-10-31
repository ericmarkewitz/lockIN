import { useEffect, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Exercise, getExercises } from '../db';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
};

export function ExercisePicker({ visible, onClose, onPick }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  useEffect(() => {
    if (visible) getExercises().then(setExercises);
  }, [visible]);

  const sections = Object.entries(
    exercises.reduce<Record<string, Exercise[]>>((acc, e) => {
      (acc[e.muscle] ||= []).push(e);
      return acc;
    }, {})
  ).map(([title, data]) => ({ title, data }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <Text style={s.title}>Choose a lift</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={s.close}>Close</Text>
          </Pressable>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderSectionHeader={({ section }) => <Text style={s.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => onPick(item)}>
              <Text style={s.name}>{item.name}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  close: { fontSize: 16, fontWeight: '600', color: colors.accent },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: colors.muted, paddingTop: 16, paddingBottom: 6 },
  row: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
});
