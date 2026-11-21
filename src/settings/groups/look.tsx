import { View } from 'react-native';
import { Chip, Text } from '../../components/ui';
import { toggle, useSettingStyles } from '../rows';
import type { SettingsGroup } from '../types';

const APPEARANCE = [
  ['system', 'Match phone'],
  ['light', 'Light'],
  ['dark', 'Dark'],
] as const;

export const lookGroup: SettingsGroup = {
  id: 'look',
  title: 'Look and feel',
  icon: 'color-palette-outline',
  blurb: 'Light or dark, true black, confetti',
  summary: (s) => `${APPEARANCE.find(([v]) => v === s.appearance)?.[1] ?? 'Match phone'}${s.trueBlack ? ', true black' : ''}`,
  sections: [
    {
      items: [
        {
          id: 'appearance',
          title: 'Appearance',
          hint: 'Light, dark, or match the phone.',
          keywords: ['theme', 'dark mode', 'light mode', 'night', 'colour', 'color'],
          Component: function Appearance({ settings, update }) {
            const st = useSettingStyles();
            return (
              <View style={{ paddingVertical: 6 }}>
                <Text style={[st.label, { marginBottom: 8 }]}>Appearance</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {APPEARANCE.map(([v, label]) => (
                    <Chip key={v} label={label} selected={settings.appearance === v} onPress={() => update({ appearance: v })} />
                  ))}
                </View>
              </View>
            );
          },
        },
        toggle({
          id: 'trueBlack',
          title: 'True black in dark mode',
          hint: 'Pure black backgrounds. Looks great and saves battery on most Samsung screens.',
          keywords: ['amoled', 'oled', 'battery', 'theme'],
          get: (s) => s.trueBlack,
          set: (trueBlack) => ({ trueBlack }),
        }),
        toggle({
          id: 'celebrate',
          feature: 'rewards',
          title: 'Confetti when the day is done',
          hint: 'A short burst of confetti when every dose of the day is logged.',
          keywords: ['celebrate', 'animation'],
          get: (s) => s.celebrate,
          set: (celebrate) => ({ celebrate }),
        }),
      ],
    },
  ],
};
