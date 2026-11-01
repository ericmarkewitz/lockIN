import { Redirect } from 'expo-router';

import { isPlanComplete } from '@/data/plan';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { CalendarScreen } from '@/screens/CalendarScreen';

export default function Index() {
  const db = useDb();
  const { data: ready } = useLoad(() => isPlanComplete(db), [db]);
  if (ready === null) return null;
  return ready ? <CalendarScreen /> : <Redirect href="/setup" />;
}
