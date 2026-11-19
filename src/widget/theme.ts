import type { WidgetData } from './model';

/** How the day is going decides the widget's colour: purple, green when done, gold when done all on time. */
export type Mood = 'day' | 'done' | 'gold';

export function moodOf(data: Pick<WidgetData, 'complete' | 'gold'>): Mood {
  return data.gold ? 'gold' : data.complete ? 'done' : 'day';
}

/** A colour as the widget library wants it: #RRGGBB or #RRGGBBAA. */
export type Hex = `#${string}`;

export interface MoodColors {
  bg: Hex;
  text: Hex;
  muted: Hex;
  rings: [Hex, Hex, Hex];
  track: Hex;
  trackOpacity: number;
  /** The main button (Taken) and its label. */
  button: Hex;
  onButton: Hex;
  /** The quieter button (Snooze). */
  button2: Hex;
  onButton2: Hex;
  confetti: Hex;
  /** The tick or star in the middle of the rings. */
  mark: Hex;
}

const LIGHT: Record<Mood, MoodColors> = {
  day: {
    bg: '#6A4DF4',
    text: '#FFFFFF',
    muted: '#FFFFFFC7',
    rings: ['#FFFFFF', '#B8F5D9', '#FFD98A'],
    track: '#FFFFFF',
    trackOpacity: 0.2,
    button: '#FFFFFF',
    onButton: '#5B3FE6',
    button2: '#FFFFFF2E',
    onButton2: '#FFFFFF',
    confetti: '#FFFFFF',
    mark: '#FFFFFF',
  },
  done: {
    bg: '#12A574',
    text: '#FFFFFF',
    muted: '#FFFFFFD1',
    rings: ['#FFFFFF', '#D3FAE8', '#FFE6A6'],
    track: '#FFFFFF',
    trackOpacity: 0.24,
    button: '#FFFFFF',
    onButton: '#0E8A61',
    button2: '#FFFFFF2E',
    onButton2: '#FFFFFF',
    confetti: '#FFFFFF',
    mark: '#FFFFFF',
  },
  gold: {
    bg: '#F5B63A',
    text: '#3A2600',
    muted: '#3A2600B8',
    rings: ['#FFFFFF', '#FFF4D6', '#FFE7A8'],
    track: '#FFFFFF',
    trackOpacity: 0.34,
    button: '#3A2600',
    onButton: '#FFE7A8',
    button2: '#3A26001F',
    onButton2: '#3A2600',
    confetti: '#FFFFFF',
    mark: '#5C3D00',
  },
};

const DARK: Record<Mood, MoodColors> = {
  day: {
    bg: '#2A2170',
    text: '#FFFFFF',
    muted: '#FFFFFFB3',
    rings: ['#FFFFFF', '#9DF0CB', '#FFD27A'],
    track: '#FFFFFF',
    trackOpacity: 0.16,
    button: '#FFFFFF',
    onButton: '#2A2170',
    button2: '#FFFFFF24',
    onButton2: '#FFFFFF',
    confetti: '#FFFFFF',
    mark: '#FFFFFF',
  },
  done: {
    bg: '#0D3B2D',
    text: '#E9FFF6',
    muted: '#E9FFF6B3',
    rings: ['#3DD9A0', '#9DF0CB', '#FFD27A'],
    track: '#3DD9A0',
    trackOpacity: 0.2,
    button: '#3DD9A0',
    onButton: '#062419',
    button2: '#3DD9A029',
    onButton2: '#E9FFF6',
    confetti: '#3DD9A0',
    mark: '#3DD9A0',
  },
  gold: {
    bg: '#3A2A06',
    text: '#FFE7A8',
    muted: '#FFE7A8B3',
    rings: ['#FFC94D', '#FFE29A', '#FFF3D1'],
    track: '#FFC94D',
    trackOpacity: 0.2,
    button: '#FFC94D',
    onButton: '#2A1D00',
    button2: '#FFC94D29',
    onButton2: '#FFE7A8',
    confetti: '#FFC94D',
    mark: '#FFC94D',
  },
};

export function moodColors(dark: boolean, mood: Mood): MoodColors {
  return (dark ? DARK : LIGHT)[mood];
}

/** Plain card colours for the list part of the big widget. */
export interface Surface {
  bg: Hex;
  text: Hex;
  muted: Hex;
  faint: Hex;
  primary: Hex;
  onPrimary: Hex;
  good: Hex;
  line: Hex;
}

export function surface(dark: boolean): Surface {
  return dark
    ? { bg: '#16161B', text: '#F2F2F7', muted: '#9A9AA6', faint: '#4E4E5A', primary: '#9B85FF', onPrimary: '#140F33', good: '#3DD9A0', line: '#26262D' }
    : { bg: '#FFFFFF', text: '#17162B', muted: '#6E6C86', faint: '#B9B7CC', primary: '#6A4DF4', onPrimary: '#FFFFFF', good: '#16B582', line: '#EEEDF5' };
}

export const BOLD = 'Nunito_800ExtraBold';
export const REG = 'Nunito_700Bold';
