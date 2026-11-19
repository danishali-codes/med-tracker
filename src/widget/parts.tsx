'use no memo';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetData } from './model';
import { checkSvg, confettiSvg, flameSvg, pillSvg, ringsSvg, starSvg } from './svg';
import { BOLD, REG, type Mood, type MoodColors } from './theme';

// The widget library walks this tree itself. Plain function components are fine, but
// no fragments (<>), hooks or other React features, and a component must never
// return null: the ones below that can be empty are called as functions instead,
// like {Streak({ data, c })}.

/** Today's three rings (doses, on time, this week) with the count, a tick or a star in the middle. */
export function RingBadge({ data, mood, c, size }: { data: WidgetData; mood: Mood; c: MoodColors; size: number }) {
  const stroke = Math.max(5, Math.round(size * 0.1));
  const gap = Math.max(2, Math.round(size * 0.03));
  const svg = ringsSvg({
    size,
    stroke,
    gap,
    track: c.track,
    trackOpacity: c.trackOpacity,
    rings: [
      { pct: data.total ? data.done / data.total : 0, color: c.rings[0] },
      { pct: data.taken ? data.onTime / data.taken : 0, color: c.rings[1] },
      { pct: data.week ?? 0, color: c.rings[2] },
    ],
  });
  const inner = size - 6 * stroke - 4 * gap;
  const mark = Math.max(12, Math.round(inner * 0.62));
  return (
    <OverlapWidget style={{ width: size, height: size }}>
      <SvgWidget svg={svg} style={{ width: size, height: size }} />
      <FlexWidget style={{ width: size, height: size, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {mood === 'gold' ? (
          <SvgWidget svg={starSvg(mark, c.mark)} style={{ width: mark, height: mark }} />
        ) : mood === 'done' ? (
          <SvgWidget svg={checkSvg(mark, c.mark)} style={{ width: mark, height: mark }} />
        ) : size >= 64 && data.total ? (
          <TextWidget text={`${data.done}/${data.total}`} style={{ fontSize: Math.round(size * 0.16), fontFamily: BOLD, color: c.text }} />
        ) : null}
      </FlexWidget>
    </OverlapWidget>
  );
}

/** Scattered pills over a finished day. Nothing on other days. */
export function Confetti({ data, mood, c, width, height }: { data: WidgetData; mood: Mood; c: MoodColors; width: number; height: number }) {
  if (mood === 'day' || width <= 0 || height <= 0) return null;
  const count = Math.max(8, Math.min(22, Math.round((width * height) / 2600)));
  return <SvgWidget svg={confettiSvg(Math.round(width), Math.round(height), data.date, c.confetti, count)} style={{ width: 'match_parent', height: 'match_parent' }} />;
}

export function Streak({ data, c, size = 12 }: { data: WidgetData; c: MoodColors; size?: number }) {
  if (data.streak <= 0) return null;
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
      <SvgWidget svg={flameSvg(size + 2, c.text)} style={{ width: size + 2, height: size + 2 }} />
      <TextWidget text={` ${data.streak}`} style={{ fontSize: size, fontFamily: BOLD, color: c.text }} />
    </FlexWidget>
  );
}

/** Up to three little pill drawings in a row. */
export function Pills({ data, size }: { data: WidgetData; size: number }) {
  if (!data.next || data.next.pills.length === 0) return null;
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
      {data.next.pills.map((p, i) => (
        <SvgWidget key={i} svg={pillSvg(p, size)} style={{ width: size, height: size, marginRight: 2 }} />
      ))}
    </FlexWidget>
  );
}

/** Taken and Snooze for the next dose. Snooze hides while a snooze is already running. */
export function Actions({ data, c, compact = false, fill = false }: { data: WidgetData; c: MoodColors; compact?: boolean; fill?: boolean }) {
  const next = data.next;
  if (!next || !next.due) return null;
  const pad = compact ? 6 : 7;
  const font = compact ? 13 : 14;
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', ...(fill ? { width: 'match_parent' } : {}) }}>
      <FlexWidget
        clickAction="TAKE_NEXT"
        clickActionData={{ time: next.time }}
        style={{
          backgroundColor: c.button,
          borderRadius: 999,
          paddingVertical: pad,
          paddingHorizontal: 14,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          ...(fill ? { flex: 1 } : {}),
        }}
      >
        <TextWidget text="Taken" style={{ fontSize: font, fontFamily: BOLD, color: c.onButton }} />
      </FlexWidget>
      {next.snoozedUntil ? null : (
        <FlexWidget
          clickAction="SNOOZE_NEXT"
          clickActionData={{ time: next.time }}
          style={{
            backgroundColor: c.button2,
            borderRadius: 999,
            paddingVertical: pad,
            paddingHorizontal: 12,
            marginLeft: 6,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            ...(fill ? { flex: 1 } : {}),
          }}
        >
          <TextWidget text="Snooze" style={{ fontSize: font, fontFamily: BOLD, color: c.onButton2 }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

/** The small caps line above the next dose. */
export function nextKicker(data: WidgetData): string {
  const next = data.next;
  if (!next) return 'TODAY';
  if (next.snoozedUntil) return `SNOOZED TILL ${next.snoozedUntil}`;
  return next.due ? 'DUE NOW' : 'NEXT';
}

/** What a finished day says. */
export function doneTitle(mood: Mood, short = false): string {
  if (mood === 'gold') return short ? 'Perfect day' : 'Perfect day';
  return short ? 'All done' : 'All done for today';
}

export function doneLine(data: WidgetData, mood: Mood): string {
  if (mood === 'gold') return data.taken === 1 ? 'Taken on time' : `All ${data.taken} on time`;
  const skipped = data.done - data.taken;
  return skipped > 0 ? `${data.taken} taken, ${skipped} skipped` : data.done === 1 ? '1 dose taken' : `${data.done} doses taken`;
}

export { REG, BOLD };
