import { useState } from 'react';
import { ConditionFields, MedicineFields } from '../components/ProfileFields';
import { PageScroll } from '../components/Screen';
import { Card, SectionTitle, Text } from '../components/ui';
import { featureInfo, suggestedFeatures, type HealthProfile } from '../domain/features';
import { useSettings } from '../hooks/useData';
import { setFeature } from '../settings/features';
import { updateSettings, useSettingStyles } from '../settings/rows';
import { useTheme } from '../theme';
import { popup } from '../components/Popup';

/** The health profile: conditions and medicines. Kept on this phone, never shared. */
export default function ProfileScreen() {
  const c = useTheme();
  const st = useSettingStyles();
  const settings = useSettings();
  const [profile, setProfile] = useState<HealthProfile>(settings.profile);

  const change = (next: HealthProfile) => {
    const added = next.conditions.filter((x) => !profile.conditions.includes(x));
    setProfile(next);
    updateSettings({ profile: next });
    // A newly added condition can suggest a feature that is still off.
    const offer = suggestedFeatures(added).filter((f) => !settings.features[f] && featureInfo(f).available);
    for (const f of offer) {
      const info = featureInfo(f);
      popup(`Turn on ${info.title}?`, info.hint, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Turn on', onPress: () => setFeature(f, true) },
      ]);
    }
  };

  return (
    <PageScroll contentContainerStyle={{ padding: 16 }}>
      <Text style={[st.hint, { marginHorizontal: 6, marginBottom: 12 }]}>
        This helps Sabr suggest the right features. It stays on this phone and in your encrypted backups. It is never shared, and never shown in reminders
        or reports.
      </Text>
      <SectionTitle>Conditions</SectionTitle>
      <Card>
        <ConditionFields profile={profile} onChange={change} />
        {profile.conditions.length === 0 ? <Text style={[st.hint, { marginTop: 8, color: c.muted }]}>Nothing added.</Text> : null}
      </Card>
      <SectionTitle>Medicines</SectionTitle>
      <Card>
        <MedicineFields profile={profile} onChange={change} />
      </Card>
    </PageScroll>
  );
}
