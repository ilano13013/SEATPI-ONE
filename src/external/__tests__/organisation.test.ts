import { describe, expect, it } from 'vitest';
import { externalClients, externalTeams } from '../config';
import { initialTrips, evolveTrips, tripStatus, activeTripOf, isTripActive, type Trip } from '../trips';
import { csmTeam, receivedEscalations, serviceSummary } from '../services';
import type { ClientView } from '../derive';
import { createRng } from '../../services/random';
import { dataset, NOW } from './fixtures';

const { tickets } = dataset();

describe('organisation : uniquement du MCO N2 chez les clients', () => {
  it('chaque client n’a que des équipes MCO N2', () => {
    for (const c of externalClients) {
      const teams = externalTeams.filter((t) => t.clientId === c.id);
      expect(teams.length).toBeGreaterThan(0);
      expect(teams.every((t) => t.service === 'MCO N2')).toBe(true);
      expect(c.categories).not.toContain('Exploitation');
    }
  });

  it('les escalades partent du N2 vers l’Exploitation, le CSM ou une équipe externe', () => {
    const escalations = externalClients.flatMap((c) => tickets[c.id].flatMap((t) => t.escalations));
    expect(escalations.length).toBeGreaterThan(0);
    for (const e of escalations) {
      expect(e.from).toBe('MCO N2');
      expect(['Exploitation', 'CSM', 'Équipe externe']).toContain(e.to);
    }
    expect(new Set(escalations.map((e) => e.to)).size).toBe(3);
  });
});

describe('services internes Exploitation et CSM', () => {
  const views = externalClients.map((c) => ({ client: c, tickets: tickets[c.id] }) as unknown as ClientView);

  it('l’Exploitation reçoit toutes les escalades qui lui sont destinées', () => {
    const expected = externalClients.flatMap((c) => tickets[c.id].flatMap((t) => t.escalations.filter((e) => e.to === 'Exploitation')));
    expect(receivedEscalations(views, 'Exploitation')).toHaveLength(expected.length);
    const s = serviceSummary(views, 'Exploitation', NOW);
    expect(s.open.every((r) => r.escalation.status === 'En cours')).toBe(true);
  });

  it('une escalade CSM est suivie par le CSM du compte', () => {
    for (const r of receivedEscalations(views, 'CSM')) {
      expect(csmTeam.find((m) => m.id === r.ownerId)!.clientId).toBe(r.clientId);
    }
  });
});

describe('déplacements des managers CSM', () => {
  const trip: Trip = {
    id: 'D1',
    clientId: 'invivo',
    memberId: 'csm-01',
    purpose: 'Revue de service',
    from: 'SEATPI La Ciotat',
    to: 'Siège INVIVO',
    transport: 'Train',
    departAt: NOW,
    travelMin: 30,
    onSiteMin: 60,
  };
  const m = 60_000;

  it('enchaîne aller, visite chez le client et retour', () => {
    expect(tripStatus(trip, NOW + 15 * m)).toMatchObject({ phase: 'En route', progress: 0.5 });
    expect(tripStatus(trip, NOW + 45 * m).phase).toBe('Chez le client');
    expect(tripStatus(trip, NOW + 105 * m)).toMatchObject({ phase: 'Retour', progress: 0.5 });
    expect(tripStatus(trip, NOW + 121 * m).phase).toBe('Terminé');
    expect(tripStatus(trip, NOW).backAt).toBe(NOW + 120 * m);
  });

  it('seuls les CSM se déplacent, chacun vers son propre client', () => {
    const trips = initialTrips(NOW, createRng(5));
    expect(trips.length).toBeGreaterThan(0);
    for (const t of trips) {
      const csm = csmTeam.find((x) => x.id === t.memberId);
      expect(csm).toBeDefined();
      expect(t.clientId).toBe(csm!.clientId);
      expect(t.from).toMatch(/^SEATPI (La Ciotat|Montpellier|Paris)$/);
      expect(isTripActive(t, NOW)).toBe(true);
      expect(activeTripOf(trips, t.memberId, NOW)).toBe(t);
    }
    expect(new Set(trips.map((t) => t.memberId)).size).toBe(trips.length);
  });

  it('un CSM ne part pas tant qu’un déplacement est en cours, et les trajets terminés sont purgés', () => {
    let trips = initialTrips(NOW, createRng(5));
    const rng = createRng(9);
    for (let i = 1; i <= 200; i++) {
      const now = NOW + i * 5 * m;
      trips = evolveTrips(trips, now, rng, new Set(['invivo', 'primagaz', 'monext']));
      for (const c of csmTeam) expect(trips.filter((t) => t.memberId === c.id && isTripActive(t, now)).length).toBeLessThanOrEqual(1);
      expect(trips.every((t) => now - tripStatus(t, now).backAt < 2 * 3_600_000)).toBe(true);
    }
  });
});
