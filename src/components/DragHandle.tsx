import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { useTheme } from '@/theme';

export const HANDLE_SIZE = 48;

type Props = {
  label: string;
  onStart: () => void;
  onMove: (dy: number) => void;
  /** Called with the final vertical distance when the finger lifts. */
  onEnd: (dy: number) => void;
  /** Called if the system cancels the drag; nothing should be committed. */
  onCancel: () => void;
  /** Screen-reader alternatives to dragging. */
  onMoveUp: () => void;
  onMoveDown: () => void;
};

/** A large grab area that reports vertical drags. Drag state lives in the parent. */
export function DragHandle({ label, onStart, onMove, onEnd, onCancel, onMoveUp, onMoveDown }: Props) {
  const t = useTheme();
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onActivate: () => onStart(),
    onUpdate: (e) => onMove(e.translationY),
    onDeactivate: (e) => (e.canceled ? onCancel() : onEnd(e.translationY)),
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityHint="Drag to reorder"
        accessibilityActions={[
          { name: 'moveUp', label: 'Move up' },
          { name: 'moveDown', label: 'Move down' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'moveUp') onMoveUp();
          else if (e.nativeEvent.actionName === 'moveDown') onMoveDown();
        }}
        style={styles.handle}
      >
        <Text style={{ color: t.muted, fontSize: 26, lineHeight: 28 }}>☰</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  handle: { width: HANDLE_SIZE, height: HANDLE_SIZE, alignItems: 'center', justifyContent: 'center' },
});
