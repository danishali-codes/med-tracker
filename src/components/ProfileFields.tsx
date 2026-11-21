import { View } from 'react-native';
import { CONDITIONS, type ConditionId, type DiabetesType, type HealthProfile, type MedsPerDay } from '../domain/features';
import { makeStyles } from '../theme';
import { Chip, Text } from './ui';

const DIABETES_TYPES: { id: DiabetesType; label: string }[] = [
  { id: 'type1', label: 'Type 1' },
  { id: 'type2', label: 'Type 2' },
  { id: 'gestational', label: 'Gestational' },
  { id: 'other', label: 'Other or not sure' },
];

export const MEDS_PER_DAY: { id: MedsPerDay; label: string }[] = [
  { id: 'none', label: 'None right now' },
  { id: '1-2', label: '1 to 2' },
  { id: '3-5', label: '3 to 5' },
  { id: '6+', label: '6 or more' },
];

export const TIMES_PER_DAY: { id: 1 | 2 | 3 | 4; label: string }[] = [
  { id: 1, label: 'Once' },
  { id: 2, label: 'Twice' },
  { id: 3, label: '3 times' },
  { id: 4, label: '4 or more' },
];

/** Conditions, with the diabetes follow-up questions when diabetes is picked. */
export function ConditionFields({ profile, onChange }: { profile: HealthProfile; onChange: (p: HealthProfile) => void }) {
  const s = useStyles();
  const has = (id: ConditionId) => profile.conditions.includes(id);
  const flip = (id: ConditionId) => {
    const conditions = has(id) ? profile.conditions.filter((c) => c !== id) : [...profile.conditions, id];
    const diabetic = conditions.includes('diabetes');
    onChange({ ...profile, conditions, diabetesType: diabetic ? profile.diabetesType : null, insulin: diabetic ? profile.insulin : null });
  };
  return (
    <>
      <View style={s.chips}>
        {CONDITIONS.map((c) => (
          <Chip key={c.id} label={c.label} selected={has(c.id)} onPress={() => flip(c.id)} />
        ))}
      </View>
      {has('diabetes') ? (
        <>
          <Text style={s.label}>Which type?</Text>
          <View style={s.chips}>
            {DIABETES_TYPES.map((t) => (
              <Chip key={t.id} label={t.label} selected={profile.diabetesType === t.id} onPress={() => onChange({ ...profile, diabetesType: t.id })} />
            ))}
          </View>
          <Text style={s.label}>Do you use insulin?</Text>
          <View style={s.chips}>
            <Chip label="Yes" selected={profile.insulin === true} onPress={() => onChange({ ...profile, insulin: true })} />
            <Chip label="No" selected={profile.insulin === false} onPress={() => onChange({ ...profile, insulin: false })} />
          </View>
        </>
      ) : null}
    </>
  );
}

/** How many medicines, and how many times a day. */
export function MedicineFields({ profile, onChange }: { profile: HealthProfile; onChange: (p: HealthProfile) => void }) {
  const s = useStyles();
  return (
    <>
      <Text style={s.label}>How many medicines do you take each day?</Text>
      <View style={s.chips}>
        {MEDS_PER_DAY.map((m) => (
          <Chip key={m.id} label={m.label} selected={profile.medsPerDay === m.id} onPress={() => onChange({ ...profile, medsPerDay: m.id })} />
        ))}
      </View>
      {profile.medsPerDay && profile.medsPerDay !== 'none' ? (
        <>
          <Text style={s.label}>How many times a day do you take them?</Text>
          <View style={s.chips}>
            {TIMES_PER_DAY.map((t) => (
              <Chip key={t.id} label={t.label} selected={profile.timesPerDay === t.id} onPress={() => onChange({ ...profile, timesPerDay: t.id })} />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((c) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { fontSize: 15, color: c.text, fontWeight: '800', marginTop: 14, marginBottom: 6 },
}));
