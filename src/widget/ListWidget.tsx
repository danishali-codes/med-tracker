import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetData } from './data';

const BOLD = 'Nunito_800ExtraBold';
const REG = 'Nunito_700Bold';

// The widget library walks this tree itself: no fragments (<>), hooks or other React features.

/** The bigger widget: today's progress and every dose, with Take on the ones that are due. */
export function ListWidget({ data, dark, maxRows = 6 }: { data: WidgetData; dark: boolean; maxRows?: number }) {
  const bg = dark ? '#16141F' : '#FFFFFF';
  const text = dark ? '#F2F0FA' : '#1D1B2C';
  const muted = dark ? '#A29FB8' : '#6B6880';
  const primary = dark ? '#9B85FF' : '#6A4DF4';
  const good = dark ? '#3FD6A0' : '#16A374';
  const rows = data.rows.slice(0, maxRows);
  const more = data.rows.length - rows.length;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', borderRadius: 28, padding: 16, flexDirection: 'column', backgroundColor: bg }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent', marginBottom: 8 }}>
        <TextWidget text="Today" style={{ fontSize: 16, fontFamily: BOLD, color: text }} />
        <TextWidget text={data.total ? `${data.done} of ${data.total} · ${data.streak} day streak` : 'Nothing due today'} style={{ fontSize: 12, fontFamily: REG, color: muted }} />
      </FlexWidget>
      {rows.map((r) => (
        <FlexWidget
          key={r.slot}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent', paddingVertical: 5 }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TextWidget text={r.label} style={{ fontSize: 13, fontFamily: REG, color: muted, width: 64 }} />
            <TextWidget
              text={r.name}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 14, fontFamily: BOLD, color: r.status === 'open' ? text : muted }}
            />
          </FlexWidget>
          {r.status === 'taken' ? (
            <TextWidget text="Taken" style={{ fontSize: 13, fontFamily: BOLD, color: good }} />
          ) : r.status === 'skipped' ? (
            <TextWidget text="Skipped" style={{ fontSize: 13, fontFamily: REG, color: muted }} />
          ) : r.due ? (
            <FlexWidget
              clickAction="TAKE_SLOT"
              clickActionData={{ slot: r.slot }}
              style={{ backgroundColor: primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}
            >
              <TextWidget text="Take" style={{ fontSize: 13, fontFamily: BOLD, color: dark ? '#140F33' : '#FFFFFF' }} />
            </FlexWidget>
          ) : (
            <TextWidget text="Later" style={{ fontSize: 13, fontFamily: REG, color: muted }} />
          )}
        </FlexWidget>
      ))}
      {more > 0 ? <TextWidget text={`+${more} more`} style={{ fontSize: 12, fontFamily: REG, color: muted, marginTop: 2 }} /> : <FlexWidget style={{}} />}
    </FlexWidget>
  );
}
