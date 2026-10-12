import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/demoData';
import { book, currentState, demoBookings, propose, slotState, weekDays, type CarBooking } from './bookings';
import { startOfWeek } from '../external/calendar';

const NOW = new Date(2026, 9, 12, 10).getTime(); // lundi 12 octobre 2026, 10 h
const vehicles = createInitialState().vehicles;

describe('réservation des véhicules', () => {
  it('planning cohérent avec l’état des véhicules : entretien immobilisé, berline réservée aujourd’hui', () => {
    const b = demoBookings(vehicles, NOW);
    for (const d of weekDays(startOfWeek(NOW))) expect(slotState(b, 'veh-3', d, 'matin', NOW)).toBe('entretien');
    expect(currentState(b, 'veh-2', NOW)).toBe('Réservé');
    expect(currentState(b, 'veh-3', NOW)).toBe('Entretien');
  });
  it('les créneaux passés ne sont jamais libres ni proposés', () => {
    expect(slotState([], 'veh-1', '2026-10-12', 'matin', new Date(2026, 9, 12, 14).getTime())).toBe('passé');
    const p = propose([], vehicles, { day: '2026-10-01', duration: 'matin' }, NOW);
    expect(p.every((x) => x.day >= '2026-10-12')).toBe(true);
  });
  it('propose la date demandée si libre, sinon les créneaux libres les plus proches', () => {
    const busy: CarBooking[] = vehicles.flatMap((v) => (['matin', 'apres-midi'] as const).map((slot) => ({ id: v.id + slot, vehicleId: v.id, day: '2026-10-14', slot, kind: 'réservation' as const, by: 'x', purpose: 'y' })));
    const exact = propose([], vehicles, { day: '2026-10-14', duration: 'journee', vehicleId: 'veh-4' }, NOW);
    expect(exact[0]).toMatchObject({ vehicleId: 'veh-4', day: '2026-10-14', exact: true, slots: ['matin', 'apres-midi'] });
    const alt = propose(busy, vehicles, { day: '2026-10-14', duration: 'journee', vehicleId: 'veh-4' }, NOW);
    expect(alt.length).toBe(3);
    expect(alt.every((x) => x.day > '2026-10-14' && !x.exact)).toBe(true);
    expect(alt[0].vehicleId).toBe('veh-4'); // véhicule souhaité proposé en premier
  });
  it('refuse une réservation en conflit ; jamais de week-end', () => {
    const r = book([], { vehicleId: 'veh-1', day: '2026-10-15', slots: ['matin'], by: 'a', purpose: 'Visite' }, NOW);
    expect(r.ok).toBe(true);
    expect(book(r.bookings, { vehicleId: 'veh-1', day: '2026-10-15', slots: ['matin'], by: 'b', purpose: 'Visite' }, NOW).ok).toBe(false);
    expect(book([], { vehicleId: 'veh-1', day: '2026-10-15', slots: ['matin'], by: 'b', purpose: ' ' }, NOW).ok).toBe(false);
    expect(propose([], vehicles, { day: '2026-10-17', duration: 'matin' }, NOW)[0].day).toBe('2026-10-19');
  });
});
