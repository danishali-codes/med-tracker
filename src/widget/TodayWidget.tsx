'use no memo';
import { FlexWidget, OverlapWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetData } from './model';
import { Actions, BOLD, Confetti, doneLine, doneTitle, nextKicker, Pills, REG, RingBadge, Streak } from './parts';
import { moodColors, moodOf } from './theme';

// The widget library walks this tree itself: no fragments (<>), hooks or other React features.

/**
 * The default widget (about 4 x 2): today's rings on the left, the next dose with
 * Taken and Snooze on the right. It turns green when the day is done, and gold when
 * every dose was on time, with a scatter of little pills.
 */
export function TodayWidget({ data, dark, width = 320, height = 150 }: { data: WidgetData; dark: boolean; width?: number; height?: number }) {
  const mood = moodOf(data);
  const c = moodColors(dark, mood);
  const next = data.next;
  // Short widgets get less padding and drop the medicine line when the buttons need the room.
  const short = height < 135;
  const pad = short ? 12 : 16;
  // The rings fill the height, up to a bit under half the width so the text keeps its room.
  const ring = Math.max(64, Math.min(Math.round(height - pad * 2), Math.round(width * 0.4), 168));
  const big = height >= 160 && width >= 300;
  const due = !!next?.due;
  return (
    <OverlapWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', borderRadius: 26, backgroundColor: c.bg }}>
      {Confetti({ data, mood, c, width, height })}
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', padding: pad, flexDirection: 'row', alignItems: 'center' }}>
        <RingBadge data={data} mood={mood} c={c} size={ring} />
        <FlexWidget style={{ flex: 1, height: 'match_parent', marginLeft: big ? 20 : 14, flexDirection: 'column', justifyContent: 'center' }}>
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
            <TextWidget text={data.complete ? 'TODAY' : nextKicker(data)} maxLines={1} style={{ fontSize: 11, fontFamily: REG, color: c.muted, letterSpacing: 0.08 }} />
            <FlexWidget style={{ flex: 1 }} />
            {Streak({ data, c, size: 12 })}
          </FlexWidget>
          {data.complete ? (
            <FlexWidget style={{ flexDirection: 'column' }}>
              <TextWidget text={doneTitle(mood, true)} maxLines={1} truncate="END" style={{ fontSize: big ? 22 : 20, fontFamily: BOLD, color: c.text, marginTop: 2 }} />
              <TextWidget text={doneLine(data, mood)} maxLines={1} truncate="END" style={{ fontSize: 13, fontFamily: REG, color: c.muted, marginTop: 2 }} />
              {data.streak > 1 ? (
                <TextWidget
                  text={`${data.streak} days in a row`}
                  maxLines={1}
                  style={{ fontSize: 13, fontFamily: REG, color: c.muted, marginTop: 1 }}
                />
              ) : null}
            </FlexWidget>
          ) : next ? (
            <FlexWidget style={{ flexDirection: 'column' }}>
              <TextWidget text={next.label} maxLines={1} style={{ fontSize: big ? 28 : 24, fontFamily: BOLD, color: c.text, marginBottom: short && due ? 6 : 0 }} />
              {short && due ? null : (
                <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: due ? 10 : 0 }}>
                  {Pills({ data, size: big ? 20 : 18 })}
                  <TextWidget text={next.names} maxLines={1} truncate="END" style={{ fontSize: big ? 14 : 13, fontFamily: REG, color: c.muted, marginLeft: 3 }} />
                </FlexWidget>
              )}
              {Actions({ data, c, fill: true })}
            </FlexWidget>
          ) : (
            <FlexWidget style={{ flexDirection: 'column' }}>
              <TextWidget text="Nothing due today" maxLines={1} style={{ fontSize: 18, fontFamily: BOLD, color: c.text, marginTop: 2 }} />
              <TextWidget text="No doses scheduled" maxLines={1} style={{ fontSize: 13, fontFamily: REG, color: c.muted, marginTop: 2 }} />
            </FlexWidget>
          )}
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}
