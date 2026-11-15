import { useLocalSearchParams } from 'expo-router';

import { WorkoutMode } from '@/screens/WorkoutMode';

export default function Workout() {
  const { date } = useLocalSearchParams<{ date: string }>();
  return <WorkoutMode date={date} />;
}
