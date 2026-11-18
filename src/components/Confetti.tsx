import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#6A4DF4', '#16B582', '#F29D0C', '#F04A68', '#3AB7F0', '#FF7A3D', '#C04DE8', '#FFD23F'];

/** A burst of confetti that falls once over the whole screen. Touches pass through it. */
export function Confetti({ count = 80, onDone }: { count?: number; onDone?: () => void }) {
  const { width, height } = Dimensions.get('window');
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 160,
        size: 7 + Math.random() * 7,
        round: Math.random() < 0.35,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 350,
        duration: 2200 + Math.random() * 1400,
        spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720),
      })),
    [count, width],
  );
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel(
      progress.map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          duration: pieces[i].duration,
          delay: pieces[i].delay,
          easing: Easing.bezier(0.2, 0.6, 0.4, 1),
          useNativeDriver: true,
        }),
      ),
    ).start(() => onDone?.());
  }, [progress, pieces, onDone]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const v = progress[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: -20,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
                { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.drift, p.drift * 0.6] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
