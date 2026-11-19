import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FONT, makeStyles, radius, useTheme } from '../theme';

const FAMILY: Record<string, string> = {
  normal: FONT.regular,
  '400': FONT.regular,
  '500': FONT.semibold,
  '600': FONT.semibold,
  '700': FONT.bold,
  bold: FONT.bold,
  '800': FONT.extrabold,
  '900': FONT.black,
};

/** Text in the app font. fontWeight picks the matching Nunito weight. */
export function Text({ style, ...props }: TextProps) {
  const c = useTheme();
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};
  const family = FAMILY[String(flat.fontWeight ?? '400')] ?? FONT.regular;
  return <RNText {...props} style={[{ color: c.text, fontFamily: family }, style, { fontWeight: undefined }]} />;
}

/** Pressable that springs down slightly when touched. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic,
  onPress,
  ...props
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable
      {...props}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  small,
  disabled,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}) {
  const c = useTheme();
  const s = useStyles();
  const bg = { primary: c.primary, secondary: c.primarySoft, danger: c.badSoft, ghost: 'transparent' }[kind];
  const fg = { primary: c.onPrimary, secondary: c.primary, danger: c.bad, ghost: c.primary }[kind];
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[s.button, small && s.buttonSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, kind === 'primary' && !small && s.buttonShadow, style]}
    >
      {icon}
      <Text style={[s.buttonText, small && s.buttonTextSmall, { color: fg }]}>{title}</Text>
    </PressableScale>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress?: () => void; color?: string }) {
  const c = useTheme();
  const s = useStyles();
  return (
    <PressableScale onPress={onPress} haptic style={[s.chip, selected && { backgroundColor: color ?? c.primary, borderColor: color ?? c.primary }]}>
      <Text style={[s.chipText, selected && { color: c.onPrimary, fontWeight: '700' }]}>{label}</Text>
    </PressableScale>
  );
}

export function Field({ label, children, hint, style }: { label: string; children: ReactNode; hint?: string; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <View style={[s.field, style]}>
      <Text style={s.label}>{label}</Text>
      {children}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const c = useTheme();
  const s = useStyles();
  return <TextInput placeholderTextColor={c.faint} {...props} style={[s.input, props.style]} />;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** One animated progress ring. */
export function Ring({
  value,
  total,
  size = 120,
  stroke = 12,
  color,
  track,
  children,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const c = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : Math.min(1, value / total);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, anim]);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.sunken} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? (pct >= 1 ? c.good : c.primary)}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Three nested rings, outermost first. */
export function Rings({
  rings,
  size = 150,
  stroke = 14,
  gap = 4,
  track,
  children,
}: {
  rings: { value: number; total: number; color: string }[];
  size?: number;
  stroke?: number;
  gap?: number;
  track: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r, i) => {
        const s = size - i * 2 * (stroke + gap);
        return (
          <View key={i} style={{ position: 'absolute' }}>
            <Ring value={r.value} total={r.total} size={s} stroke={stroke} color={r.color} track={track} />
          </View>
        );
      })}
      {children}
    </View>
  );
}

export function Dot({ color, size = 12 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Fades and slides its children in when first shown. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: 18,
    marginBottom: 14,
    shadowColor: c.shadow,
    shadowOpacity: c.dark ? 0 : 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: c.dark ? 0 : 2,
    borderWidth: c.dark ? 1 : 0,
    borderColor: c.border,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: c.text },
  button: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonShadow: { shadowColor: c.primary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  buttonSmall: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.chip },
  buttonText: { fontSize: 16, fontWeight: '800' },
  buttonTextSmall: { fontSize: 14 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 14, color: c.text, fontWeight: '600' },
  field: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '800', color: c.text, marginBottom: 8, marginLeft: 4 },
  hint: { fontSize: 12, color: c.muted, marginTop: 6, marginLeft: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: c.text,
    backgroundColor: c.card,
    fontFamily: 'Nunito_600SemiBold',
  },
}));
