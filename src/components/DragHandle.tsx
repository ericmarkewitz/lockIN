import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, type NativeGesture } from 'react-native-gesture-handler';

import { useTheme } from '@/theme';
import { Icon, sym } from './Icon';

export const HANDLE_SIZE = 48;

type Props = {
  label: string;
  /** Identifies the drag gesture in tests. */
  testID?: string;
  /**
   * The surrounding scroll view's gesture. Holding the handle stops it from scrolling, so the
   * screen doesn't have to toggle `scrollEnabled` (which makes iOS jump a large-title page).
   */
  blocks?: NativeGesture | null;
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
export function DragHandle({ label, testID, blocks, onStart, onMove, onEnd, onCancel, onMoveUp, onMoveDown }: Props) {
  const t = useTheme();
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    testID,
    block: blocks ?? undefined,
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
        <Icon name={sym('line.3.horizontal', 'drag_indicator')} size={18} color={t.muted} fallback="☰" />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  handle: { width: HANDLE_SIZE, height: HANDLE_SIZE, alignItems: 'center', justifyContent: 'center' },
});
