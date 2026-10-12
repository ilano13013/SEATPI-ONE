import { describe, expect, it } from 'vitest';
import { at, ticketFrom } from './fixtures';

// INVIVO, Lun–Ven 8h–18h. P1 : prise en charge 15 min / résolution 4 h ; P2 : 30 min / 8 h.
describe('calcul des SLA', () => {
  it('ticket ouvert proche de l’échéance', () => {
    const t = ticketFrom(at(12, 9), [[at(12, 9, 10), 'Affecté'], [at(12, 9, 20), 'En cours']], 'P2', at(12, 16));
    expect(t.sla.consumedMin).toBe(420);
    expect(t.sla.dueAt).toBe(at(12, 17));
    expect(t.sla.state).toBe('à risque');
    expect(t.sla.takeChargeMet).toBe(true);
  });

  it('suspend le décompte en attente client', () => {
    const t = ticketFrom(at(12, 9), [[at(12, 9, 30), 'En cours'], [at(12, 10), 'En attente'], [at(12, 15), 'En cours']], 'P2', at(12, 16));
    // 9h–10h + 15h–16h = 120 min consommées ; reste 360 min → mardi 12:00
    expect(t.sla.consumedMin).toBe(120);
    expect(t.sla.dueAt).toBe(at(13, 12));
    expect(t.sla.state).toBe('respecté');
  });

  it('pendant la suspension, l’échéance n’est pas fixée', () => {
    const t = ticketFrom(at(12, 9), [[at(12, 9, 30), 'En cours'], [at(12, 10), 'En attente']], 'P2', at(12, 16));
    expect(t.sla.paused).toBe(true);
    expect(t.sla.dueAt).toBeNull();
  });

  it('détecte un dépassement et la date où il a eu lieu', () => {
    const t = ticketFrom(at(12, 9), [[at(12, 9, 5), 'En cours'], [at(12, 14), 'Résolu']], 'P1', at(12, 16));
    expect(t.sla.consumedMin).toBe(300);
    expect(t.sla.state).toBe('dépassé');
    expect(t.sla.dueAt).toBe(at(12, 13));
  });

  it('une réouverture reprend le décompte là où il s’était arrêté', () => {
    const t = ticketFrom(at(12, 9), [[at(12, 9, 10), 'En cours'], [at(12, 11), 'Résolu'], [at(13, 9), 'Réouvert'], [at(13, 9, 30), 'En cours']], 'P2', at(13, 10));
    expect(t.sla.consumedMin).toBe(180);
    expect(t.reopenCount).toBe(1);
  });

  it('évalue le délai de prise en charge', () => {
    const late = ticketFrom(at(12, 9), [[at(12, 9, 40), 'En cours']], 'P1', at(12, 10));
    expect(late.sla.takeChargeDueAt).toBe(at(12, 9, 15));
    expect(late.sla.takeChargeMet).toBe(false);
    const pending = ticketFrom(at(12, 9), [], 'P1', at(12, 9, 5));
    expect(pending.sla.takeChargeMet).toBeNull();
  });
});
