import { describe, expect, it } from 'vitest';
import { externalClients, externalTeams, clientById } from '../config';
import { initialTrips, tripStatus, activeTripOf, isTripActive, type Trip } from '../trips';
import { csmTeam, receivedEscalations, serviceSummary } from '../services';
import type { ClientView } from '../derive';
import { createRng } from '../../services/random';
import { dataset, NOW, techs } from './fixtures';

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

describe('déplacements des techniciens', () => {
  const trip: Trip = { id: 'D1', clientId: 'invivo', techId: 'tech-inv-01', ticketId: 'SPI-1', from: 'Siège', to: 'Site régional Ouest', transport: 'Transport en commun', departAt: NOW, travelMin: 30, onSiteMin: 60 };
  const m = 60_000;

  it('enchaîne aller, intervention sur site et retour', () => {
    expect(tripStatus(trip, NOW + 15 * m)).toMatchObject({ phase: 'En route', progress: 0.5 });
    expect(tripStatus(trip, NOW + 45 * m).phase).toBe('Sur site');
    expect(tripStatus(trip, NOW + 105 * m)).toMatchObject({ phase: 'Retour', progress: 0.5 });
    expect(tripStatus(trip, NOW + 121 * m).phase).toBe('Terminé');
    expect(tripStatus(trip, NOW).backAt).toBe(NOW + 120 * m);
  });

  it('génère des déplacements cohérents avec les tickets et les techniciens', () => {
    for (const c of externalClients) {
      const trips = initialTrips(tickets[c.id], techs, clientById(c.id), NOW, createRng(5));
      expect(trips.length).toBeGreaterThan(0);
      for (const t of trips) {
        const ticket = tickets[c.id].find((x) => x.id === t.ticketId)!;
        expect(ticket.assigneeId).toBe(t.techId);
        expect(t.to).toBe(ticket.site);
        expect(t.to).not.toBe(t.from);
        expect(isTripActive(t, NOW)).toBe(true);
        expect(activeTripOf(trips, t.techId, NOW)).toBe(t);
      }
      // Un technicien n'effectue qu'un déplacement à la fois.
      expect(new Set(trips.map((t) => t.techId)).size).toBe(trips.length);
    }
  });
});
