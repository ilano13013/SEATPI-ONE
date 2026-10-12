import { describe, expect, it } from 'vitest';
import { adapters, ALL_PRIORITIES, ALL_STATUSES, checkTransition, MappingError, glpiAdapter, jiraAdapter, easyVistaAdapter, serviceManagerAdapter } from '../itsm/adapters';
import { dedupeRaw, registerId, emptyRegistry, readSource, syncClient } from '../sync';
import { clientById, externalClients } from '../config';
import { createRng } from '../../services/random';
import { dataset, NOW, techs } from './fixtures';

describe('adaptateurs ITSM', () => {
  const { sources } = dataset();
  const sample = sources.invivo.find((r) => r.escalations.length > 0) ?? sources.invivo[0];

  it.each(Object.keys(adapters))('%s : conversion aller-retour sans perte', (tool) => {
    const a = adapters[tool as keyof typeof adapters];
    // GLPI utilise des identifiants numériques.
    const rec = tool === 'GLPI' ? { ...sample, sourceId: '48210' } : sample;
    expect(a.normalize(a.exportRaw(rec))).toEqual(rec);
  });

  it.each(Object.keys(adapters))('%s : statut et priorité d’origine conservés', (tool) => {
    const a = adapters[tool as keyof typeof adapters];
    const raw = a.exportRaw(tool === 'GLPI' ? { ...sample, sourceId: '48210' } : sample);
    expect(a.sourceStatusOf(raw)).toBe(a.statusToRaw[sample.status]);
    expect(a.sourcePriorityOf(raw)).toBe(a.priorityToRaw[sample.priority]);
  });

  it.each(Object.keys(adapters))('%s : correspondance complète des statuts et priorités', (tool) => {
    const a = adapters[tool as keyof typeof adapters];
    for (const s of ALL_STATUSES) expect(a.statusMap[a.statusToRaw[s]]).toBe(s);
    for (const p of ALL_PRIORITIES) expect(a.priorityMap[a.priorityToRaw[p]]).toBe(p);
    expect(new Set(Object.values(a.statusToRaw)).size).toBe(ALL_STATUSES.length);
  });

  it('rejette un statut source inconnu avec une erreur de correspondance', () => {
    const raw = jiraAdapter.exportRaw({ ...sample, sourceId: 'LBR-1' });
    raw.fields.status.name = 'Pending vendor';
    expect(() => jiraAdapter.normalize(raw)).toThrow(MappingError);
  });

  it('respecte les capacités de l’outil source', () => {
    expect(checkTransition(serviceManagerAdapter, 'En cours', 'Résolu').ok).toBe(false);
    expect(checkTransition(easyVistaAdapter, 'En cours', 'Clôturé').ok).toBe(false);
    expect(checkTransition(glpiAdapter, 'En cours', 'Clôturé').ok).toBe(false);
    expect(checkTransition(glpiAdapter, 'Résolu', 'Clôturé').ok).toBe(true);
    expect(checkTransition(glpiAdapter, 'Clôturé', 'En cours').ok).toBe(false);
    expect(checkTransition(jiraAdapter, 'Nouveau', 'Résolu').ok).toBe(false);
    expect(checkTransition(jiraAdapter, 'En cours', 'Résolu').ok).toBe(true);
    expect(checkTransition(jiraAdapter, 'Clôturé', 'Réouvert').ok).toBe(true);
  });
});

describe('synchronisation et référentiel interne', () => {
  it('déduplique en gardant la version la plus récente', () => {
    const { sources } = dataset();
    const rec = sources.invivo[0];
    const older = easyVistaAdapter.exportRaw({ ...rec, updatedAt: rec.updatedAt - 3_600_000, status: 'Nouveau' });
    const { unique, duplicates } = dedupeRaw([older, easyVistaAdapter.exportRaw(rec)], easyVistaAdapter);
    expect(duplicates).toBe(1);
    expect(easyVistaAdapter.normalize(unique[0]).status).toBe(rec.status);
  });

  it('absence de doublons et identifiants uniques sur l’ensemble des clients', () => {
    const { tickets, stats } = dataset();
    const all = externalClients.flatMap((c) => tickets[c.id]);
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    expect(new Set(all.map((t) => `${t.source.tool}:${t.source.id}`)).size).toBe(all.length);
    // Flux ISILOG (MONEXT) : 3 doublons de pagination et un statut inconnu rejeté.
    expect(stats.monext.duplicates).toBe(3);
    expect(stats.monext.rejected).toBe(1);
    expect(stats.invivo.duplicates).toBe(1);
  });

  it('conserve l’identifiant interne d’une synchronisation à l’autre', () => {
    const client = clientById('invivo');
    const { sources, registry, tickets } = dataset();
    const again = syncClient(client, readSource(client, sources.invivo, createRng(3)), tickets.invivo, registry, techs, NOW + 60_000);
    expect(again.registry).toEqual(registry);
    expect(again.stats.created).toBe(0);
    expect(again.tickets.map((t) => t.id).sort()).toEqual(tickets.invivo.map((t) => t.id).sort());
  });

  it('attribue un identifiant interne unique par couple outil / identifiant source', () => {
    let r = emptyRegistry();
    let a: string;
    let b: string;
    let c: string;
    [r, a] = registerId(r, 'GLPI', '100');
    [r, b] = registerId(r, 'Jira', '100');
    [r, c] = registerId(r, 'GLPI', '100');
    expect(a).not.toBe(b);
    expect(c).toBe(a);
    // Même outil, même numéro, clients (instances) différents : identifiants distincts.
    let d: string;
    [r, d] = registerId(r, 'ISILOG', '42', 'thelem');
    const [, e] = registerId(r, 'ISILOG', '42', 'transgourmet');
    expect(d).not.toBe(e);
  });
});
