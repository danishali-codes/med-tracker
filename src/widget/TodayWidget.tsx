import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetData } from './data';

const BOLD = 'Nunito_800ExtraBold';
const REG = 'Nunito_700Bold';

// The widget library walks this tree itself: no fragments (<>), hooks or other React features.

/** Home screen widget: today's progress, streak and the next dose, with a Take button when it's due. */
export function TodayWidget({ data, dark }: { data: WidgetData; dark: boolean }) {
  const allDone = data.total > 0 && data.done === data.total;
  const from = dark ? '#342887' : '#6A4DF4';
  const to = dark ? '#3A2D93' : '#7457F5';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: 28,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundGradient: { from, to, orientation: 'TL_BR' },
      }}
    >
      <FlexWidget style={{ flexDirection: 'column', justifyContent: 'center' }}>
        <TextWidget text="TODAY" style={{ fontSize: 11, fontFamily: REG, color: '#FFFFFFCC', letterSpacing: 0.1 }} />
        <TextWidget
          text={data.total ? `${data.done}/${data.total}` : '–'}
          style={{ fontSize: 34, fontFamily: BOLD, color: '#FFFFFF' }}
        />
        <TextWidget text={`${data.streak} day streak`} style={{ fontSize: 12, fontFamily: REG, color: '#FFFFFFE6' }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
        {allDone ? (
          <TextWidget text="All done" style={{ fontSize: 16, fontFamily: BOLD, color: '#FFFFFF' }} />
        ) : data.next ? (
          <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
            <TextWidget text={data.next.due ? 'DUE NOW' : 'NEXT'} style={{ fontSize: 11, fontFamily: REG, color: '#FFFFFFCC' }} />
            <TextWidget text={data.next.label} style={{ fontSize: 18, fontFamily: BOLD, color: '#FFFFFF' }} />
            <TextWidget text={data.next.names} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: REG, color: '#FFFFFFE6' }} />
            {data.next.due ? (
              <FlexWidget
                clickAction="TAKE_NEXT"
                clickActionData={{ time: data.next.time }}
                style={{ marginTop: 6, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}
              >
                <TextWidget text="Take" style={{ fontSize: 14, fontFamily: BOLD, color: from }} />
              </FlexWidget>
            ) : null}
          </FlexWidget>
        ) : (
          <TextWidget text="Nothing due" style={{ fontSize: 15, fontFamily: BOLD, color: '#FFFFFF' }} />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
