import { useRouter } from 'expo-router';

import { PlanEditor } from '@/screens/PlanEditor';

export default function Setup() {
  const router = useRouter();
  return <PlanEditor onSaved={() => router.replace('/')} />;
}
