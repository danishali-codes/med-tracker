import { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';

export interface Palette {
  dark: boolean;
  bg: string;
  card: string;
  /** Slightly raised surface inside a card (inputs, tags). */
  sunken: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  good: string;
  goodSoft: string;
  warn: string;
  warnSoft: string;
  bad: string;
  badSoft: string;
  flame: string;
  ice: string;
  /** Hero gradient. */
  hero: [string, string, string];
  /** Today's three rings: doses, on time, this week. */
  rings: [string, string, string];
  shadow: string;
  tabBar: string;
}

export const light: Palette = {
  dark: false,
  bg: '#F3F2FA',
  card: '#FFFFFF',
  sunken: '#F2F1F8',
  text: '#17162B',
  muted: '#6E6C86',
  faint: '#B9B7CC',
  border: '#E7E5F1',
  primary: '#6A4DF4',
  primarySoft: '#EEEAFF',
  onPrimary: '#FFFFFF',
  good: '#16B582',
  goodSoft: '#DDF7EC',
  warn: '#F29D0C',
  warnSoft: '#FFF1D6',
  bad: '#F04A68',
  badSoft: '#FFE3E9',
  flame: '#FF7A3D',
  ice: '#3AB7F0',
  hero: ['#6A4DF4', '#9B4DE8', '#F0689B'],
  rings: ['#FFFFFF', '#B8F5D9', '#FFD98A'],
  shadow: '#4A3AA8',
  tabBar: '#FFFFFF',
};

export const dark: Palette = {
  dark: true,
  bg: '#0D0C17',
  card: '#1A1928',
  sunken: '#232235',
  text: '#F3F2FB',
  muted: '#A19FBA',
  faint: '#55536E',
  border: '#2B2A40',
  primary: '#9B85FF',
  primarySoft: '#2A2550',
  onPrimary: '#140F33',
  good: '#3DD9A0',
  goodSoft: '#173A30',
  warn: '#FFB940',
  warnSoft: '#3B2E14',
  bad: '#FF6B85',
  badSoft: '#3D1A24',
  flame: '#FF8A50',
  ice: '#5CC8FF',
  hero: ['#4B32C9', '#7B33C0', '#C84B83'],
  rings: ['#FFFFFF', '#9DF0CB', '#FFD27A'],
  shadow: '#000000',
  tabBar: '#1A1928',
};

export const ThemeContext = createContext<Palette>(light);

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/** Builds a themed StyleSheet once per palette; use the returned hook inside components. */
type Styles = Parameters<typeof StyleSheet.create>[0];

export function makeStyles<T extends Styles>(fn: (c: Palette) => T & Styles): () => Readonly<T> {
  const cache = new Map<Palette, Readonly<T>>();
  return function useStyles() {
    const c = useTheme();
    return useMemo(() => {
      let s = cache.get(c);
      if (!s) {
        s = StyleSheet.create(fn(c));
        cache.set(c, s);
      }
      return s as Readonly<T>;
    }, [c]);
  };
}

export const radius = { card: 28, button: 18, input: 16, chip: 999, tile: 22 };

export const FONT = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const MED_COLORS = ['#6A4DF4', '#16B582', '#F29D0C', '#F04A68', '#3AB7F0', '#FF7A3D', '#C04DE8', '#64708A'];

export const FORM_EMOJI: Record<string, string> = {
  pill: '💊',
  capsule: '💊',
  liquid: '🧴',
  injection: '💉',
  drops: '💧',
  inhaler: '🌬️',
  patch: '🩹',
  cream: '🧴',
  sachet: '🥄',
  other: '✳️',
};
