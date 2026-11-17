import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, SectionTitle } from '../../components/ui';
import { DECOR, DEFAULT_FLOOR, DEFAULT_WALL, decorById, ROOM_SLOTS, type DecorKind, type RoomSlot } from '../../domain/decor';
import { COINS } from '../../domain/progress';
import * as repo from '../../db/repo';
import { useDbVersion, useProgress } from '../../hooks/useData';
import { colors } from '../../theme';

const SHOP_TABS: { kind: DecorKind; label: string }[] = [
  { kind: 'floor', label: 'Furniture' },
  { kind: 'wall', label: 'Wall' },
  { kind: 'wallpaper', label: 'Wallpaper' },
  { kind: 'flooring', label: 'Floor' },
];

export default function RoomScreen() {
  const { coins, purchases, badges, progress } = useProgress();
  const version = useDbVersion();
  const placements = useMemo(() => repo.getPlacements(), [version]);
  const wallpaper = useMemo(() => repo.getKv('wallpaper'), [version]);
  const flooring = useMemo(() => repo.getKv('flooring'), [version]);
  const owned = new Set(purchases.map((p) => p.itemId));
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState<RoomSlot | null>(null);
  const [tab, setTab] = useState<DecorKind>('floor');

  const wall = (wallpaper && decorById(wallpaper)?.color) || DEFAULT_WALL;
  const floor = (flooring && decorById(flooring)?.color) || DEFAULT_FLOOR;
  const placedItems = new Set(placements.values());

  const buy = (id: string) => {
    const item = decorById(id);
    if (!item) return;
    if (coins < item.price) {
      Alert.alert('Not enough coins yet', `You need ${item.price - coins} more. Every dose you take earns coins.`);
      return;
    }
    repo.buy(item.id, item.price);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (item.kind === 'wallpaper') repo.setKv('wallpaper', item.id);
    else if (item.kind === 'flooring') repo.setKv('flooring', item.id);
    else {
      const free = ROOM_SLOTS.find((s) => s.kind === item.kind && !placements.has(s.id));
      if (free) repo.place(free.id, item.id);
    }
  };

  const unplaced = (kind: 'wall' | 'floor') => DECOR.filter((d) => d.kind === kind && owned.has(d.id) && !placedItems.has(d.id));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={st.coinsRow}>
        <Text style={st.coins}>🪙 {coins}</Text>
        <Button title={editing ? 'Done' : 'Arrange'} kind="secondary" small onPress={() => { setEditing(!editing); setSlot(null); }} />
      </View>

      <View style={st.room}>
        <View style={[st.wall, { backgroundColor: wall }]} />
        <View style={[st.floor, { backgroundColor: floor }]} />
        {ROOM_SLOTS.map((s) => {
          const itemId = placements.get(s.id);
          const item = itemId ? decorById(itemId) : undefined;
          if (!item && !editing) return null;
          return (
            <Pressable
              key={s.id}
              disabled={!editing}
              onPress={() => setSlot(s)}
              style={[st.slot, { left: `${s.x}%`, top: `${s.y}%` }, editing && st.slotEditing, slot?.id === s.id && st.slotSelected]}
            >
              <Text style={st.slotEmoji}>{item ? item.emoji : '+'}</Text>
            </Pressable>
          );
        })}
        {placements.size === 0 && !editing ? (
          <View style={st.emptyRoom}>
            <Text style={st.emptyText}>Your room is empty. Take your meds to earn coins, then decorate it!</Text>
          </View>
        ) : null}
      </View>

      {editing && slot ? (
        <Card>
          <Text style={st.pickTitle}>Put something here</Text>
          <View style={st.wrap}>
            {unplaced(slot.kind).map((d) => (
              <Pressable key={d.id} style={st.pickItem} onPress={() => { repo.place(slot.id, d.id); setSlot(null); }}>
                <Text style={{ fontSize: 30 }}>{d.emoji}</Text>
              </Pressable>
            ))}
            {unplaced(slot.kind).length === 0 ? <Text style={st.muted}>Nothing spare for the {slot.kind}. Buy more in the shop.</Text> : null}
          </View>
          {placements.has(slot.id) ? (
            <Button title="Clear this spot" kind="ghost" small onPress={() => { repo.place(slot.id, null); setSlot(null); }} style={{ alignSelf: 'flex-start' }} />
          ) : null}
        </Card>
      ) : null}

      <SectionTitle>Shop</SectionTitle>
      <View style={st.wrap}>
        {SHOP_TABS.map((t) => (
          <Chip key={t.kind} label={t.label} selected={tab === t.kind} onPress={() => setTab(t.kind)} />
        ))}
      </View>
      <View style={st.shop}>
        {DECOR.filter((d) => d.kind === tab).map((d) => {
          const has = owned.has(d.id);
          const inUse = (d.kind === 'wallpaper' && wallpaper === d.id) || (d.kind === 'flooring' && flooring === d.id);
          const isTheme = d.kind === 'wallpaper' || d.kind === 'flooring';
          return (
            <View key={d.id} style={st.shopItem}>
              {d.emoji ? <Text style={st.shopEmoji}>{d.emoji}</Text> : <View style={[st.swatch, { backgroundColor: d.color }]} />}
              <Text style={st.shopName} numberOfLines={1}>
                {d.name}
              </Text>
              {!has ? (
                <Button title={`🪙 ${d.price}`} small kind={coins >= d.price ? 'primary' : 'secondary'} onPress={() => buy(d.id)} />
              ) : isTheme ? (
                <Button
                  title={inUse ? 'In use' : 'Use'}
                  small
                  kind="secondary"
                  disabled={inUse}
                  onPress={() => repo.setKv(d.kind, d.id)}
                />
              ) : (
                <Text style={st.ownedText}>Owned</Text>
              )}
            </View>
          );
        })}
        {tab === 'wallpaper' || tab === 'flooring' ? (
          <View style={st.shopItem}>
            <View style={[st.swatch, { backgroundColor: tab === 'wallpaper' ? DEFAULT_WALL : DEFAULT_FLOOR }]} />
            <Text style={st.shopName}>Original</Text>
            <Button title="Use" small kind="secondary" onPress={() => repo.setKv(tab, '')} />
          </View>
        ) : null}
      </View>
      <Text style={st.muted}>
        Earn {COINS.onTime} coins for each dose on time, {COINS.late} for a late one, {COINS.perfectDay} for a perfect day, and bonuses at 7, 30
        and 100-day streaks.
      </Text>

      <SectionTitle>Badges</SectionTitle>
      <View style={st.badges}>
        {badges.map((b) => (
          <View key={b.id} style={[st.badge, !b.has && { opacity: 0.35 }]}>
            <Text style={st.badgeEmoji}>{b.has ? b.emoji : '🔒'}</Text>
            <Text style={st.badgeName}>{b.name}</Text>
            <Text style={st.badgeDesc}>{b.description}</Text>
          </View>
        ))}
      </View>

      <SectionTitle>Your record</SectionTitle>
      <Card>
        <Row label="Current streak" value={`${progress.currentStreak} days`} />
        <Row label="Best streak" value={`${progress.bestStreak} days`} />
        <Row label="Perfect days" value={`${progress.perfectDays}`} />
        <Row label="Doses taken" value={`${progress.totalTaken}`} />
        <Row label="Taken on time" value={`${progress.totalOnTime}`} />
      </Card>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  coinsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  coins: { fontSize: 24, fontWeight: '800', color: colors.coin },
  room: { width: '100%', aspectRatio: 1, borderRadius: 20, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  wall: { position: 'absolute', left: 0, right: 0, top: 0, height: '58%' },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  slot: { position: 'absolute', width: 60, height: 60, marginLeft: -30, marginTop: -30, alignItems: 'center', justifyContent: 'center', borderRadius: 30 },
  slotEditing: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.25)' },
  slotSelected: { borderColor: colors.primary, backgroundColor: 'rgba(59,111,224,0.15)' },
  slotEmoji: { fontSize: 40, color: 'rgba(0,0,0,0.35)' },
  emptyRoom: { position: 'absolute', left: 24, right: 24, top: '36%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 12, padding: 12 },
  emptyText: { textAlign: 'center', color: colors.text, fontSize: 14 },
  pickTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  pickItem: { padding: 6, marginRight: 6, borderRadius: 10, backgroundColor: colors.bg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  shop: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  shopItem: { width: '31%', backgroundColor: colors.card, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  shopEmoji: { fontSize: 34 },
  swatch: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  shopName: { fontSize: 12, color: colors.text, textAlign: 'center' },
  ownedText: { fontSize: 13, color: colors.good, fontWeight: '600', paddingVertical: 7 },
  muted: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  badge: { width: '31%', backgroundColor: colors.card, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  badgeEmoji: { fontSize: 28 },
  badgeName: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 4 },
  badgeDesc: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 2 },
});
