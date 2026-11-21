// SVG strings for the widgets. Android draws these with AndroidSVG, so they stick to
// plain shapes and paths, hex colours and opacity attributes (no rgba, CSS or filters).
import type { PillLook } from './model';

const n = (x: number) => Math.round(x * 100) / 100;

/** An arc from 12 o'clock, clockwise, covering `pct` (0 to 1) of the circle. */
function arc(c: number, r: number, pct: number): string {
  if (pct >= 0.9999) {
    return `M ${n(c)} ${n(c - r)} A ${n(r)} ${n(r)} 0 1 1 ${n(c - 0.01)} ${n(c - r)}`;
  }
  const a = pct * 2 * Math.PI - Math.PI / 2;
  const x = c + r * Math.cos(a);
  const y = c + r * Math.sin(a);
  return `M ${n(c)} ${n(c - r)} A ${n(r)} ${n(r)} 0 ${pct > 0.5 ? 1 : 0} 1 ${n(x)} ${n(y)}`;
}

export interface RingSpec {
  /** 0 to 1. */
  pct: number;
  color: string;
}

/** Nested progress rings, outermost first, like the ones on the Today screen. */
export function ringsSvg({
  rings,
  size,
  stroke,
  gap,
  track,
  trackOpacity,
}: {
  rings: RingSpec[];
  size: number;
  stroke: number;
  gap: number;
  track: string;
  trackOpacity: number;
}): string {
  const c = size / 2;
  const parts: string[] = [];
  rings.forEach((ring, i) => {
    const r = c - stroke / 2 - i * (stroke + gap);
    if (r <= stroke / 2) return;
    parts.push(`<circle cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fill="none" stroke="${track}" stroke-opacity="${trackOpacity}" stroke-width="${stroke}"/>`);
    const pct = Math.max(0, Math.min(1, ring.pct));
    if (pct > 0) {
      // A tiny sliver still shows as a dot, which reads as "started".
      parts.push(
        `<path d="${arc(c, r, Math.max(pct, 0.012))}" fill="none" stroke="${ring.color}" stroke-width="${stroke}" stroke-linecap="round"/>`,
      );
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join('')}</svg>`;
}

/** A tick, for a finished day. */
export function checkSvg(size: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** A rounded five-point star, for a gold day (every dose on time). */
export function starSvg(size: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M12 2.8 L14.7 8.6 L21 9.3 L16.3 13.6 L17.6 19.9 L12 16.7 L6.4 19.9 L7.7 13.6 L3 9.3 L9.3 8.6 Z" fill="${color}" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

/** A small flame for the streak count. */
export function flameSvg(size: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M12 2.5 C13 6 17.5 8.5 17.5 14 A5.5 5.5 0 0 1 6.5 14 C6.5 11 8 9.5 9 8.5 C9 10.5 10 11.5 11 11.5 C11 8.5 10.5 5.5 12 2.5 Z" fill="${color}"/></svg>`;
}

/** Deterministic random numbers, so a day's pattern stays put between redraws. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Little pills and dots scattered over a finished day's widget. The layout changes
 * each day (it's seeded by the date) and stays the same all day.
 */
export function confettiSvg(width: number, height: number, seed: string, color: string, count = 14): string {
  const rand = seeded(seed);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = n(rand() * width);
    const y = n(rand() * height);
    const o = n(0.14 + rand() * 0.16);
    const kind = rand();
    if (kind < 0.45) {
      // A tiny capsule at a random angle.
      const w = n(9 + rand() * 6);
      const h = n(w * 0.42);
      const rot = Math.round(rand() * 180);
      parts.push(
        `<rect x="${n(x - w / 2)}" y="${n(y - h / 2)}" width="${w}" height="${h}" rx="${n(h / 2)}" fill="${color}" fill-opacity="${o}" transform="rotate(${rot} ${x} ${y})"/>`,
      );
    } else if (kind < 0.8) {
      parts.push(`<circle cx="${x}" cy="${y}" r="${n(2 + rand() * 2.5)}" fill="${color}" fill-opacity="${o}"/>`);
    } else {
      // A thin ring.
      parts.push(`<circle cx="${x}" cy="${y}" r="${n(3.5 + rand() * 2)}" fill="none" stroke="${color}" stroke-opacity="${o}" stroke-width="1.6"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
}

const OUTLINE = 'stroke="#000000" stroke-opacity="0.28" stroke-width="1.6"';
const LINE = 'stroke="#000000" stroke-opacity="0.18" stroke-width="1.4"';
const SHINE = 'fill="#FFFFFF" fill-opacity="0.45"';
const CAP = '#E8E8EC';
const METAL = '#D9DCE3';

/** The same drawings as PillArt in the app, as an SVG string. */
export function pillSvg(look: PillLook, size: number): string {
  const { form, shape, color } = look;
  const color2 = look.color2 ?? color;
  let body: string;
  if (form === 'pill' || form === 'capsule') {
    switch (shape) {
      case 'oval':
        body = `<ellipse cx="24" cy="24" rx="19" ry="13" fill="${color}" ${OUTLINE}/><line x1="12" y1="24" x2="36" y2="24" ${LINE}/>`;
        break;
      case 'oblong':
        body = `<g transform="rotate(-30 24 24)"><rect x="5" y="15" width="38" height="18" rx="9" fill="${color}" ${OUTLINE}/><line x1="24" y1="18" x2="24" y2="30" ${LINE}/></g>`;
        break;
      case 'capsule':
        body = `<g transform="rotate(-35 24 24)"><path d="M24 15 H14 A9 9 0 0 0 14 33 H24 Z" fill="${color}" ${OUTLINE}/><path d="M24 15 H34 A9 9 0 0 1 34 33 H24 Z" fill="${color2}" ${OUTLINE}/><rect x="11" y="18" width="9" height="3" rx="1.5" ${SHINE}/></g>`;
        break;
      case 'square':
        body = `<rect x="9" y="9" width="30" height="30" rx="7" fill="${color}" ${OUTLINE}/><line x1="24" y1="14" x2="24" y2="34" ${LINE}/>`;
        break;
      case 'diamond':
        body = `<path d="M24 5 Q26 5 27.5 7 L41 22 Q42.5 24 41 26 L27.5 41 Q26 43 24 43 Q22 43 20.5 41 L7 26 Q5.5 24 7 22 L20.5 7 Q22 5 24 5 Z" fill="${color}" ${OUTLINE}/>`;
        break;
      case 'triangle':
        body = `<path d="M24 7 Q26.5 7 28 9.5 L42 35 Q43.5 38.5 39.5 39.5 H8.5 Q4.5 38.5 6 35 L20 9.5 Q21.5 7 24 7 Z" fill="${color}" ${OUTLINE}/>`;
        break;
      default:
        body = `<circle cx="24" cy="24" r="16" fill="${color}" ${OUTLINE}/><line x1="13" y1="24" x2="35" y2="24" ${LINE}/>`;
    }
  } else {
    switch (form) {
      case 'liquid':
        body = `<rect x="18" y="5" width="12" height="7" rx="2" fill="${CAP}" ${OUTLINE}/><path d="M17 12 H31 V16 Q37 18 37 24 V40 Q37 43 34 43 H14 Q11 43 11 40 V24 Q11 18 17 16 Z" fill="${color}" ${OUTLINE}/><rect x="15" y="26" width="18" height="10" rx="2" fill="#FFFFFF" fill-opacity="0.75"/>`;
        break;
      case 'injection':
        body = `<g transform="rotate(-45 24 24)"><rect x="8" y="19" width="24" height="10" rx="2" fill="${color}" ${OUTLINE}/><rect x="32" y="21.5" width="5" height="5" fill="${METAL}" ${OUTLINE}/><line x1="37" y1="24" x2="45" y2="24" ${OUTLINE}/><rect x="3" y="17" width="5" height="14" rx="1.5" fill="${METAL}" ${OUTLINE}/></g>`;
        break;
      case 'drops':
        body = `<path d="M24 4 L28 12 H20 Z" fill="${CAP}" ${OUTLINE}/><rect x="19" y="12" width="10" height="6" rx="1.5" fill="${CAP}" ${OUTLINE}/><rect x="13" y="18" width="22" height="25" rx="5" fill="${color}" ${OUTLINE}/><path d="M24 25 Q28 30 28 33 A4 4 0 0 1 20 33 Q20 30 24 25 Z" fill="#FFFFFF" fill-opacity="0.75"/>`;
        break;
      case 'inhaler':
        body = `<rect x="17" y="4" width="14" height="26" rx="4" fill="${color}" ${OUTLINE}/><path d="M13 26 H31 Q35 26 35 30 V36 H44 V44 H17 Q13 44 13 40 Z" fill="${METAL}" ${OUTLINE}/>`;
        break;
      case 'spray':
        body = `<rect x="20" y="3" width="8" height="10" rx="3" fill="${CAP}" ${OUTLINE}/><rect x="15" y="13" width="18" height="6" rx="2" fill="${METAL}" ${OUTLINE}/><rect x="13" y="19" width="22" height="25" rx="6" fill="${color}" ${OUTLINE}/><rect x="17" y="26" width="14" height="10" rx="2" fill="#FFFFFF" fill-opacity="0.7"/>`;
        break;
      case 'patch':
        body = `<rect x="7" y="7" width="34" height="34" rx="8" fill="${color}" ${OUTLINE}/><rect x="15" y="15" width="18" height="18" rx="4" fill="#FFFFFF" fill-opacity="0.6"/>`;
        break;
      case 'cream':
        body = `<g transform="rotate(-30 24 24)"><path d="M8 16 H32 L36 20 V28 L32 32 H8 Z" fill="${color}" ${OUTLINE}/><rect x="36" y="20.5" width="6" height="7" rx="1.5" fill="${CAP}" ${OUTLINE}/><line x1="11" y1="16" x2="11" y2="32" ${LINE}/></g>`;
        break;
      case 'sachet':
        body = `<path d="M10 8 L14 11 L18 8 L22 11 L26 8 L30 11 L34 8 L38 11 V40 Q38 42 36 42 H12 Q10 42 10 40 Z" fill="${color}" ${OUTLINE}/><rect x="15" y="22" width="18" height="10" rx="2" fill="#FFFFFF" fill-opacity="0.7"/>`;
        break;
      default:
        body = `<circle cx="24" cy="24" r="16" fill="${color}" ${OUTLINE}/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">${body}</svg>`;
}
