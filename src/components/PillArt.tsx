import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import type { MedForm, PillShape } from '../domain/types';
import { hasShape } from './pillLook';

/** Shapes offered for tablets and capsules. */
export const PILL_SHAPES: { id: PillShape; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'oval', label: 'Oval' },
  { id: 'oblong', label: 'Oblong' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'square', label: 'Square' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'triangle', label: 'Triangle' },
];

/** Colours real pills come in. The first is plain white. */
export const PILL_COLORS = ['#FFFFFF', '#F3E9D2', '#FBE37A', '#F7A541', '#F49AB6', '#E5484D', '#9CC9F5', '#3E7BE0', '#6CC58C', '#8B5E3C', '#A98BE8', '#9AA1AD'];

export { defaultShape, hasShape, lookOf } from './pillLook';

const OUTLINE = 'rgba(0,0,0,0.28)';
const LINE = 'rgba(0,0,0,0.18)';
const SHINE = 'rgba(255,255,255,0.45)';

/**
 * A small drawing of the medicine: the pill in its shape and colours, or the
 * container (bottle, pen, inhaler...) for other forms.
 */
export function PillArt({ form, shape, color, color2, size = 40 }: { form: MedForm; shape: PillShape; color: string; color2?: string | null; size?: number }) {
  const sw = 1.6;
  const common = { stroke: OUTLINE, strokeWidth: sw };
  let body: React.ReactElement;
  if (hasShape(form)) {
    switch (shape) {
      case 'oval':
        body = (
          <G>
            <Ellipse cx={24} cy={24} rx={19} ry={13} fill={color} {...common} />
            <Line x1={12} y1={24} x2={36} y2={24} stroke={LINE} strokeWidth={1.4} />
          </G>
        );
        break;
      case 'oblong':
        body = (
          <G transform="rotate(-30 24 24)">
            <Rect x={5} y={15} width={38} height={18} rx={9} fill={color} {...common} />
            <Line x1={24} y1={18} x2={24} y2={30} stroke={LINE} strokeWidth={1.4} />
          </G>
        );
        break;
      case 'capsule':
        body = (
          <G transform="rotate(-35 24 24)">
            <Path d="M24 15 H14 A9 9 0 0 0 14 33 H24 Z" fill={color} {...common} />
            <Path d="M24 15 H34 A9 9 0 0 1 34 33 H24 Z" fill={color2 ?? color} {...common} />
            <Rect x={11} y={18} width={9} height={3} rx={1.5} fill={SHINE} />
          </G>
        );
        break;
      case 'square':
        body = (
          <G>
            <Rect x={9} y={9} width={30} height={30} rx={7} fill={color} {...common} />
            <Line x1={24} y1={14} x2={24} y2={34} stroke={LINE} strokeWidth={1.4} />
          </G>
        );
        break;
      case 'diamond':
        body = <Path d="M24 5 Q26 5 27.5 7 L41 22 Q42.5 24 41 26 L27.5 41 Q26 43 24 43 Q22 43 20.5 41 L7 26 Q5.5 24 7 22 L20.5 7 Q22 5 24 5 Z" fill={color} {...common} />;
        break;
      case 'triangle':
        body = <Path d="M24 7 Q26.5 7 28 9.5 L42 35 Q43.5 38.5 39.5 39.5 H8.5 Q4.5 38.5 6 35 L20 9.5 Q21.5 7 24 7 Z" fill={color} {...common} />;
        break;
      default:
        body = (
          <G>
            <Circle cx={24} cy={24} r={16} fill={color} {...common} />
            <Line x1={13} y1={24} x2={35} y2={24} stroke={LINE} strokeWidth={1.4} />
          </G>
        );
    }
  } else {
    body = <Container form={form} color={color} />;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {body}
    </Svg>
  );
}

function Container({ form, color }: { form: MedForm; color: string }) {
  const common = { stroke: OUTLINE, strokeWidth: 1.6 };
  switch (form) {
    case 'liquid':
      return (
        <G>
          <Rect x={18} y={5} width={12} height={7} rx={2} fill="#E8E8EC" {...common} />
          <Path d="M17 12 H31 V16 Q37 18 37 24 V40 Q37 43 34 43 H14 Q11 43 11 40 V24 Q11 18 17 16 Z" fill={color} {...common} />
          <Rect x={15} y={26} width={18} height={10} rx={2} fill="rgba(255,255,255,0.75)" />
        </G>
      );
    case 'injection':
      return (
        <G transform="rotate(-45 24 24)">
          <Rect x={8} y={19} width={24} height={10} rx={2} fill={color} {...common} />
          <Rect x={32} y={21.5} width={5} height={5} fill="#D9DCE3" {...common} />
          <Line x1={37} y1={24} x2={45} y2={24} stroke={OUTLINE} strokeWidth={1.6} />
          <Rect x={3} y={17} width={5} height={14} rx={1.5} fill="#D9DCE3" {...common} />
        </G>
      );
    case 'drops':
      return (
        <G>
          <Path d="M24 4 L28 12 H20 Z" fill="#E8E8EC" {...common} />
          <Rect x={19} y={12} width={10} height={6} rx={1.5} fill="#E8E8EC" {...common} />
          <Rect x={13} y={18} width={22} height={25} rx={5} fill={color} {...common} />
          <Path d="M24 25 Q28 30 28 33 A4 4 0 0 1 20 33 Q20 30 24 25 Z" fill="rgba(255,255,255,0.75)" />
        </G>
      );
    case 'inhaler':
      return (
        <G>
          <Rect x={17} y={4} width={14} height={26} rx={4} fill={color} {...common} />
          <Path d="M13 26 H31 Q35 26 35 30 V36 H44 V44 H17 Q13 44 13 40 Z" fill="#D9DCE3" {...common} />
        </G>
      );
    case 'spray':
      return (
        <G>
          <Rect x={20} y={3} width={8} height={10} rx={3} fill="#E8E8EC" {...common} />
          <Rect x={15} y={13} width={18} height={6} rx={2} fill="#D9DCE3" {...common} />
          <Rect x={13} y={19} width={22} height={25} rx={6} fill={color} {...common} />
          <Rect x={17} y={26} width={14} height={10} rx={2} fill="rgba(255,255,255,0.7)" />
        </G>
      );
    case 'patch':
      return (
        <G>
          <Rect x={7} y={7} width={34} height={34} rx={8} fill={color} {...common} />
          <Rect x={15} y={15} width={18} height={18} rx={4} fill="rgba(255,255,255,0.6)" />
        </G>
      );
    case 'cream':
      return (
        <G transform="rotate(-30 24 24)">
          <Path d="M8 16 H32 L36 20 V28 L32 32 H8 Z" fill={color} {...common} />
          <Rect x={36} y={20.5} width={6} height={7} rx={1.5} fill="#E8E8EC" {...common} />
          <Line x1={11} y1={16} x2={11} y2={32} stroke={LINE} strokeWidth={1.4} />
        </G>
      );
    case 'sachet':
      return (
        <G>
          <Path d="M10 8 L14 11 L18 8 L22 11 L26 8 L30 11 L34 8 L38 11 V40 Q38 42 36 42 H12 Q10 42 10 40 Z" fill={color} {...common} />
          <Rect x={15} y={22} width={18} height={10} rx={2} fill="rgba(255,255,255,0.7)" />
        </G>
      );
    default:
      return <Circle cx={24} cy={24} r={16} fill={color} {...common} />;
  }
}
