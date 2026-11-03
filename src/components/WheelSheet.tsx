import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance, type ViewStyle,
} from 'react-native';

import { wheelIndexAt } from '@/lib/wheel';
import { useTheme } from '@/theme';
import { Button } from './ui';

export const WHEEL_ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_PADDING = WHEEL_ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

export type WheelColumn = { label: string; options: (number | null)[]; value: number | null };

const display = (n: number | null) => (n === null ? '–' : String(n));

/** Haptics are a nicety: a device without them must not break the wheel. */
const tick = () => {
  Haptics.selectionAsync().catch(() => {});
};

function Wheel({ label, options, value, onChange }: WheelColumn & { onChange: (n: number | null) => void }) {
  const t = useTheme();
  const scroller = useRef<ScrollViewInstance>(null);
  // Natively only a drag may drive the selection: tapped rows set it directly,
  // and some platforms report a stray offset while applying the initial position.
  // Web is the exception, because a mouse wheel scrolls without any drag event.
  const dragging = useRef(false);
  const selected = Math.max(options.indexOf(value), 0);
  const [initialOffset] = useState({ x: 0, y: selected * WHEEL_ROW_HEIGHT });

  const select = (index: number) => {
    dragging.current = false;
    if (index !== selected) tick();
    onChange(options[index]);
    scroller.current?.scrollTo({ y: index * WHEEL_ROW_HEIGHT, animated: true });
  };

  return (
    <View style={styles.column}>
      <Text style={[styles.columnLabel, { color: t.muted }]}>{label}</Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: display(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = selected + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
          if (next >= 0 && next < options.length) select(next);
        }}
        style={styles.wheel}
      >
        <View pointerEvents="none" style={[styles.band, { backgroundColor: t.border }]} />
        <ScrollView
          ref={scroller}
          testID={`${label} wheel scroller`}
          contentOffset={initialOffset}
          contentContainerStyle={styles.wheelContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={WHEEL_ROW_HEIGHT}
          decelerationRate="fast"
          scrollEventThrottle={16}
          // react-native-web ignores contentOffset, so position again once laid out.
          onLayout={() => scroller.current?.scrollTo({ y: selected * WHEEL_ROW_HEIGHT, animated: false })}
          onScrollBeginDrag={() => { dragging.current = true; }}
          onScroll={(e) => {
            if (!dragging.current && Platform.OS !== 'web') return;
            const index = wheelIndexAt(e.nativeEvent.contentOffset.y, WHEEL_ROW_HEIGHT, options.length);
            if (index === selected) return;
            tick();
            onChange(options[index]);
          }}
        >
          {options.map((n, i) => {
            const distance = Math.abs(i - selected);
            return (
              <Pressable key={n ?? 'blank'} onPress={() => select(i)} style={styles.row}>
                <Text
                  style={[
                    styles.rowText,
                    { color: distance === 0 ? t.text : t.muted, opacity: Math.max(1 - distance * 0.3, 0.25) },
                    distance === 0 && styles.rowTextSelected,
                  ]}
                >
                  {display(n)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function SheetBody({
  title, columns, onDone, onCancel,
}: { title: string; columns: WheelColumn[]; onDone: (values: (number | null)[]) => void; onCancel: () => void }) {
  const t = useTheme();
  const [values, setValues] = useState(() => columns.map((c) => c.value));
  return (
    <View style={styles.root}>
      <Pressable testID="wheel-backdrop" accessible={false} onPress={onCancel} style={styles.backdrop} />
      <View style={[styles.sheet, { backgroundColor: t.card }]}>
        <View style={styles.header}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>{title}</Text>
          <Button title="Done" onPress={() => onDone(values)} />
        </View>
        <View style={styles.columns}>
          {columns.map((c, i) => (
            <Wheel
              key={c.label}
              {...c}
              value={values[i]}
              onChange={(n) => setValues((prev) => prev.map((v, j) => (j === i ? n : v)))}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * A bottom sheet of number wheels, like an alarm clock's time picker. Nothing
 * is returned until Done. The body remounts on each open, so it starts from
 * the current `columns` values.
 */
export function WheelSheet({
  visible, title, columns, onDone, onCancel,
}: {
  visible: boolean; title: string; columns: WheelColumn[];
  onDone: (values: (number | null)[]) => void; onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <SheetBody title={title} columns={columns} onDone={onDone} onCancel={onCancel} />
    </Modal>
  );
}

/** A field that shows `text` and opens a WheelSheet when tapped. */
export function WheelButton({
  label, valueText, text, muted, title, columns, onDone, style,
}: {
  label: string; valueText: string; text: string; muted?: boolean; title: string; columns: WheelColumn[];
  onDone: (values: (number | null)[]) => void; style?: ViewStyle;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: valueText }}
        onPress={() => setOpen(true)}
        style={[styles.button, { borderColor: t.border, backgroundColor: t.bg }, style]}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.buttonText, { color: muted ? t.muted : t.text }]}>{text}</Text>
      </Pressable>
      <WheelSheet
        visible={open}
        title={title}
        columns={columns}
        onCancel={() => setOpen(false)}
        onDone={(values) => {
          setOpen(false);
          onDone(values);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, textAlign: 'center' },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  columns: { flexDirection: 'row', gap: 16 },
  column: { flex: 1, gap: 4 },
  columnLabel: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  wheel: { height: WHEEL_ROW_HEIGHT * VISIBLE_ROWS, overflow: 'hidden' },
  wheelContent: { paddingVertical: WHEEL_PADDING },
  band: { position: 'absolute', left: 0, right: 0, top: WHEEL_PADDING, height: WHEEL_ROW_HEIGHT, borderRadius: 10 },
  row: { height: WHEEL_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontSize: 22, fontVariant: ['tabular-nums'] },
  rowTextSelected: { fontWeight: '700' },
});
