import { describe, expect, it } from 'vitest';
import { createInitialState } from './demoData';
import { floors, helpdeskPoles, poleByClient, poleDesks, roomById, rooms, roomsOnFloor } from './layout';

describe('plan du bâtiment', () => {
  it('propose au moins six pièces sélectionnables aux identifiants uniques', () => {
    expect(rooms.length).toBeGreaterThanOrEqual(6);
    expect(new Set(rooms.map((r) => r.id)).size).toBe(rooms.length);
  });

  it("n'a pas de pièces qui se chevauchent sur un même étage", () => {
    for (const f of floors) {
      const list = roomsOnFloor(f.id);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
          const overlapZ = Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
          expect(overlapX && overlapZ, `${a.id} / ${b.id}`).toBe(false);
        }
      }
    }
  });

  it('dispose d’un poste distinct par agent dans son pôle', () => {
    const { agents } = createInitialState(0);
    for (const pole of helpdeskPoles) {
      const members = agents.filter((a) => a.clientId === pole.clientId);
      expect(members.length, pole.label).toBeLessThanOrEqual(poleDesks(pole).length);
      expect(new Set(members.map((a) => a.desk)).size).toBe(members.length);
    }
  });
});

describe('pôles du plateau Helpdesk', () => {
  it('associe un pôle à chaque client', () => {
    const { clients } = createInitialState(0);
    for (const c of clients) expect(poleByClient(c.id)?.label).toBe(`Pôle ${c.name}`);
    expect(helpdeskPoles.map((p) => p.label)).toEqual(['Pôle Thelem', 'Pôle IRD', 'Pôle Ortec', 'Pôle Multi dédié', 'Pôle Sodiaal']);
  });

  it('couvre le plateau entier sans chevauchement', () => {
    const room = roomById('helpdesk');
    const area = helpdeskPoles.reduce((s, p) => s + p.width * p.depth, 0);
    expect(area).toBeCloseTo(room.width * room.depth);
    for (const p of helpdeskPoles) {
      expect(Math.abs(p.x) + p.width / 2).toBeLessThanOrEqual(room.width / 2 + 1e-9);
      expect(Math.abs(p.z) + p.depth / 2).toBeLessThanOrEqual(room.depth / 2 + 1e-9);
    }
    for (let i = 0; i < helpdeskPoles.length; i++) {
      for (let j = i + 1; j < helpdeskPoles.length; j++) {
        const a = helpdeskPoles[i];
        const b = helpdeskPoles[j];
        const overlap = Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-9 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 1e-9;
        expect(overlap, `${a.label} / ${b.label}`).toBe(false);
      }
    }
  });
});

describe('données fictives', () => {
  it('présente au moins quatre clients avec des files', () => {
    const { clients, queues } = createInitialState(0);
    expect(clients.length).toBeGreaterThanOrEqual(4);
    for (const c of clients) expect(queues.some((q) => q.clientId === c.id)).toBe(true);
  });

  it('utilise uniquement des pseudonymes d’agents', () => {
    for (const a of createInitialState(0).agents) expect(a.name).toMatch(/^Agent [A-Z]\d{2}$/);
  });
});
