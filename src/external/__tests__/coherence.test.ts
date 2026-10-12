import { describe, expect, it } from 'vitest';
import type { Ticket } from '../types';
import { externalClients, clientById, defaultObjectives } from '../config';
import { backlogAt, CLOSED_STATUSES, computeKpis, createdIn, isOpen, isOpenAt, periods, resolvedIn, slaRate, type Period } from '../metrics';
import { computeObjectives, weekProgress } from '../objectives';
import { buildClientReport, consolidateReports } from '../report';
import { at, dataset, NOW, techs, ticketFrom } from './fixtures';

const { tickets } = dataset();
const all = externalClients.flatMap((c) => tickets[c.id]);

describe('cohérence des statuts', () => {
  it('le statut courant est celui du dernier événement et l’historique est chaîné', () => {
    for (const t of all) {
      const changes = t.history.filter((e) => e.kind === 'statut');
      expect(t.status).toBe(changes.length ? changes[changes.length - 1].to : 'Nouveau');
      let prev = 'Nouveau';
      let last = t.createdAt;
      for (const e of changes) {
        expect(e.from, t.id).toBe(prev);
        expect(e.at).toBeGreaterThanOrEqual(last);
        prev = e.to!;
        last = e.at;
      }
    }
  });

  it('les dates dérivées sont cohérentes avec le statut', () => {
    for (const t of all) {
      expect(t.resolvedAt !== null, t.id).toBe(CLOSED_STATUSES.includes(t.status));
      expect(t.closedAt !== null).toBe(t.status === 'Clôturé');
      if (t.resolvedAt && t.takenAt) expect(t.takenAt).toBeLessThanOrEqual(t.resolvedAt);
      if (t.status !== 'Nouveau' && t.status !== 'Affecté') expect(t.takenAt).not.toBeNull();
      if (t.status === 'Affecté' || t.status === 'En cours') expect(t.assigneeId).not.toBeNull();
      expect(t.updatedAt).toBeLessThanOrEqual(NOW);
    }
  });
});

describe('cohérence du backlog', () => {
  const flow = (list: Ticket[], p: Period) => {
    // Rejoue les événements de la période : +1 création, −1 sortie (résolu/clôturé), +1 réouverture.
    let delta = 0;
    for (const t of list) {
      if (createdIn(t, p)) delta += 1;
      let open = t.createdAt < p.start ? isOpenAt(t, p.start) : true;
      for (const e of t.history) {
        if (e.kind !== 'statut' || e.at < p.start || e.at >= p.end) continue;
        const nowOpen = !CLOSED_STATUSES.includes(e.to as Ticket['status']);
        if (open && !nowOpen) delta -= 1;
        if (!open && nowOpen) delta += 1;
        open = nowOpen;
      }
    }
    return delta;
  };

  it('backlog fin = backlog début + entrées − sorties, pour chaque client et période', () => {
    for (const c of externalClients) {
      for (const p of Object.values(periods(NOW))) {
        const list = tickets[c.id];
        expect(backlogAt(list, p.end).length - backlogAt(list, p.start).length, `${c.id} ${p.key}`).toBe(flow(list, p));
      }
    }
  });

  it('le backlog courant correspond aux tickets ouverts', () => {
    for (const c of externalClients) expect(backlogAt(tickets[c.id], NOW).length).toBe(tickets[c.id].filter(isOpen).length);
  });
});

describe('tickets réouverts', () => {
  const week = periods(NOW).week;
  // Résolu lundi, réouvert mardi, résolu à nouveau mardi : une seule résolution comptée.
  const t = ticketFrom(at(12, 9), [
    [at(12, 9, 10), 'En cours'],
    [at(12, 11), 'Résolu'],
    [at(13, 9), 'Réouvert'],
    [at(13, 9, 30), 'En cours'],
    [at(13, 11), 'Résolu'],
  ]);

  it('un ticket résolu deux fois dans la période n’est compté qu’une fois', () => {
    expect(resolvedIn(t, week)).toBe(true);
    const kpis = computeKpis([t], { now: NOW, period: week, clients: { invivo: clientById('invivo') }, headcount: 1 });
    expect(kpis.find((k) => k.id === 'resolved')!.value).toBe(1);
    expect(kpis.find((k) => k.id === 'reopened')!.value).toBe(1);
    const obj = computeObjectives([t], clientById('invivo'), defaultObjectives.invivo, NOW);
    expect(obj.find((o) => o.key === 'ticketsToResolve')!.actual).toBe(1);
    expect(obj.find((o) => o.key === 'reopenRateMax')!.actual).toBe(100);
  });

  it('un ticket réouvert redevient ouvert puis sort du backlog à la nouvelle résolution', () => {
    expect(isOpenAt(t, at(13, 10))).toBe(true);
    expect(isOpenAt(t, at(13, 12))).toBe(false);
  });
});

