import { describe, expect, it } from 'vitest';
import { createInitialState } from './demoData';
import { floors, helpdeskDesks, rooms, roomsOnFloor } from './layout';

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

  it('dispose d’un poste distinct par agent sur le plateau', () => {
    const { agents } = createInitialState(0);
    expect(agents.length).toBeLessThanOrEqual(helpdeskDesks.length);
    expect(new Set(agents.map((a) => a.desk)).size).toBe(agents.length);
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
