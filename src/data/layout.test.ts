import { POLE_ZONES } from '../config/itsm';
import { LC_PLATEAU } from './sites';
import { describe, expect, it } from 'vitest';
import { createInitialState } from './demoData';
import { floors, helpdeskPoles, plateauOf, poleByClient, poleDesks, polesOf, roomById, rooms, roomsOnFloor } from './layout';
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
      const members = agents.filter((a) => a.clientId === pole.clientId && a.site === pole.site);
      expect(members.length, pole.label).toBeLessThanOrEqual(poleDesks(pole).length);
      expect(new Set(members.map((a) => a.desk)).size).toBe(members.length);
    }
  });
});

describe('pôles des plateaux Helpdesk', () => {
  it('associe un pôle à chaque client du plateau', () => {
    const { clients } = createInitialState(0);
    for (const c of clients) expect(poleByClient(c.id), c.id).toBeDefined();
    expect(polesOf('laciotat').map((p) => p.label)).toEqual(['Dédié · Thelem', 'Dédié · IRD', 'Dédié · Ortec', 'Dédié · PRIMAGAZ', 'Pôle Multi', 'Dédié · Sodiaal']);
    // Deux pôles distincts : Pôle Dédié (une équipe par client) et Pôle Multi.
    expect(helpdeskPoles.filter((p) => p.group === 'dedie').map((p) => p.clientId)).toEqual(POLE_ZONES.dedie.filter((z) => z !== 'sodiaal').concat('sodiaal'));
    // Un seul Pôle Multi, implanté sur les trois sites (même identifiant, même libellé).
    expect(new Set(helpdeskPoles.filter((p) => p.group === 'multi').map((p) => p.clientId))).toEqual(new Set(['multi']));
    expect(helpdeskPoles.filter((p) => p.group === 'multi').map((p) => p.site)).toEqual(['laciotat', 'montpellier', 'paris']);
    expect(new Set(helpdeskPoles.filter((p) => p.group === 'multi').map((p) => p.label))).toEqual(new Set(['Pôle Multi']));
    expect(polesOf('montpellier').map((p) => p.clientId)).toEqual(['multi']);
    expect(polesOf('paris').map((p) => p.clientId)).toEqual(['multi']);
    // Aucun agent ni file inventé pour Paris.
    const st = createInitialState(0);
    expect(st.agents.filter((a) => a.site === 'paris')).toHaveLength(0);
    expect(st.queues.filter((q) => q.site === 'paris')).toHaveLength(0);
  });

  it('le plateau de La Ciotat occupe tout l’étage 1 ; RH et Direction générale à l’étage 4', () => {
    expect(roomsOnFloor('etage1').map((r) => r.id)).toEqual(['helpdesk']);
    expect(plateauOf('laciotat').width).toBeGreaterThan(10);
    expect(roomById('rh').floor).toBe('lc-e4');
    expect(roomById('direction').floor).toBe('lc-e4');
  });

  it('chaque plateau est couvert par ses pôles (et la bande d’encadrement à La Ciotat), sans chevauchement', () => {
    for (const site of internalSites) {
      const room = plateauOf(site.id);
      const poles = polesOf(site.id);
      expect(poles.length, site.name).toBeGreaterThan(0);
      const area = poles.reduce((s, p) => s + p.width * p.depth, 0);
      const mgmt = site.id === 'laciotat' ? LC_PLATEAU.mgmt * room.depth : 0;
      expect(area + mgmt).toBeCloseTo(room.width * room.depth);
      // Les pôles ne débordent jamais sur la bande d'encadrement.
      if (mgmt) for (const p of poles) expect(p.x + p.width / 2).toBeLessThanOrEqual(room.width / 2 - LC_PLATEAU.mgmt + 1e-9);
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
    // Pôle d'appartenance et site d'affectation sont distincts : chaque agent a une implantation de son pôle sur son site.
    for (const a of createInitialState(0).agents) expect(poleByClient(a.clientId, a.site)!.site).toBe(a.site);
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
      for (const kind of ['helpdesk', 'mco', 'exploitation', 'formation', 'csm', 'finance', 'commercial', 'direction', 'recrutement', 'moyens', 'pause', 'accueil', 'reunion']) {
        expect(k.has(kind as never), `${site} : ${kind}`).toBe(true);
        expect(lc.has(kind as never), `La Ciotat : ${kind}`).toBe(true);
      }
    }
    expect(lc.has('rh')).toBe(true);
    expect(lc.has('stock')).toBe(true);
  });

  it('les déplacements professionnels relèvent des Moyens généraux (aucun espace ni département dédié)', () => {
    expect(rooms.some((r) => (r.kind as string) === 'deplacements')).toBe(false);
    expect(departments.some((d) => (d.id as string) === 'deplacements')).toBe(false);
    expect(departments.find((d) => d.id === 'moyens')!.description).toMatch(/déplacements/);
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
