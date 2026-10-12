// Réservation des véhicules du parc (démonstration) : calendrier par demi-journée,
// détection des conflits et proposition des créneaux disponibles les plus proches.
// Aucune réservation réelle n'est effectuée.
import type { Vehicle } from '../types';
import { addDays, dateKey, startOfDay, startOfWeek } from '../external/calendar';
import { createRng } from '../services/random';

export type Slot = 'matin' | 'apres-midi';
export const SLOTS: Slot[] = ['matin', 'apres-midi'];
export const SLOT_LABEL: Record<Slot, string> = { matin: 'Matin (8 h – 13 h)', 'apres-midi': 'Après-midi (13 h – 19 h)' };
export const SLOT_SHORT: Record<Slot, string> = { matin: 'Matin', 'apres-midi': 'Ap.-midi' };
/** Heure de fin de chaque demi-journée (créneau passé au-delà). */
const SLOT_END_H: Record<Slot, number> = { matin: 13, 'apres-midi': 19 };

export type Duration = 'matin' | 'apres-midi' | 'journee';
export const DURATION_LABEL: Record<Duration, string> = { matin: 'Matin', 'apres-midi': 'Après-midi', journee: 'Journée entière' };

export interface CarBooking {
  id: string;
  vehicleId: string;
  /** AAAA-MM-JJ. */
  day: string;
  slot: Slot;
  kind: 'réservation' | 'entretien';
  by: string;
  purpose: string;
}

export type SlotState = 'libre' | 'réservé' | 'entretien' | 'passé';

/** Jours ouvrés (lundi → vendredi) de la semaine commençant à `weekStart`. */
export const weekDays = (weekStart: number): string[] => Array.from({ length: 5 }, (_, i) => dateKey(addDays(weekStart, i)));

const parseDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export const fmtDay = (day: string) => new Date(parseDay(day)).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' });
export const fmtDayShort = (day: string) => new Date(parseDay(day)).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export const isPast = (day: string, slot: Slot, now: number) => {
  const end = new Date(parseDay(day));
  end.setHours(SLOT_END_H[slot]);
  return end.getTime() <= now;
};

export const bookingAt = (bookings: CarBooking[], vehicleId: string, day: string, slot: Slot) => bookings.find((b) => b.vehicleId === vehicleId && b.day === day && b.slot === slot);

export function slotState(bookings: CarBooking[], vehicleId: string, day: string, slot: Slot, now: number): SlotState {
  const b = bookingAt(bookings, vehicleId, day, slot);
  if (b) return b.kind === 'entretien' ? 'entretien' : 'réservé';
  return isPast(day, slot, now) ? 'passé' : 'libre';
}

const slotsOf = (d: Duration): Slot[] => (d === 'journee' ? SLOTS : [d]);

export interface Proposal {
  vehicleId: string;
  day: string;
  slots: Slot[];
  /** Créneau demandé exactement (sinon : alternative la plus proche). */
  exact: boolean;
}

/**
 * Propose les créneaux libres les plus proches de la date souhaitée : d'abord la date demandée
 * (véhicule choisi puis autres véhicules), puis les jours ouvrés suivants. Jamais dans le passé.
 */
export function propose(bookings: CarBooking[], vehicles: Vehicle[], req: { day: string; duration: Duration; vehicleId?: string }, now: number, limit = 3, horizonDays = 28): Proposal[] {
  const wanted = slotsOf(req.duration);
  const order = req.vehicleId ? [req.vehicleId, ...vehicles.map((v) => v.id).filter((id) => id !== req.vehicleId)] : vehicles.map((v) => v.id);
  const out: Proposal[] = [];
  const start = Math.max(parseDay(req.day), startOfDay(now));
  for (let i = 0; i < horizonDays && out.length < limit; i++) {
    const t = addDays(start, i);
    const dow = new Date(t).getDay();
    if (dow === 0 || dow === 6) continue;
    const day = dateKey(t);
    for (const vehicleId of order) {
      if (out.length >= limit) break;
      if (wanted.every((s) => slotState(bookings, vehicleId, day, s, now) === 'libre')) out.push({ vehicleId, day, slots: wanted, exact: day === req.day && (!req.vehicleId || vehicleId === req.vehicleId) });
    }
  }
  return out;
}