describe('calcul des objectifs', () => {
  const client = clientById('invivo');
  const cfg = { ...defaultObjectives.invivo, ticketsToResolve: 1000, backlogMax: 1 };
  const rows = computeObjectives(tickets.invivo, client, cfg, NOW);
  const row = (k: string) => rows.find((r) => r.key === k)!;

  it('réalisé, reste à faire et écart', () => {
    const resolved = tickets.invivo.filter((t) => resolvedIn(t, periods(NOW).week)).length;
    expect(row('ticketsToResolve').actual).toBe(resolved);
    expect(row('ticketsToResolve').remaining).toBe(1000 - resolved);
    expect(row('ticketsToResolve').gap).toBe(resolved - 1000);
    const backlog = tickets.invivo.filter(isOpen).length;
    expect(row('backlogMax').actual).toBe(backlog);
    expect(row('backlogMax').remaining).toBe(backlog - 1);
    expect(row('backlogMax').status).toBe('à risque');
  });

  it('projection de fin de semaine au prorata du temps ouvré écoulé', () => {
    const progress = weekProgress(NOW, client);
    expect(progress).toBeCloseTo((2 * 600 + 450) / 3000, 6); // lun, mar + mer 8h–15h30
    expect(row('ticketsToResolve').projection).toBe(Math.round(row('ticketsToResolve').actual! / progress));
  });

  it('distingue objectifs de volume et de qualité', () => {
    expect(rows.filter((r) => r.kind === 'volume').map((r) => r.key)).toEqual(['ticketsToResolve', 'backlogMax', 'priorityOpenMax']);
    expect(rows.filter((r) => r.kind === 'qualité')).toHaveLength(4);
  });

  it('le SLA des objectifs est identique à celui du cockpit', () => {
    expect(row('slaMin').actual).toBe(slaRate(tickets.invivo, periods(NOW).week).rate);
  });
});

describe('consolidation multi-clients', () => {
  const p = periods(NOW).prevWeek;
  const reports = externalClients.map((c) => buildClientReport(c, tickets[c.id], techs.filter((t) => t.clientId === c.id), defaultObjectives[c.id], p, NOW));
  const dept = consolidateReports(reports);

  it('les totaux du département sont la somme des clients', () => {
    const sum = (f: (r: (typeof reports)[number]) => number) => reports.reduce((s, r) => s + f(r), 0);
    expect(dept.received).toBe(sum((r) => r.received));
    expect(dept.resolved).toBe(sum((r) => r.resolved));
    expect(dept.backlogStart).toBe(sum((r) => r.backlogStart));
    expect(dept.backlogEnd).toBe(sum((r) => r.backlogEnd));
    expect(dept.headcount).toBe(techs.length);
    expect(dept.finance.cost).toBe(sum((r) => r.finance.cost));
    expect(dept.majorIncidents).toHaveLength(sum((r) => r.majorIncidents.length));
  });

  it('le SLA consolidé est recalculé sur l’ensemble des résolutions', () => {
    expect(dept.slaRate).toBe(slaRate(all, p).rate);
  });

  it('le rapport utilise les mêmes données que le cockpit', () => {
    for (const r of reports) {
      const list = tickets[r.scope as keyof typeof tickets];
      expect(r.resolved).toBe(list.filter((t) => resolvedIn(t, p)).length);
      expect(r.backlogEnd).toBe(backlogAt(list, p.end).length);
    }
  });
});
