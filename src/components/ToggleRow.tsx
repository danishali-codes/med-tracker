import { Switch, View } from 'react-native';
import { makeStyles, useTheme } from '../theme';
import { Text } from './ui';

export function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useTheme();
  const st = useRowStyles();
  return (
    <View style={[st.row, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{label}</Text>
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.primary }} />
    </View>
  );
}

export const useRowStyles = makeStyles((c) => ({
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 28, padding: 18, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  label: { fontSize: 15, color: c.text, fontWeight: '800' },
  hint: { fontSize: 13, color: c.muted, marginTop: 2, fontWeight: '600', lineHeight: 18 },
}));
