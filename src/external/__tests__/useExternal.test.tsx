import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useExternal } from '../useExternal';

describe('écritures simulées vers les outils sources', () => {
  it('refuse les modifications sans droit d’édition', () => {
    const { result } = renderHook(() => useExternal(false));
    const t = result.current.state.tickets.invivo.find((x) => x.status === 'En cours')!;
    let r = { ok: true, message: '' };
    act(() => {
      r = result.current.moveTicket(t.id, 'Résolu', 'direction');
    });
    expect(r.ok).toBe(false);
    expect(result.current.state.tickets.invivo.find((x) => x.id === t.id)!.status).toBe('En cours');
  });

  it('PRIMAGAZ sur ServiceNow : tickets issus de ServiceNow, statuts source conservés', () => {
    const { result } = renderHook(() => useExternal(false));
    const list = result.current.state.tickets.primagaz;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.source.tool === 'ServiceNow' && /^INC\d{7}$/.test(t.source.id))).toBe(true);
    let r = { ok: false, message: '' };
    act(() => {
      r = result.current.createTicket('primagaz', { title: 'Test', description: '', category: '', priority: 'P3', site: '' }, 'responsable');
    });
    expect(r.ok).toBe(true);
  });

  it('crée un ticket dans la source simulée et le propage au référentiel', () => {
    const { result } = renderHook(() => useExternal(false));
    const before = result.current.state.tickets.monext.length;
    let r = { ok: false, message: '' };
    act(() => {
      r = result.current.createTicket('monext', { title: 'Terminal hors ligne', description: 'Test', category: 'Monétique', priority: 'P2', site: '' }, 'teamLeader');
    });
    expect(r.ok).toBe(true);
    const created = result.current.state.tickets.monext.find((t) => t.title === 'Terminal hors ligne')!;
    expect(result.current.state.tickets.monext).toHaveLength(before + 1);
    expect(created.source.tool).toBe('ISILOG');
    expect(created.status).toBe('Nouveau');
    expect(created.sourceStatus).toBe('Enregistré');
    expect(result.current.state.writes[0].message).toMatch(/démonstration, aucun envoi réel/);
  });

  it('applique une transition autorisée, conserve l’identifiant et trace l’historique', () => {
    const { result } = renderHook(() => useExternal(false));
    const t = result.current.state.tickets.invivo.find((x) => x.status === 'En cours')!;
    let r = { ok: false, message: '' };
    act(() => {
      r = result.current.moveTicket(t.id, 'Résolu', 'teamLeader');
    });
    expect(r.ok).toBe(true);
    const updated = result.current.state.tickets.invivo.find((x) => x.id === t.id)!;
    expect(updated.status).toBe('Résolu');
    expect(updated.source).toEqual(t.source);
    expect(updated.history.length).toBe(t.history.length + 1);
    expect(updated.resolvedAt).not.toBeNull();
    expect(result.current.state.writes[0].message).toMatch(/EasyVista/);
  });

  it('applique les règles de la source (ISILOG : un ticket clôturé ne peut qu’être réouvert)', () => {
    const { result } = renderHook(() => useExternal(false));
    const t = result.current.state.tickets.monext.find((x) => x.status === 'Clôturé')!;
    let r = { ok: true, message: '' };
    act(() => {
      r = result.current.moveTicket(t.id, 'En cours', 'responsable');
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/réouvert/);
  });
});
