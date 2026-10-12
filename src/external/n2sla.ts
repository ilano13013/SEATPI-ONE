// SLA des tickets N2 (MCO chez les clients) : prise en charge et résolution, calculés
// séparément à partir des délais contractuels (matrice SLA du client, en temps ouvré) et
// des informations de l'ITSM. Sans rapport avec le SLA décroché téléphonique.
import type { Ticket } from './types';
import { isOpen, resolvedIn, resolvedWithinSla, type Period } from './metrics';

/** Délai (ms) en dessous duquel une échéance proche est signalée comme risque. */
export const RISK_WINDOW_MS = 60 * 60_000;

export interface SlaSplitPart {
  /** Tickets conformes / hors SLA sur la période (base du résultat). */
  compliant: string[];
  breached: string[];
  /** Tickets ouverts dont l'échéance approche (ou déjà « à risque »). */
  atRisk: string[];
  /** Résultat (%) = conformes ÷ (conformes + hors SLA) ; null si aucun ticket mesurable. */
  rate: number | null;
  /** Prochaine échéance parmi les tickets ouverts concernés. */
  nextDue: number | null;
}

export interface N2SlaSplit {
  takeCharge: SlaSplitPart;
  resolution: SlaSplitPart;
}

const rate = (ok: number, ko: number) => (ok + ko ? Math.round((ok / (ok + ko)) * 1000) / 10 : null);
const ids = (l: Ticket[]) => l.map((t) => t.id);

export function n2SlaSplit(tickets: Ticket[], p: Period, now: number): N2SlaSplit {
  // Prise en charge : tickets créés sur la période.
  const created = tickets.filter((t) => t.createdAt >= p.start && t.createdAt < p.end);
  const tcOk = created.filter((t) => t.sla.takeChargeMet === true);
  const tcKo = created.filter((t) => t.sla.takeChargeMet === false || (t.takenAt === null && isOpen(t) && now > t.sla.takeChargeDueAt));
  const notTaken = tickets.filter((t) => t.takenAt === null && isOpen(t) && t.sla.takeChargeDueAt >= now);
  const tcRisk = notTaken.filter((t) => t.sla.takeChargeDueAt - now <= RISK_WINDOW_MS);
  // Résolution : tickets résolus sur la période, dans ou hors délai ; risques parmi les ouverts.
  const resolved = tickets.filter((t) => resolvedIn(t, p));
  const resOk = resolved.filter(resolvedWithinSla);
  const resKo = resolved.filter((t) => !resolvedWithinSla(t));
  const open = tickets.filter((t) => isOpen(t));
  const resRisk = open.filter((t) => t.sla.state === 'à risque' || (t.sla.dueAt !== null && t.sla.dueAt >= now && t.sla.dueAt - now <= RISK_WINDOW_MS));
  const dues = (l: number[]) => (l.length ? Math.min(...l) : null);
  return {
    takeCharge: { compliant: ids(tcOk), breached: ids(tcKo), atRisk: ids(tcRisk), rate: rate(tcOk.length, tcKo.length), nextDue: dues(notTaken.map((t) => t.sla.takeChargeDueAt)) },
    resolution: {
      compliant: ids(resOk),
      breached: ids([...resKo, ...open.filter((t) => t.sla.state === 'dépassé')]),
      atRisk: ids(resRisk),
      rate: rate(resOk.length, resKo.length),
      nextDue: dues(open.filter((t) => t.sla.dueAt !== null && t.sla.dueAt >= now).map((t) => t.sla.dueAt!)),
    },
  };
}
