import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import type { MedForm } from '../domain/types';
import { useTheme } from '../theme';

export const FORM_ICON: Record<MedForm, keyof typeof Ionicons.glyphMap> = {
  pill: 'medical-outline',
  capsule: 'medkit-outline',
  liquid: 'beaker-outline',
  injection: 'thermometer-outline',
  drops: 'eyedrop-outline',
  inhaler: 'cloud-outline',
  patch: 'bandage-outline',
  cream: 'color-fill-outline',
  sachet: 'bag-outline',
  other: 'ellipse-outline',
};

/** An outlined icon in a rounded square tinted with the med's colour. */
export function MedIcon({ form, color, size = 48 }: { form: MedForm; color: string; size?: number }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color + (c.dark ? '2E' : '1C'),
        borderWidth: c.dark ? 1 : 0,
        borderColor: color + '40',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={FORM_ICON[form] ?? 'medical-outline'} size={size * 0.48} color={color} />
    </View>
  );
}
