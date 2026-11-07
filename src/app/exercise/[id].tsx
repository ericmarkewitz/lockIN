import { useLocalSearchParams } from 'expo-router';

import { ExerciseScreen } from '@/screens/ExerciseScreen';

export default function Exercise() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseScreen id={Number(id)} />;
}