export function book(bookings: CarBooking[], p: { vehicleId: string; day: string; slots: Slot[]; by: string; purpose: string }, now: number): { ok: boolean; message: string; bookings: CarBooking[] } {
  if (!p.purpose.trim()) return { ok: false, message: 'Indiquez le motif du déplacement.', bookings };
  const blocked = p.slots.filter((s) => slotState(bookings, p.vehicleId, p.day, s, now) !== 'libre');
  if (blocked.length) return { ok: false, message: `Créneau indisponible (${blocked.map((s) => SLOT_SHORT[s]).join(', ')}) : choisissez une autre proposition.`, bookings };
  const added = p.slots.map((slot) => ({ id: `RV-${p.vehicleId}-${p.day}-${slot}`, vehicleId: p.vehicleId, day: p.day, slot, kind: 'réservation' as const, by: p.by, purpose: p.purpose.trim() }));
  return { ok: true, message: `Réservation enregistrée (démonstration) : ${fmtDay(p.day)} · ${p.slots.length === 2 ? 'journée entière' : SLOT_SHORT[p.slots[0]].toLowerCase()}.`, bookings: [...bookings, ...added] };
}

export function cancel(bookings: CarBooking[], id: string): CarBooking[] {
  return bookings.filter((b) => b.id !== id);
}

/** Prochaine réservation à venir d'un véhicule (libellé), à partir du calendrier. */
export function nextBooking(bookings: CarBooking[], vehicleId: string, now: number): CarBooking | undefined {
  return bookings
    .filter((b) => b.vehicleId === vehicleId && b.kind === 'réservation' && !isPast(b.day, b.slot, now))
    .sort((a, b) => (a.day + a.slot).localeCompare(b.day + b.slot))[0];
}

/** État du véhicule sur la demi-journée en cours. */
export function currentState(bookings: CarBooking[], vehicleId: string, now: number): 'Disponible' | 'Réservé' | 'Entretien' {
  const slot: Slot = new Date(now).getHours() < 13 ? 'matin' : 'apres-midi';
  const b = bookingAt(bookings, vehicleId, dateKey(now), slot);
  return b ? (b.kind === 'entretien' ? 'Entretien' : 'Réservé') : 'Disponible';
}

const PURPOSES = ['Visite client', 'Comité de pilotage', 'Intervention sur site', 'Formation externe', 'Livraison de matériel'];
const BOOKERS = ['Manager CSM', 'Technicien N2', 'Responsable Helpdesk', 'Exploitation', 'Moyens généraux'];

/** Planning fictif sur 4 semaines, cohérent avec l'état initial des véhicules. */
export function demoBookings(vehicles: Vehicle[], now: number, seed = 77): CarBooking[] {
  const rng = createRng(seed);
  const monday = startOfWeek(now);
  const out: CarBooking[] = [];
  const add = (vehicleId: string, day: string, slot: Slot, kind: CarBooking['kind'], by: string, purpose: string) => {
    if (!out.some((b) => b.vehicleId === vehicleId && b.day === day && b.slot === slot)) out.push({ id: `RV-${vehicleId}-${day}-${slot}`, vehicleId, day, slot, kind, by, purpose });
  };
  for (const v of vehicles) {
    // Entretien en cours : semaine immobilisée.
    if (v.status === 'Entretien') for (const d of weekDays(monday)) for (const s of SLOTS) add(v.id, d, s, 'entretien', 'Garage partenaire', 'Révision et contrôle technique');
    if (v.status === 'Réservé') for (const s of SLOTS) add(v.id, dateKey(now), s, 'réservation', 'Manager CSM', 'Visite client');
    if (v.nextBooking?.startsWith('Demain')) add(v.id, dateKey(addDays(now, 1)), 'matin', 'réservation', 'Responsable Helpdesk', 'Comité de pilotage');
    for (let w = 0; w < 4; w++)
      for (const d of weekDays(addDays(monday, 7 * w)))
        for (const s of SLOTS) if (rng() < 0.22) add(v.id, d, s, 'réservation', BOOKERS[Math.floor(rng() * BOOKERS.length)], PURPOSES[Math.floor(rng() * PURPOSES.length)]);
  }
  return out;
}
