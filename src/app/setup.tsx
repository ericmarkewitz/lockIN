import { useCanGoBack, useRouter } from 'expo-router';

import { PlanEditor } from '@/screens/PlanEditor';

export default function Setup() {
  const router = useRouter();
  // Opened from the calendar: return to it. First run has nothing behind it, so land on the calendar.
  const canGoBack = useCanGoBack();
  return (
    <PlanEditor
      onSaved={() => (canGoBack ? router.back() : router.replace('/'))}
      onCancel={canGoBack ? () => router.back() : undefined}
    />
  );
}
