import { View } from 'react-native';
import { canUseAppLock, unlockWithDevice } from '../../components/AppLock';
import { popup } from '../../components/Popup';
import { Button, Text } from '../../components/ui';
import { clearDownloads } from '../../drugs/online';
import { choice, toggle, useSettingStyles } from '../rows';
import type { SettingsGroup } from '../types';

function OnlineSources() {
  const st = useSettingStyles();
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[st.hint, { marginTop: 2 }]}>When it's on, two free public services are used, and only a medicine name is sent to them:</Text>
      <Text style={st.hint}>
        {'•'} US National Library of Medicine (RxNav): the list of medicine names, downloaded once a month, so what you type in search stays on the phone.
        When you pick a medicine, its name is sent to look up the ingredient and strengths.
      </Text>
      <Text style={st.hint}>{'•'} US FDA (openFDA): when you open the interaction check, the active ingredient of each medicine is sent to read its official label.</Text>
      <Text style={st.hint}>Like any website, they can see your phone's internet address when it asks.</Text>
    </View>
  );
}

export const privacyGroup: SettingsGroup = {
  id: 'privacy',
  title: 'Privacy and security',
  icon: 'shield-checkmark-outline',
  blurb: 'App lock, medicine names, online search',
  summary: (s) => [s.appLock ? 'App lock on' : null, s.onlineLookups ? 'Online search on' : 'Offline search'].filter(Boolean).join(' · '),
  sections: [
    {
      title: 'Privacy',
      items: [
        {
          id: 'privacyNote',
          title: 'How Sabr keeps things private',
          hint: 'No accounts, ads, analytics or crash reports.',
          keywords: ['data', 'tracking', 'analytics', 'ads', 'share'],
          Component: function Note() {
            const st = useSettingStyles();
            return (
              <Text style={[st.hint, { marginBottom: 4 }]}>
                Everything that could share anything is off until you turn it on. There are no accounts, ads, analytics or crash reports, and your doses,
                times and history never leave this phone.
              </Text>
            );
          },
        },
        toggle({
          id: 'onlineLookups',
          title: 'Online medicine search',
          hint: 'Search more names and strengths, and read official drug labels for the interaction check.',
          keywords: ['internet', 'network', 'rxnav', 'openfda', 'fda', 'lookup', 'offline', 'interactions'],
          get: (s) => s.onlineLookups,
          set: (onlineLookups) => ({ onlineLookups }),
          liveHint: (s) =>
            s.onlineLookups
              ? 'On. Search finds many more names and strengths, and the interaction check reads official US drug labels.'
              : 'Off. The app never goes online. Search and the interaction check use only the built-in list.',
          after: () => <OnlineSources />,
        }),
        toggle({
          id: 'showMedNames',
          title: 'Show medicine names in reminders',
          hint: 'Name your medicines in reminders, refill alerts and on your watch.',
          keywords: ['lock screen', 'notification', 'hide names', 'private', 'watch'],
          get: (s) => s.showMedNames,
          set: (showMedNames) => ({ showMedNames }),
          liveHint: (s) =>
            s.showMedNames
              ? "On. Reminders and refill alerts name your medicines, also on a paired watch. On the lock screen they're hidden if your phone hides sensitive notification content."
              : 'Off. Reminders say "Time for your medicine" with the time and how many, everywhere, including the lock screen and your watch.',
        }),
        {
          id: 'clearDownloads',
          title: 'Delete downloaded medicine info',
          hint: 'Removes medicine names and labels downloaded by online search.',
          keywords: ['cache', 'clear', 'storage', 'remove'],
          advanced: true,
          Component: () => (
            <Button
              title="Delete downloaded medicine info"
              kind="secondary"
              onPress={() => {
                const n = clearDownloads();
                popup('Deleted', n ? 'Downloaded medicine names and labels were removed from this phone.' : 'Nothing was downloaded yet.');
              }}
              style={{ marginTop: 10 }}
            />
          ),
        },
      ],
    },
    {
      title: 'Security',
      items: [
        toggle({
          id: 'appLock',
          title: 'App lock',
          hint: "Ask for your fingerprint, face or phone PIN to open Sabr. Reminders and their buttons still work while it's locked.",
          keywords: ['fingerprint', 'face', 'pin', 'biometric', 'password', 'lock'],
          get: (s) => s.appLock,
          set: (appLock) => ({ appLock }),
          handle: async (v, { update }) => {
            if (!v) {
              // Turning it off needs the owner, so someone holding the unlocked phone can't.
              if (await unlockWithDevice('Turn off the app lock')) update({ appLock: false });
              return;
            }
            if (!(await canUseAppLock())) {
              popup(
                'Set up a screen lock first',
                "Your phone has no fingerprint, face or PIN set up, so there's nothing to unlock the app with. Add one in your phone's settings, then try again.",
              );
              return;
            }
            if (await unlockWithDevice("Confirm it's you")) update({ appLock: true });
          },
        }),
        choice({
          id: 'lockAfterMinutes',
          title: 'Lock again after',
          hint: 'How long Sabr can be in the background before it asks again.',
          keywords: ['timeout', 'lock', 'background'],
          advanced: true,
          visible: (s) => s.appLock,
          options: [0, 1, 5, 15],
          suffix: 'min',
          get: (s) => s.lockAfterMinutes,
          set: (lockAfterMinutes) => ({ lockAfterMinutes }),
        }),
        toggle({
          id: 'hideInRecents',
          title: 'Hide in recent apps',
          hint: 'Shows a blank screen in the app switcher. This also blocks screenshots of the app.',
          keywords: ['screenshot', 'app switcher', 'recents', 'multitasking', 'blank'],
          advanced: true,
          get: (s) => s.hideInRecents,
          set: (hideInRecents) => ({ hideInRecents }),
        }),
      ],
    },
  ],
};
