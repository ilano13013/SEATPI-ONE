// Déplacements des managers CSM du siège SEATPI vers les clients
// (comités de pilotage, revues de service, points d'escalade). Données fictives.
import type { ExternalClientId } from './types';
import type { Rng } from '../services/random';
import { csmTeam, nextCommittee } from './services';
import { clientById } from './config';
import { siteById } from '../data/sites';

export type TripPhase = 'En route' | 'Chez le client' | 'Retour' | 'Terminé';
export type TripPurpose = 'Comité de pilotage' | 'Revue de service' | 'Point escalade';

export interface Trip {
  id: string;
  clientId: ExternalClientId;
  /** Manager CSM (services.ts). */
  memberId: string;
  purpose: TripPurpose;
  from: string;
  to: string;
  transport: string;
  departAt: number;
  travelMin: number;
  onSiteMin: number;
}

export interface TripStatus {
  phase: TripPhase;
  /** Avancement du trajet en cours (0–1) ; 1 chez le client. */
  progress: number;
  arriveAt: number;
  leaveSiteAt: number;
  backAt: number;
}

const MIN = 60_000;
const TRANSPORTS = ['Véhicule de service SEATPI', 'Train', 'Véhicule de service SEATPI', 'Transport en commun'];

export function tripStatus(trip: Trip, now: number): TripStatus {
  const arriveAt = trip.departAt + trip.travelMin * MIN;
  const leaveSiteAt = arriveAt + trip.onSiteMin * MIN;
  const backAt = leaveSiteAt + trip.travelMin * MIN;
  const base = { arriveAt, leaveSiteAt, backAt };
  if (now < arriveAt) return { ...base, phase: 'En route', progress: Math.max(0, (now - trip.departAt) / (arriveAt - trip.departAt)) };
  if (now < leaveSiteAt) return { ...base, phase: 'Chez le client', progress: 1 };
  if (now < backAt) return { ...base, phase: 'Retour', progress: (now - leaveSiteAt) / (backAt - leaveSiteAt) };
  return { ...base, phase: 'Terminé', progress: 1 };
}

export const isTripActive = (trip: Trip, now: number) => tripStatus(trip, now).phase !== 'Terminé';

export function activeTripOf(trips: Trip[], memberId: string, now: number): Trip | undefined {
  return trips.find((t) => t.memberId === memberId && isTripActive(t, now));
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** Motif : comité le jour prévu, point d'escalade si une escalade contractuelle est ouverte, sinon revue de service. */
function purposeFor(clientId: ExternalClientId, now: number, openEscalation: boolean): TripPurpose {
  const committee = nextCommittee(clientId, now - 86_400_000);
  if (sameDay(committee, now)) return 'Comité de pilotage';
  return openEscalation ? 'Point escalade' : 'Revue de service';
}

function makeTrip(memberId: string, clientId: ExternalClientId, departAt: number, rng: Rng, openEscalation: boolean): Trip {
  const purpose = purposeFor(clientId, departAt, openEscalation);
  return {
    id: `DEP-${memberId}-${Math.floor(departAt / MIN)}`,
    clientId,
    memberId,
    purpose,
    from: `SEATPI ${siteById(csmTeam.find((m) => m.id === memberId)!.site).name}`,
    to: `Siège ${clientById(clientId).name}`,
    transport: TRANSPORTS[Math.floor(rng() * TRANSPORTS.length)],
    departAt: Math.floor(departAt / MIN) * MIN,
    travelMin: 30 + Math.round(rng() * 45),
    onSiteMin: purpose === 'Comité de pilotage' ? 120 : 60 + Math.round(rng() * 60),
  };
}

/** Au démarrage, deux CSM sont en déplacement, à des étapes différentes. */
export function initialTrips(now: number, rng: Rng, openEscalations: Set<string> = new Set()): Trip[] {
  const phases = [0.25, 0.6];
  return csmTeam.slice(0, phases.length).map((m, i) => {
    const trip = makeTrip(m.id, m.clientId!, now, rng, openEscalations.has(m.clientId!));
    const total = trip.travelMin * 2 + trip.onSiteMin;
    trip.departAt = Math.floor((now - phases[i] * total * MIN) / MIN) * MIN;
    trip.id = `DEP-${m.id}-${Math.floor(trip.departAt / MIN)}`;
    return trip;
  });
}

/** Entre deux synchronisations, un CSM disponible peut partir chez son client. */
export function evolveTrips(trips: Trip[], now: number, rng: Rng, openEscalations: Set<string> = new Set()): Trip[] {
  const kept = trips.filter((t) => now - tripStatus(t, now).backAt < 2 * 3_600_000);
  for (const m of csmTeam) {
    if (activeTripOf(kept, m.id, now)) continue;
    const chance = openEscalations.has(m.clientId!) ? 0.25 : 0.08;
    if (rng() < chance) kept.push(makeTrip(m.id, m.clientId!, now, rng, openEscalations.has(m.clientId!)));
  }
  return kept;
}
