import { ScrollView, Text } from 'react-native';

import { ExerciseDetail } from '@/components/ExerciseDetail';
import { findExercise } from '@/data/exercises';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { useTheme } from '@/theme';

export function ExerciseScreen({ id }: { id: number }) {
  const db = useDb();
  const t = useTheme();
  const { data } = useLoad(async () => ({ exercise: await findExercise(db, id) }), [db, id]);
  if (!data) return null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }}>
      {data.exercise
        ? <ExerciseDetail exercise={data.exercise} />
        : <Text style={{ color: t.muted, padding: 16 }}>Exercise not found.</Text>}
    </ScrollView>
  );
}
