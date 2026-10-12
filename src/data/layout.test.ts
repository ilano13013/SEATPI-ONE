import { describe, expect, it } from 'vitest';
import { createInitialState } from './demoData';
import { floors, helpdeskPoles, plateauOf, poleByClient, poleDesks, polesOf, rooms, roomsOnFloor } from './layout';
import { departments, internalSites } from './sites';

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

describe('pôles des plateaux Helpdesk', () => {
  it('associe un pôle à chaque client du plateau', () => {
    const { clients } = createInitialState(0);
    for (const c of clients) expect(poleByClient(c.id)?.label).toBe(`Pôle ${c.name.replace(' (Montpellier)', '')}`);
    expect(polesOf('laciotat').map((p) => p.label)).toEqual(['Pôle Thelem', 'Pôle IRD', 'Pôle Ortec', 'Pôle Multi', 'Pôle Sodiaal']);
    // Le Pôle Multi est présent à La Ciotat et à Montpellier ; aucun pôle client à Paris.
    expect(polesOf('montpellier').map((p) => p.clientId)).toEqual(['multi-mtp']);
    expect(polesOf('paris')).toEqual([]);
  });

  it('chaque plateau est entièrement couvert par ses pôles, sans chevauchement', () => {
    for (const site of internalSites.filter((s) => s.id !== 'paris')) {
      const room = plateauOf(site.id);
      const poles = polesOf(site.id);
      expect(poles.length, site.name).toBeGreaterThan(0);
      const area = poles.reduce((s, p) => s + p.width * p.depth, 0);
      expect(area).toBeCloseTo(room.width * room.depth);
      for (const p of poles) {
        expect(Math.abs(p.x) + p.width / 2).toBeLessThanOrEqual(room.width / 2 + 1e-9);
        expect(Math.abs(p.z) + p.depth / 2).toBeLessThanOrEqual(room.depth / 2 + 1e-9);
      }
      for (let i = 0; i < poles.length; i++) {
        for (let j = i + 1; j < poles.length; j++) {
          const a = poles[i];
          const b = poles[j];
          const overlap = Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-9 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 1e-9;
          expect(overlap, `${a.label} / ${b.label}`).toBe(false);
        }
      }
    }
  });

  it('les agents d’un pôle sont sur le site du pôle', () => {
    for (const a of createInitialState(0).agents) expect(poleByClient(a.clientId)!.site).toBe(a.site);
  });
});

describe('trois sites internes', () => {
  it('La Ciotat est le site principal', () => {
    expect(internalSites.map((s) => s.name)).toEqual(['La Ciotat', 'Montpellier', 'Paris']);
    expect(internalSites.filter((s) => s.main).map((s) => s.id)).toEqual(['laciotat']);
  });

  it('mêmes services sur les trois sites, sauf RH et Stock uniquement à La Ciotat', () => {
    const kindsOf = (site: string) => new Set(rooms.filter((r) => r.location === site).map((r) => r.kind));
    const lc = kindsOf('laciotat');
    for (const site of ['montpellier', 'paris']) {
      const k = kindsOf(site);
      expect(k.has('rh')).toBe(false);
      expect(k.has('stock')).toBe(false);
      for (const kind of ['helpdesk', 'mco', 'exploitation', 'formation', 'csm', 'finance', 'commercial', 'direction', 'recrutement', 'moyens', 'deplacements', 'pause', 'accueil', 'reunion']) {
        expect(k.has(kind as never), `${site} : ${kind}`).toBe(true);
        expect(lc.has(kind as never), `La Ciotat : ${kind}`).toBe(true);
      }
    }
    expect(lc.has('rh')).toBe(true);
    expect(lc.has('stock')).toBe(true);
  });

  it('chaque département de la configuration dispose d’un espace sur ses sites', () => {
    const map: Record<string, string> = { helpdesk: 'helpdesk', stock: 'stock' };
    for (const d of departments) {
      for (const site of d.sites) {
        expect(rooms.some((r) => r.location === site && r.kind === (map[d.id] ?? d.id)), `${d.label} @ ${site}`).toBe(true);
      }
    }
  });

  it('la carte présente les trois bâtiments et les sites clients externes', () => {
    const carte = roomsOnFloor('carte');
    expect(carte.filter((r) => r.kind === 'building').map((r) => r.targetSite)).toEqual(['laciotat', 'montpellier', 'paris']);
    expect(carte.filter((r) => r.externalClientId).map((r) => r.externalClientId)).toEqual(['invivo', 'primagaz', 'monext']);
  });

  it('identifiants d’espaces et d’étages uniques', () => {
    expect(new Set(rooms.map((r) => r.id)).size).toBe(rooms.length);
    expect(new Set(floors.map((f) => f.id)).size).toBe(floors.length);
    for (const r of rooms) expect(floors.some((f) => f.id === r.floor && f.location === r.location), r.id).toBe(true);
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
