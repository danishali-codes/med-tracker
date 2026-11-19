// Fajr and Maghrib times worked out on the phone from the sun's position, so Ramadan
// mode needs no internet. Standard astronomical formulas (accurate to a minute or two).
import { parseDateKey, type DateKey, type TimeOfDay } from './dates';
import type { PrayerMethod } from './types';

export interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  method: PrayerMethod;
}

export const CITIES: City[] = [
  { id: 'dubai', name: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708, method: 'uae' },
  { id: 'abudhabi', name: 'Abu Dhabi', country: 'UAE', lat: 24.4539, lng: 54.3773, method: 'uae' },
  { id: 'sharjah', name: 'Sharjah', country: 'UAE', lat: 25.3463, lng: 55.4209, method: 'uae' },
  { id: 'ajman', name: 'Ajman', country: 'UAE', lat: 25.4052, lng: 55.5136, method: 'uae' },
  { id: 'rak', name: 'Ras Al Khaimah', country: 'UAE', lat: 25.8007, lng: 55.9762, method: 'uae' },
  { id: 'fujairah', name: 'Fujairah', country: 'UAE', lat: 25.1288, lng: 56.3265, method: 'uae' },
  { id: 'uaq', name: 'Umm Al Quwain', country: 'UAE', lat: 25.5647, lng: 55.5552, method: 'uae' },
  { id: 'alain', name: 'Al Ain', country: 'UAE', lat: 24.2075, lng: 55.7447, method: 'uae' },
  { id: 'riyadh', name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lng: 46.6753, method: 'ummalqura' },
  { id: 'jeddah', name: 'Jeddah', country: 'Saudi Arabia', lat: 21.4858, lng: 39.1925, method: 'ummalqura' },
  { id: 'makkah', name: 'Makkah', country: 'Saudi Arabia', lat: 21.3891, lng: 39.8579, method: 'ummalqura' },
  { id: 'madinah', name: 'Madinah', country: 'Saudi Arabia', lat: 24.5247, lng: 39.5692, method: 'ummalqura' },
  { id: 'dammam', name: 'Dammam', country: 'Saudi Arabia', lat: 26.4207, lng: 50.0888, method: 'ummalqura' },
  { id: 'doha', name: 'Doha', country: 'Qatar', lat: 25.2854, lng: 51.531, method: 'ummalqura' },
  { id: 'manama', name: 'Manama', country: 'Bahrain', lat: 26.2285, lng: 50.586, method: 'ummalqura' },
  { id: 'kuwait', name: 'Kuwait City', country: 'Kuwait', lat: 29.3759, lng: 47.9774, method: 'ummalqura' },
  { id: 'muscat', name: 'Muscat', country: 'Oman', lat: 23.588, lng: 58.3829, method: 'ummalqura' },
  { id: 'cairo', name: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357, method: 'egypt' },
  { id: 'amman', name: 'Amman', country: 'Jordan', lat: 31.9454, lng: 35.9284, method: 'mwl' },
  { id: 'istanbul', name: 'Istanbul', country: 'Türkiye', lat: 41.0082, lng: 28.9784, method: 'mwl' },
  { id: 'karachi', name: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011, method: 'karachi' },
  { id: 'lahore', name: 'Lahore', country: 'Pakistan', lat: 31.5204, lng: 74.3587, method: 'karachi' },
  { id: 'islamabad', name: 'Islamabad', country: 'Pakistan', lat: 33.6844, lng: 73.0479, method: 'karachi' },
  { id: 'mumbai', name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, method: 'karachi' },
  { id: 'delhi', name: 'Delhi', country: 'India', lat: 28.6139, lng: 77.209, method: 'karachi' },
  { id: 'hyderabad', name: 'Hyderabad', country: 'India', lat: 17.385, lng: 78.4867, method: 'karachi' },
  { id: 'dhaka', name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125, method: 'karachi' },
  { id: 'kualalumpur', name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lng: 101.6869, method: 'mwl' },
  { id: 'jakarta', name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456, method: 'mwl' },
  { id: 'london', name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, method: 'mwl' },
  { id: 'newyork', name: 'New York', country: 'USA', lat: 40.7128, lng: -74.006, method: 'isna' },
  { id: 'toronto', name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, method: 'isna' },
];

/** Sun angle below the horizon at Fajr for each calculation method. */
export const FAJR_ANGLE: Record<PrayerMethod, number> = {
  uae: 18.2,
  ummalqura: 18.5,
  mwl: 18,
  isna: 15,
  egypt: 19.5,
  karachi: 18,
};

export const METHOD_NAMES: Record<PrayerMethod, string> = {
  uae: 'UAE (Awqaf)',
  ummalqura: 'Umm al-Qura',
  mwl: 'Muslim World League',
  isna: 'North America (ISNA)',
  egypt: 'Egyptian',
  karachi: 'Karachi',
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

function julian(y: number, m: number, d: number): number {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

function sun(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const eqt = q / 15 - ra;
  return { decl, eqt: fix(eqt + 12, 24) - 12 };
}

/** Hours from solar noon to when the sun is `angle` degrees below the horizon. */
function hoursFromNoon(angle: number, lat: number, decl: number): number | null {
  const v = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
  if (v < -1 || v > 1) return null; // the sun never gets that low (far north in summer)
  return deg(Math.acos(v)) / 15;
}

function toTime(hours: number): TimeOfDay {
  const total = Math.round(fix(hours, 24) * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Fajr and Maghrib (sunset) on a day, as local times. `utcOffsetMinutes` is the
 * city's offset from UTC on that day (e.g. 240 for the UAE).
 */
export function prayerTimes(date: DateKey, city: Pick<City, 'lat' | 'lng'>, method: PrayerMethod, utcOffsetMinutes: number): { fajr: TimeOfDay; maghrib: TimeOfDay } | null {
  const { y, m, d } = parseDateKey(date);
  const tz = utcOffsetMinutes / 60;
  // Sun position at about local noon, then refined at each event's own time.
  const jd = julian(y, m, d) - city.lng / 360;
  const at = (hourGuess: number) => sun(jd + hourGuess / 24);
  const noon = (s: { eqt: number }) => 12 + tz - city.lng / 15 - s.eqt;
  let s = at(5);
  const fajrH = hoursFromNoon(FAJR_ANGLE[method], city.lat, s.decl);
  s = at(18);
  const setH = hoursFromNoon(0.833, city.lat, s.decl);
  if (fajrH == null || setH == null) return null;
  return { fajr: toTime(noon(at(5)) - fajrH), maghrib: toTime(noon(at(18)) + setH) };
}

/** The phone's offset from UTC on that day, in minutes (e.g. 240 in the UAE). */
export function localOffsetMinutes(date: DateKey): number {
  const { y, m, d } = parseDateKey(date);
  return -new Date(y, m - 1, d, 12).getTimezoneOffset();
}
