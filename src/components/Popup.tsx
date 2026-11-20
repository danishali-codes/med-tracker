import { useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { makeStyles, radius } from '../theme';
import { Button, Text } from './ui';

export interface PopupButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface PopupState {
  id: number;
  title: string;
  message?: string;
  buttons: PopupButton[];
}

// One popup at a time; any that come while one is open wait their turn.
let queue: PopupState[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Shows a popup in Sabr's own style. Same arguments as React Native's Alert.alert, so the
 * system dialog never shows. With no buttons it gets a single OK.
 */
export function popup(title: string, message?: string, buttons?: PopupButton[]) {
  queue = [...queue, { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] }];
  emit();
}

/** Asks a yes/no question and resolves true when the person picks the confirm button. */
export function confirm(title: string, message: string | undefined, confirmText: string, opts: { destructive?: boolean; cancelText?: string } = {}) {
  return new Promise<boolean>((resolve) => {
    popup(title, message, [
      { text: opts.cancelText ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

function close(p: PopupState, b?: PopupButton) {
  queue = queue.filter((q) => q.id !== p.id);
  emit();
  b?.onPress?.();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const current = () => queue[0] ?? null;

/** Renders the open popup. Mounted once, near the top of the app. */
export function PopupHost() {
  const p = useSyncExternalStore(subscribe, current, current);
  const s = useStyles();
  if (!p) return null;
  const cancel = p.buttons.find((b) => b.style === 'cancel');
  // Back and tapping outside act like Cancel. A popup without one closes that way only when it has a single button.
  const dismiss = cancel ?? (p.buttons.length === 1 ? p.buttons[0] : null);
  const stacked = p.buttons.length > 2 || p.buttons.some((b) => b.text.length > 14);
  // The main action sits last (right, or at the bottom when stacked), Cancel first.
  const ordered = [...p.buttons.filter((b) => b.style === 'cancel'), ...p.buttons.filter((b) => b.style !== 'cancel')];
  const main = ordered[ordered.length - 1];
  return (
    <Modal
      key={p.id}
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={() => {
        if (dismiss) close(p, dismiss);
      }}
    >
      <Pressable style={s.backdrop} onPress={() => {
        if (dismiss) close(p, dismiss);
      }} accessibilityLabel={dismiss ? 'Close' : undefined}>
        <Pressable style={s.card} accessibilityRole="alert">
          <ScrollView bounces={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text style={s.title}>{p.title}</Text>
            {p.message ? <Text style={s.message}>{p.message}</Text> : null}
          </ScrollView>
          <View style={[s.buttons, stacked && s.stacked]}>
            {(stacked ? [...ordered].reverse() : ordered).map((b, i) => (
              <Button
                key={`${b.text}-${i}`}
                title={b.text}
                small
                kind={b.style === 'destructive' ? 'danger' : b === main ? 'primary' : b.style === 'cancel' ? 'ghost' : 'secondary'}
                onPress={() => close(p, b)}
                style={stacked ? { alignSelf: 'stretch' } : { flexGrow: 1 }}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: 22,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: c.dark ? 1 : 0,
    borderColor: c.border,
  },
  title: { fontSize: 20, fontWeight: '900', color: c.text, letterSpacing: -0.2 },
  message: { fontSize: 15, fontWeight: '600', color: c.muted, marginTop: 8, lineHeight: 21 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  stacked: { flexDirection: 'column' },
}));
