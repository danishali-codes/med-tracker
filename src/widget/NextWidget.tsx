'use no memo';
import { FlexWidget, OverlapWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetData } from './model';
import { Actions, BOLD, Confetti, doneLine, doneTitle, nextKicker, Pills, REG, RingBadge, Streak } from './parts';
import { moodColors, moodOf } from './theme';

// The widget library walks this tree itself: no fragments (<>), hooks or other React features.

/**
 * The small widget: just the next dose with Taken and Snooze. About 2 x 2 it's a
 * square; squashed to one row high it becomes a strip.
 */
export function NextWidget({ data, dark, width = 160, height = 160 }: { data: WidgetData; dark: boolean; width?: number; height?: number }) {
  return height < 100 ? <NextStrip data={data} dark={dark} width={width} height={height} /> : <NextSquare data={data} dark={dark} width={width} height={height} />;
}

function NextSquare({ data, dark, width, height }: { data: WidgetData; dark: boolean; width: number; height: number }) {
  const mood = moodOf(data);
  const c = moodColors(dark, mood);
  const next = data.next;
  const roomy = height >= 140;
  // The rings take whatever height the text below doesn't need (with headroom for bigger
  // system text), so a tall or roomy widget isn't a small icon in an empty box.
  const below = data.complete ? 48 : !next ? 46 : next.due ? 104 : 66;
  // Tall and narrow: the streak sits on its own line and the rings are centred in the space above the text.
  const tall = height >= width * 1.4 && height >= 200;
  const ring = Math.min(width - 28 - (data.streak > 0 && !tall ? 34 : 0), height - 28 - Math.round(below * 1.15) - (tall ? 28 : 6), 140);
  const showRing = ring >= 30 && (roomy || data.complete);
  return (
    <OverlapWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', borderRadius: 26, backgroundColor: c.bg }}>
      {Confetti({ data, mood, c, width, height })}
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', padding: 14, flexDirection: 'column' }}>
        {tall ? (
          <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'column' }}>
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'flex-end', height: 20 }}>
              {Streak({ data, c, size: 12 })}
            </FlexWidget>
            <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <RingBadge data={data} mood={mood} c={c} size={Math.max(30, ring)} />
            </FlexWidget>
          </FlexWidget>
        ) : (
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
            {showRing ? <RingBadge data={data} mood={mood} c={c} size={Math.max(30, ring)} /> : Pills({ data, size: 20 })}
            <FlexWidget style={{ flex: 1 }} />
            {Streak({ data, c, size: 12 })}
          </FlexWidget>
        )}
        {tall ? null : <FlexWidget style={{ flex: 1 }} />}
        {data.complete ? (
          <FlexWidget style={{ flexDirection: 'column' }}>
            <TextWidget text={doneTitle(mood, true)} maxLines={1} style={{ fontSize: 20, fontFamily: BOLD, color: c.text }} />
            <TextWidget text={doneLine(data, mood)} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: REG, color: c.muted }} />
          </FlexWidget>
        ) : next ? (
          <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
            <TextWidget text={nextKicker(data)} maxLines={1} style={{ fontSize: 10, fontFamily: REG, color: c.muted, letterSpacing: 0.08 }} />
            <TextWidget text={next.label} maxLines={1} style={{ fontSize: 21, fontFamily: BOLD, color: c.text }} />
            {!roomy && next.due ? (
              <FlexWidget style={{ height: 6 }} />
            ) : (
              <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: next.due ? 8 : 0 }}>
                {roomy ? Pills({ data, size: 16 }) : null}
                <TextWidget text={next.names} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: REG, color: c.muted, marginLeft: roomy ? 2 : 0 }} />
              </FlexWidget>
            )}
            {Actions({ data, c, compact: true, fill: true, takeOnly: width < 140 })}
          </FlexWidget>
        ) : (
          <FlexWidget style={{ flexDirection: 'column' }}>
            <TextWidget text="Nothing today" maxLines={1} style={{ fontSize: 18, fontFamily: BOLD, color: c.text }} />
            <TextWidget text="No doses due" maxLines={1} style={{ fontSize: 12, fontFamily: REG, color: c.muted }} />
          </FlexWidget>
        )}
      </FlexWidget>
    </OverlapWidget>
  );
}

function NextStrip({ data, dark, width, height }: { data: WidgetData; dark: boolean; width: number; height: number }) {
  const mood = moodOf(data);
  const c = moodColors(dark, mood);
  const next = data.next;
  const ring = Math.max(30, Math.min(48, height - 20));
  const title = data.complete ? doneTitle(mood, true) : next ? next.label : 'Nothing today';
  const sub = data.complete ? doneLine(data, mood) : next
      ? `${next.snoozedUntil ? `Snoozed till ${next.snoozedUntil}` : next.due ? 'Due now' : 'Next'} · ${next.names}`
      : 'No doses due';
  return (
    <OverlapWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', borderRadius: 999, backgroundColor: c.bg }}>
      {Confetti({ data, mood, c, width, height })}
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', paddingVertical: 8, paddingLeft: 10, paddingRight: 10, flexDirection: 'row', alignItems: 'center' }}>
        <RingBadge data={data} mood={mood} c={c} size={ring} />
        <FlexWidget style={{ flex: 1, marginLeft: 10, marginRight: 8, flexDirection: 'column', justifyContent: 'center' }}>
          <TextWidget text={title} maxLines={1} style={{ fontSize: 16, fontFamily: BOLD, color: c.text }} />
          <TextWidget text={sub} maxLines={1} truncate="END" style={{ fontSize: 11, fontFamily: REG, color: c.muted }} />
        </FlexWidget>
        {width >= 230 ? Actions({ data, c, compact: true }) : null}
        {width < 230 && next && next.due ? (
          <FlexWidget
            clickAction="TAKE_NEXT"
            clickActionData={{ time: next.time }}
            style={{ backgroundColor: c.button, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}
          >
            <TextWidget text="Taken" style={{ fontSize: 13, fontFamily: BOLD, color: c.onButton }} />
          </FlexWidget>
        ) : null}
      </FlexWidget>
    </OverlapWidget>
  );
}
