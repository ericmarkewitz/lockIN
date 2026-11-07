import { useLocalSearchParams } from 'expo-router';

import { DayScreen } from '@/screens/DayScreen';

export default function Day() {
  const { date } = useLocalSearchParams<{ date: string }>();
  return <DayScreen date={date} />;
}
