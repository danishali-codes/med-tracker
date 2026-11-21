import { CONDITIONS, featuresHere } from '../../domain/features';
import { setFeature } from '../features';
import { platform } from '../render';
import { link, toggle } from '../rows';
import type { SettingItem, SettingsGroup } from '../types';

const featureToggles: SettingItem[] = featuresHere(platform.android).map((f) =>
  toggle({
    id: `feature-${f.id}`,
    title: f.title,
    hint: f.hint,
    keywords: ['feature', 'module', 'turn on', 'enable', ...f.keywords],
    androidOnly: f.androidOnly,
    get: (s) => s.features[f.id],
    set: (on, s) => ({ features: { ...s.features, [f.id]: on } }),
    handle: async (on) => setFeature(f.id, on),
  }),
);

export const featuresGroup: SettingsGroup = {
  id: 'features',
  title: 'Features and health profile',
  icon: 'apps-outline',
  blurb: 'Choose which parts of Sabr you use',
  summary: (s) => {
    const on = featuresHere(platform.android).filter((f) => s.features[f.id]).length;
    return `${on} ${on === 1 ? 'feature' : 'features'} on`;
  },
  sections: [
    {
      items: [
        link({
          id: 'healthProfile',
          icon: 'person-circle-outline',
          title: 'Health profile',
          hint: 'Your conditions and medicines, so Sabr can suggest the right features. Stays on this phone.',
          keywords: ['conditions', 'diabetes', 'blood pressure', 'profile', 'about me'],
          href: '/profile',
          summary: (s) => {
            const names = s.profile.conditions.map((c) => CONDITIONS.find((x) => x.id === c)?.label).filter(Boolean);
            return names.length ? names.join(', ') : 'Nothing added';
          },
        }),
        link({
          id: 'runSetup',
          icon: 'refresh-outline',
          title: 'Run setup again',
          hint: 'Go through the first-run questions again. Nothing you saved is removed.',
          keywords: ['onboarding', 'welcome', 'start over', 'setup'],
          href: '/setup',
        }),
      ],
    },
    {
      title: 'Features',
      items: featureToggles,
    },
  ],
};
