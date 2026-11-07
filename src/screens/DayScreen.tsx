import { ScrollView } from 'react-native';

import { KeyboardAvoider, keyboardScrollProps } from '@/components/KeyboardAvoider';
import { useTheme } from '@/theme';
import { WorkoutView } from './WorkoutView';

export function DayScreen({ date }: { date: string }) {
  const t = useTheme();
  return (
    <KeyboardAvoider>
      <ScrollView
        testID="day-scroll"
        {...keyboardScrollProps}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: t.bg }}
        contentContainerStyle={{ padding: 16 }}
      >
        <WorkoutView date={date} />
      </ScrollView>
    </KeyboardAvoider>
  );
}
