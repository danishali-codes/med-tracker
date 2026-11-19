'use no memo';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetData, WidgetRow } from './model';
import { BOLD, Confetti, doneTitle, REG, RingBadge, Streak } from './parts';
import { checkSvg, pillSvg } from './svg';
import { moodColors, moodOf, surface, type Hex, type MoodColors, type Surface } from './theme';

// The widget library walks this tree itself: no fragments (<>), hooks or other React features.

const HEADER = 104;

/**
 * The big widget: a coloured header with the rings and what each one means, then
 * every dose today with Take on the ones that are due.
 */
export function ListWidget({
  data,
  dark,
  maxRows = 6,
  width = 320,
}: {
  data: WidgetData;
  dark: boolean;
  maxRows?: number;
  width?: number;
}) {
  const mood = moodOf(data);
  const c = moodColors(dark, mood);
  const s = surface(dark);
  const rows = data.rows.slice(0, maxRows);
  const more = data.rows.length - rows.length;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', borderRadius: 26, padding: 8, flexDirection: 'column', backgroundColor: s.bg }}
    >
      <OverlapWidget style={{ width: 'match_parent', height: HEADER, borderRadius: 20, backgroundColor: c.bg }}>
        {Confetti({ data, mood, c, width: width - 16, height: HEADER })}
        <FlexWidget style={{ width: 'match_parent', height: HEADER, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
          <RingBadge data={data} mood={mood} c={c} size={76} />
          <FlexWidget style={{ flex: 1, marginLeft: 14, flexDirection: 'column', justifyContent: 'center' }}>
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <TextWidget text={data.complete ? doneTitle(mood, width < 300) : 'Today'} maxLines={1} style={{ fontSize: 16, fontFamily: BOLD, color: c.text }} />
              <FlexWidget style={{ flex: 1 }} />
              {Streak({ data, c, size: 12 })}
            </FlexWidget>
            <Legend color={c.rings[0]} label="Doses" value={data.total ? `${data.done} of ${data.total}` : 'None due'} c={c} />
            <Legend color={c.rings[1]} label="On time" value={data.taken ? `${data.onTime} of ${data.taken}` : '–'} c={c} />
            <Legend color={c.rings[2]} label="This week" value={data.week == null ? '–' : `${Math.round(data.week * 100)}%`} c={c} />
          </FlexWidget>
        </FlexWidget>
      </OverlapWidget>
      <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'column', paddingHorizontal: 8, paddingTop: 6 }}>
        {rows.length === 0 ? (
          <TextWidget text="Nothing due today" style={{ fontSize: 14, fontFamily: REG, color: s.muted, marginTop: 8 }} />
        ) : null}
        {rows.map((r) => (
          <Row key={r.slot} r={r} s={s} dark={dark} />
        ))}
        {more > 0 ? <TextWidget text={`+${more} more`} style={{ fontSize: 12, fontFamily: REG, color: s.muted, marginTop: 2 }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Legend({ color, label, value, c }: { color: Hex; label: string; value: string; c: MoodColors }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
      <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
      <TextWidget text={label} maxLines={1} style={{ fontSize: 12, fontFamily: REG, color: c.muted }} />
      <FlexWidget style={{ flex: 1 }} />
      <TextWidget text={value} maxLines={1} style={{ fontSize: 12, fontFamily: BOLD, color: c.text }} />
    </FlexWidget>
  );
}

function Row({ r, s, dark }: { r: WidgetRow; s: Surface; dark: boolean }) {
  const open = r.status === 'open';
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', paddingVertical: 4 }}>
      <SvgWidget svg={pillSvg(r.pill, 22)} style={{ width: 22, height: 22, marginRight: 8 }} />
      <TextWidget text={r.label} maxLines={1} style={{ fontSize: 12, fontFamily: REG, color: s.muted, width: 58 }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: BOLD, color: open ? s.text : s.muted }} />
        {r.detail ? <TextWidget text={r.detail} maxLines={1} truncate="END" style={{ fontSize: 11, fontFamily: REG, color: s.muted }} /> : null}
      </FlexWidget>
      {r.status === 'taken' ? (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SvgWidget svg={checkSvg(14, s.good)} style={{ width: 14, height: 14, marginRight: 3 }} />
          <TextWidget text="Taken" style={{ fontSize: 13, fontFamily: BOLD, color: s.good }} />
        </FlexWidget>
      ) : r.status === 'skipped' ? (
        <TextWidget text="Skipped" style={{ fontSize: 13, fontFamily: REG, color: s.muted }} />
      ) : r.due ? (
        <FlexWidget
          clickAction="TAKE_SLOT"
          clickActionData={{ slot: r.slot }}
          style={{ backgroundColor: s.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 }}
        >
          <TextWidget text="Take" style={{ fontSize: 13, fontFamily: BOLD, color: dark ? s.onPrimary : '#FFFFFF' }} />
        </FlexWidget>
      ) : (
        <TextWidget text="Later" style={{ fontSize: 13, fontFamily: REG, color: s.faint }} />
      )}
    </FlexWidget>
  );
}
