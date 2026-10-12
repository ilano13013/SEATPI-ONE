import { describe, expect, it } from 'vitest';
import { addBusinessMinutes, businessMinutesBetween, nextBusinessDays, startOfWeek } from '../calendar';
import { clientById } from '../config';
import { at } from './fixtures';

const cal = clientById('invivo').calendar; // Lun–Ven 8h–18h

describe('calendrier contractuel', () => {
  it('saute le week-end', () => {
    // Vendredi 16/10 17:30 + 60 min ouvrées → lundi 19/10 08:30
    expect(addBusinessMinutes(at(16, 17, 30), 60, cal)).toBe(at(19, 8, 30));
  });

  it('saute les jours fériés', () => {
    // Mardi 10/11 17:00 + 120 min → le 11/11 est férié → jeudi 12/11 09:00
    const t = new Date(2026, 10, 10, 17).getTime();
    expect(addBusinessMinutes(t, 120, cal)).toBe(new Date(2026, 10, 12, 9).getTime());
  });

  it('démarre à l’ouverture si la création a lieu hors plage', () => {
    expect(addBusinessMinutes(at(14, 6, 0), 30, cal)).toBe(at(14, 8, 30));
    expect(addBusinessMinutes(at(14, 19, 0), 30, cal)).toBe(at(15, 8, 30));
  });

  it('businessMinutesBetween est l’inverse de addBusinessMinutes', () => {
    for (const minutes of [1, 59, 600, 601, 1500, 4321]) {
      const start = at(14, 10, 17);
      expect(businessMinutesBetween(start, addBusinessMinutes(start, minutes, cal), cal)).toBeCloseTo(minutes, 6);
    }
    expect(businessMinutesBetween(at(16, 17, 0), at(19, 9, 0), cal)).toBe(120);
  });

  it('calcule les débuts de semaine et les jours ouvrés', () => {
    expect(startOfWeek(at(14, 15))).toBe(at(12, 0));
    expect(startOfWeek(at(18, 12))).toBe(at(12, 0)); // dimanche
    expect(nextBusinessDays(at(16, 12), 2, cal)).toEqual([at(16, 0), at(19, 0)]);
  });
});
