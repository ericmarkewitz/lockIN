import { useState } from 'react';
import { ScrollView } from 'react-native';

import { KeyboardAvoider, keyboardScrollProps } from '@/components/KeyboardAvoider';
import { useTheme } from '@/theme';
import { WorkoutView } from './WorkoutView';

export function DayScreen({ date }: { date: string }) {
  const t = useTheme();
  // Dragging an exercise card must not scroll the day under the finger.
  const [dragging, setDragging] = useState(false);
  return (
    <KeyboardAvoider>
      <ScrollView
        testID="day-scroll"
        {...keyboardScrollProps}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: t.bg }}
        contentContainerStyle={{ padding: 16 }}
      >
        <WorkoutView date={date} onDragChange={setDragging} />
      </ScrollView>
    </KeyboardAvoider>
  );
}
