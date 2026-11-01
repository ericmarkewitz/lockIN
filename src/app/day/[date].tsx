import { useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { WorkoutView } from '@/screens/WorkoutView';
import { useTheme } from '@/theme';

export default function Day() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const t = useTheme();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16 }}>
      <WorkoutView date={date} />
    </ScrollView>
  );
}
