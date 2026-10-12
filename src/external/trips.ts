// Déplacements des techniciens N2 : intervention sur le site secondaire du client.
// Un trajet comporte trois phases : aller, intervention sur site, retour.
import type { ExternalClient, Technician, Ticket } from './types';
import type { Rng } from '../services/random';
import { isOnLeave } from './workload';

export type TripPhase = 'En route' | 'Sur site' | 'Retour' | 'Terminé';

export interface Trip {
  id: string;
  clientId: string;
  techId: string;
  /** Ticket interne à l'origine de l'intervention. */
  ticketId: string;
  from: string;
  to: string;
  transport: string;
  departAt: number;
  travelMin: number;
  onSiteMin: number;
}

export interface TripStatus {
  phase: TripPhase;
  /** Avancement du trajet en cours (0–1) ; 1 sur site. */
  progress: number;
  arriveAt: number;
  leaveSiteAt: number;
  backAt: number;
}

const MIN = 60_000;
const TRANSPORTS = ['Véhicule de service SEATPI', 'Véhicule de service SEATPI', 'Transport en commun', 'Véhicule personnel (indemnités km)'];

export function tripStatus(trip: Trip, now: number): TripStatus {
  const arriveAt = trip.departAt + trip.travelMin * MIN;
  const leaveSiteAt = arriveAt + trip.onSiteMin * MIN;
  const backAt = leaveSiteAt + trip.travelMin * MIN;
  const base = { arriveAt, leaveSiteAt, backAt };
  if (now < trip.departAt) return { ...base, phase: 'En route', progress: 0 };
  if (now < arriveAt) return { ...base, phase: 'En route', progress: (now - trip.departAt) / (arriveAt - trip.departAt) };
  if (now < leaveSiteAt) return { ...base, phase: 'Sur site', progress: 1 };
  if (now < backAt) return { ...base, phase: 'Retour', progress: (now - leaveSiteAt) / (backAt - leaveSiteAt) };
  return { ...base, phase: 'Terminé', progress: 1 };
}

export const isTripActive = (trip: Trip, now: number) => tripStatus(trip, now).phase !== 'Terminé';

export function activeTripOf(trips: Trip[], techId: string, now: number): Trip | undefined {
  return trips.find((t) => t.techId === techId && isTripActive(t, now));
}

/** Tickets justifiant une intervention : ouverts, affectés, situés sur le site secondaire. */
function candidates(tickets: Ticket[], techs: Technician[], client: ExternalClient, trips: Trip[], now: number): Ticket[] {
  const busy = new Set(trips.filter((t) => isTripActive(t, now)).map((t) => t.techId));
  const done = new Set(trips.map((t) => t.ticketId));
  return tickets.filter((t) => {
    if (t.clientId !== client.id || t.site === client.sites[0] || !t.assigneeId || done.has(t.id)) return false;
    if (t.status !== 'En cours' && t.status !== 'Affecté') return false;
    const tech = techs.find((x) => x.id === t.assigneeId);
    return !!tech && !busy.has(tech.id) && !isOnLeave(tech, now);
  });
}

function makeTrip(t: Ticket, client: ExternalClient, departAt: number, rng: Rng): Trip {
  return {
    id: `DEP-${t.id}`,
    clientId: client.id,
    techId: t.assigneeId!,
    ticketId: t.id,
    from: client.sites[0],
    to: t.site,
    transport: TRANSPORTS[Math.floor(rng() * TRANSPORTS.length)],
    departAt: Math.floor(departAt / MIN) * MIN,
    travelMin: 25 + Math.round(rng() * 35),
    onSiteMin: 45 + Math.round(rng() * 75),
  };
}

/** Déplacements en cours au démarrage : phases variées (aller, sur site, retour). */
export function initialTrips(tickets: Ticket[], techs: Technician[], client: ExternalClient, now: number, rng: Rng): Trip[] {
  const trips: Trip[] = [];
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const t = candidates(tickets, techs, client, trips, now)[0];
    if (!t) break;
    const trip = makeTrip(t, client, now, rng);
    const total = trip.travelMin * 2 + trip.onSiteMin;
    trip.departAt = Math.floor((now - (0.1 + 0.8 * rng()) * total * MIN) / MIN) * MIN;
    trips.push(trip);
  }
  return trips;
}

/** Fait évoluer les déplacements entre deux synchronisations. */
export function evolveTrips(trips: Trip[], tickets: Ticket[], techs: Technician[], client: ExternalClient, now: number, rng: Rng): Trip[] {
  // On garde les trajets terminés depuis moins de 2 h pour l'historique du jour.
  const kept = trips.filter((t) => t.clientId !== client.id || now - tripStatus(t, now).backAt < 2 * 3_600_000);
  const active = kept.filter((t) => t.clientId === client.id && isTripActive(t, now)).length;
  if (active < 3 && rng() < 0.35) {
    const t = candidates(tickets, techs, client, kept, now)[0];
    if (t) return [...kept, makeTrip(t, client, now, rng)];
  }
  return kept;
}
