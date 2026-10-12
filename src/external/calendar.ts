// Calcul en temps ouvré selon un calendrier contractuel (heure locale).
import type { BusinessCalendar } from './types';

const MIN = 60_000;

export function dateKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function addDays(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).getTime();
}

/** Lundi 00:00 de la semaine de `t`. */
export function startOfWeek(t: number): number {
  const day = new Date(t).getDay();
  return startOfDay(addDays(t, -((day + 6) % 7)));
}

export function isBusinessDay(t: number, cal: BusinessCalendar): boolean {
  return cal.days.includes(new Date(t).getDay()) && !cal.holidays.includes(dateKey(t));
}

/** Plage ouvrée [début, fin] du jour de `t`. */
function dayWindow(t: number, cal: BusinessCalendar): [number, number] {
  const d = new Date(t);
  return [
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), cal.startHour).getTime(),
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), cal.endHour).getTime(),
  ];
}

export function businessMinutesPerDay(cal: BusinessCalendar): number {
  return (cal.endHour - cal.startHour) * 60;
}

/** Ajoute `minutes` ouvrées à `start`. */
export function addBusinessMinutes(start: number, minutes: number, cal: BusinessCalendar): number {
  if (minutes <= 0) return start;
  let cursor = start;
  let remaining = minutes;
  for (let guard = 0; guard < 2000; guard++) {
    if (isBusinessDay(cursor, cal)) {
      const [open, close] = dayWindow(cursor, cal);
      if (cursor < open) cursor = open;
      if (cursor < close) {
        const available = (close - cursor) / MIN;
        if (remaining <= available) return cursor + remaining * MIN;
        remaining -= available;
      }
    }
    cursor = startOfDay(addDays(cursor, 1));
  }
  throw new Error('Calendrier sans jour ouvré');
}

/** Minutes ouvrées entre `a` et `b` (0 si b ≤ a). */
export function businessMinutesBetween(a: number, b: number, cal: BusinessCalendar): number {
  if (b <= a) return 0;
  let total = 0;
  let day = startOfDay(a);
  for (let guard = 0; day < b && guard < 2000; guard++) {
    if (isBusinessDay(day, cal)) {
      const [open, close] = dayWindow(day, cal);
      const from = Math.max(open, a);
      const to = Math.min(close, b);
      if (to > from) total += (to - from) / MIN;
    }
    day = startOfDay(addDays(day, 1));
  }
  return total;
}

/** Jours ouvrés à partir de `t` (le jour courant inclus s'il est ouvré). */
export function nextBusinessDays(t: number, n: number, cal: BusinessCalendar): number[] {
  const days: number[] = [];
  let day = startOfDay(t);
  for (let guard = 0; days.length < n && guard < 400; guard++) {
    if (isBusinessDay(day, cal)) days.push(day);
    day = startOfDay(addDays(day, 1));
  }
  return days;
}
