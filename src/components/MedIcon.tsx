import { View } from 'react-native';
import type { Medication } from '../domain/types';
import { useTheme } from '../theme';
import { lookOf, PillArt } from './PillArt';

/** The med's pill (or bottle, pen...) drawn in its own shape and colours, on a rounded square tinted with its accent colour. */
export function MedIcon({ med, size = 48 }: { med: Pick<Medication, 'form' | 'shape' | 'pillColor' | 'pillColor2' | 'color'>; size?: number }) {
  const c = useTheme();
  const look = lookOf(med);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: med.color + (c.dark ? '2E' : '1C'),
        borderWidth: c.dark ? 1 : 0,
        borderColor: med.color + '40',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PillArt {...look} size={size * 0.72} />
    </View>
  );
}
