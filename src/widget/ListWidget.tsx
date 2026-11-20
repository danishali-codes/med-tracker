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
  header = HEADER,
  week = false,
}: {
  data: WidgetData;
  dark: boolean;
  maxRows?: number;
  width?: number;
  /** Header height; taller when the rows leave room. */
  header?: number;
  /** Show this week's days under the doses (the tallest sizes). */
  week?: boolean;
}) {
  const ring = Math.min(header - 24, Math.round(width * 0.36));
  const legendFont = header >= 130 ? 13 : 12;
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
      <OverlapWidget style={{ width: 'match_parent', height: header, borderRadius: 20, backgroundColor: c.bg }}>
        {Confetti({ data, mood, c, width: width - 16, height: header })}
        <FlexWidget style={{ width: 'match_parent', height: header, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
          <RingBadge data={data} mood={mood} c={c} size={ring} />
          <FlexWidget style={{ flex: 1, marginLeft: 14, flexDirection: 'column', justifyContent: 'center' }}>
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <TextWidget text={data.complete ? doneTitle(mood, width < 300 || ring > 90) : 'Today'} maxLines={1} style={{ fontSize: header >= 130 ? 18 : 16, fontFamily: BOLD, color: c.text }} />
              <FlexWidget style={{ flex: 1 }} />
              {Streak({ data, c, size: 12 })}
            </FlexWidget>
            <Legend color={c.rings[0]} label="Doses" value={data.total ? `${data.done} of ${data.total}` : 'None due'} c={c} font={legendFont} />
            <Legend color={c.rings[1]} label="On time" value={data.taken ? `${data.onTime} of ${data.taken}` : '–'} c={c} font={legendFont} />
            <Legend color={c.rings[2]} label="This week" value={data.week == null ? '–' : `${Math.round(data.week * 100)}%`} c={c} font={legendFont} />
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
      {week ? <Week data={data} s={s} /> : null}
    </FlexWidget>
  );
}

/** This week, Monday first: a dot per day, green when every dose was taken and gold when all were on time. */
function Week({ data, s }: { data: WidgetData; s: Surface }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 6, paddingTop: 4 }}>
      {data.days.map((d) => {
        const fill = d.mark === 'gold' ? GOLD : d.mark === 'complete' ? s.good : d.mark === 'partial' ? s.primary : null;
        return (
          <FlexWidget key={d.date} style={{ flex: 1, flexDirection: 'column', alignItems: 'center' }}>
            <TextWidget text={d.letter} style={{ fontSize: 11, fontFamily: d.today ? BOLD : REG, color: d.today ? s.text : s.muted }} />
            <FlexWidget
              style={{
                width: 26,
                height: 26,
                marginTop: 4,
                borderRadius: 13,
                backgroundColor: fill ?? (d.mark === 'missed' ? MISSED : s.line),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {d.mark === 'gold' || d.mark === 'complete' ? (
                <SvgWidget svg={checkSvg(14, '#FFFFFF')} style={{ width: 14, height: 14 }} />
              ) : (
                <TextWidget text={String(Number(d.date.slice(8, 10)))} style={{ fontSize: 10, fontFamily: BOLD, color: fill ? '#FFFFFF' : d.mark === 'missed' ? '#FFFFFF' : s.muted }} />
              )}
            </FlexWidget>
          </FlexWidget>
        );
      })}
    </FlexWidget>
  );
}

const GOLD = '#F2A93B' as Hex;
const MISSED = '#E5566F' as Hex;

function Legend({ color, label, value, c, font = 12 }: { color: Hex; label: string; value: string; c: MoodColors; font?: number }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
      <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
      <TextWidget text={label} maxLines={1} style={{ fontSize: font, fontFamily: REG, color: c.muted }} />
      <FlexWidget style={{ flex: 1 }} />
      <TextWidget text={value} maxLines={1} style={{ fontSize: font, fontFamily: BOLD, color: c.text }} />
    </FlexWidget>
  );
}

function Row({ r, s, dark }: { r: WidgetRow; s: Surface; dark: boolean }) {
  const open = r.status === 'open';
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', paddingVertical: 4 }}>
      <SvgWidget svg={pillSvg(r.pill, 22)} style={{ width: 22, height: 22, marginRight: 8 }} />
      <TextWidget text={r.label} maxLines={1} style={{ fontSize: 12, fontFamily: REG, color: s.muted, width: 64 }} />
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
