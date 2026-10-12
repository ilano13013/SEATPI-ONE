import { describe, expect, it } from 'vitest';
import { adapters, ALL_PRIORITIES, ALL_STATUSES, checkTransition, MappingError, glpiAdapter, jiraAdapter, easyVistaAdapter } from '../itsm/adapters';
import { dedupeRaw, registerId, emptyRegistry, readSource, syncClient } from '../sync';
import { clientById, externalClients } from '../config';
import { createRng } from '../../services/random';
import { dataset, NOW, techs } from './fixtures';

describe('adaptateurs ITSM', () => {
  const { sources } = dataset();
  const sample = sources.invivo.find((r) => r.escalations.length > 0) ?? sources.invivo[0];

  it.each(Object.keys(adapters))('%s : conversion aller-retour sans perte', (tool) => {
    const a = adapters[tool as keyof typeof adapters];
    expect(a.normalize(a.exportRaw(sample))).toEqual(sample);
  });

  it.each(Object.keys(adapters))('%s : correspondance complète des statuts et priorités', (tool) => {
    const a = adapters[tool as keyof typeof adapters];
    for (const s of ALL_STATUSES) expect(a.statusMap[a.statusToRaw[s]]).toBe(s);
    for (const p of ALL_PRIORITIES) expect(a.priorityMap[a.priorityToRaw[p]]).toBe(p);
    expect(new Set(Object.values(a.statusToRaw)).size).toBe(ALL_STATUSES.length);
  });

  it('rejette un statut source inconnu avec une erreur de correspondance', () => {
    const raw = jiraAdapter.exportRaw(sample);
    raw.fields.status.name = 'Pending vendor';
    expect(() => jiraAdapter.normalize(raw)).toThrow(MappingError);
  });

  it('respecte les capacités de l’outil source', () => {
    expect(checkTransition(easyVistaAdapter, 'En cours', 'Résolu').ok).toBe(false);
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
    const older = glpiAdapter.exportRaw({ ...rec, updatedAt: rec.updatedAt - 3_600_000, status: 'Nouveau' });
    const { unique, duplicates } = dedupeRaw([older, glpiAdapter.exportRaw(rec)], glpiAdapter);
    expect(duplicates).toBe(1);
    expect(glpiAdapter.normalize(unique[0]).status).toBe(rec.status);
  });

  it('absence de doublons et identifiants uniques sur l’ensemble des clients', () => {
    const { tickets, stats } = dataset();
    const all = externalClients.flatMap((c) => tickets[c.id]);
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    expect(new Set(all.map((t) => `${t.source.tool}:${t.source.id}`)).size).toBe(all.length);
    // Flux Jira : 3 doublons de pagination et un statut inconnu rejeté.
    expect(stats.monext.duplicates).toBe(3);
    expect(stats.monext.rejected).toBe(1);
    expect(stats.invivo.duplicates).toBe(1);
  });

  it('conserve l’identifiant interne d’une synchronisation à l’autre', () => {
    const client = clientById('primagaz');
    const { sources, registry, tickets } = dataset();
    const again = syncClient(client, readSource(client, sources.primagaz, createRng(3)), tickets.primagaz, registry, techs, NOW + 60_000);
    expect(again.registry).toEqual(registry);
    expect(again.stats.created).toBe(0);
    expect(again.tickets.map((t) => t.id).sort()).toEqual(tickets.primagaz.map((t) => t.id).sort());
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
  });
});
