// Alertes de supervision et état opérationnel des sites clients.
import type { ExternalClient, Ticket } from './types';
import type { ObjectiveConfig } from './config';
import { isOpen, isPriority } from './metrics';
import type { TeamLoad } from './workload';

export type AlertKind =
  | 'sans affectation'
  | 'sans mise à jour'
  | 'proche SLA'
  | 'hors SLA'
  | 'prioritaire non pris en charge'
  | 'backlog au-dessus du seuil'
  | 'surcharge équipe';

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: 'warn' | 'critical';
  clientId: string;
  message: string;
  ticketIds: string[];
  teamId?: string;
}

export interface AlertSettings {
  /** Durée sans mise à jour (heures) au-delà de laquelle un ticket est signalé. */
  staleHours: number;
}

export const defaultAlertSettings: AlertSettings = { staleHours: 24 };

export type TicketFlag = 'non affecté' | 'sans MAJ' | 'proche SLA' | 'hors SLA' | 'P1/P2 non pris';

export function ticketFlags(t: Ticket, now: number, settings: AlertSettings): TicketFlag[] {
  if (!isOpen(t)) return [];
  const flags: TicketFlag[] = [];
  if (!t.assigneeId) flags.push('non affecté');
  if (now - t.updatedAt > settings.staleHours * 3_600_000) flags.push('sans MAJ');
  if (t.sla.state === 'dépassé') flags.push('hors SLA');
  else if (t.sla.state === 'à risque') flags.push('proche SLA');
  if (isPriority(t.priority) && t.takenAt === null) flags.push('P1/P2 non pris');
  return flags;
}

export function computeAlerts(tickets: Ticket[], client: ExternalClient, cfg: ObjectiveConfig, settings: AlertSettings, loads: TeamLoad[], now: number): Alert[] {
  const open = tickets.filter(isOpen);
  const alerts: Alert[] = [];
  const push = (kind: AlertKind, severity: Alert['severity'], list: Ticket[], message: string, teamId?: string) => {
    if (list.length) alerts.push({ id: `${client.id}-${kind}-${teamId ?? ''}`, kind, severity, clientId: client.id, message, ticketIds: list.map((t) => t.id), teamId });
  };
  const breached = open.filter((t) => t.sla.state === 'dépassé');
  push('hors SLA', breached.some((t) => t.priority === 'P1') || breached.length >= 6 ? 'critical' : 'warn', breached, `${breached.length} ticket(s) hors SLA`);
  const notTaken = open.filter((t) => isPriority(t.priority) && t.takenAt === null);
  push('prioritaire non pris en charge', 'critical', notTaken, `${notTaken.length} ticket(s) P1/P2 non pris en charge`);
  const risk = open.filter((t) => t.sla.state === 'à risque');
  push('proche SLA', 'warn', risk, `${risk.length} ticket(s) proche(s) de l’échéance SLA`);
  const unassigned = open.filter((t) => !t.assigneeId);
  push('sans affectation', 'warn', unassigned, `${unassigned.length} ticket(s) sans affectation`);
  const stale = open.filter((t) => now - t.updatedAt > settings.staleHours * 3_600_000);
  push('sans mise à jour', 'warn', stale, `${stale.length} ticket(s) sans mise à jour depuis plus de ${settings.staleHours} h`);
  if (open.length > cfg.backlogMax) push('backlog au-dessus du seuil', open.length > cfg.backlogMax * 1.3 ? 'critical' : 'warn', open, `Backlog ${open.length} > seuil ${cfg.backlogMax}`);
  for (const l of loads) {
    if (l.level === 'ok') continue;
    const list = open.filter((t) => l.openIds.includes(t.id));
    alerts.push({
      id: `${client.id}-charge-${l.team.id}`,
      kind: 'surcharge équipe',
      severity: l.ratio > 1.3 ? 'critical' : 'warn',
      clientId: client.id,
      message: `${l.team.name} : charge ${Math.round(l.ratio * 100)} % de la capacité planifiée (${l.effortH} h / ${l.capacityH} h)`,
      ticketIds: list.map((t) => t.id),
      teamId: l.team.id,
    });
  }
  return alerts;
}

/** gris : outil ITSM non renseigné, état opérationnel non mesurable. */
export type Health = 'vert' | 'orange' | 'rouge' | 'gris';

export type DimensionKey = 'incident' | 'sla' | 'charge' | 'donnees';
export type DimensionState = 'ok' | 'attention' | 'critique' | 'indisponible';

export interface HealthDimension {
  key: DimensionKey;
  label: string;
  state: DimensionState;
  reason: string;
}

export const DIMENSION_LABEL: Record<DimensionKey, string> = { incident: 'Incident', sla: 'SLA', charge: 'Charge', donnees: 'Qualité des données' };

/** Statut d'un objectif (sous-ensemble utile ici, sans dépendance circulaire). */
interface ObjectiveLike {
  label: string;
  kind: 'volume' | 'qualité';
  status: 'atteint' | 'en bonne voie' | 'à risque' | 'non atteint';
}

/**
 * Dimensions de l'état d'un site client. Aucun seuil n'est inventé : on s'appuie sur les
 * alertes calculées, les statuts des objectifs paramétrés et l'état du connecteur.
 */
export function healthDimensions(alerts: Alert[], objectives: ObjectiveLike[] = [], connectorStatus: string | null = 'connecté', toolSet = true): HealthDimension[] {
  const of = (k: AlertKind) => alerts.filter((a) => a.kind === k);
  const critical = alerts.filter((a) => a.severity === 'critical' && (a.kind === 'prioritaire non pris en charge' || a.kind === 'hors SLA'));
  const risky = (kind: ObjectiveLike['kind']) => objectives.filter((o) => o.kind === kind && (o.status === 'à risque' || o.status === 'non atteint'));
  const slaReasons = [...of('hors SLA'), ...of('proche SLA')].map((a) => a.message).concat(risky('qualité').map((o) => `objectif « ${o.label} » ${o.status}`));
  const loadReasons = [...of('surcharge équipe'), ...of('backlog au-dessus du seuil')].map((a) => a.message).concat(risky('volume').map((o) => `objectif « ${o.label} » ${o.status}`));
  return [
    { key: 'incident', label: DIMENSION_LABEL.incident, state: critical.length ? 'critique' : 'ok', reason: critical.length ? critical.map((a) => a.message).join(' · ') : 'Aucun incident critique' },
    { key: 'sla', label: DIMENSION_LABEL.sla, state: slaReasons.length ? 'attention' : 'ok', reason: slaReasons.length ? slaReasons.join(' · ') : 'Aucun ticket hors SLA ni objectif qualité à risque' },
    { key: 'charge', label: DIMENSION_LABEL.charge, state: loadReasons.length ? 'attention' : 'ok', reason: loadReasons.length ? loadReasons.join(' · ') : 'Charge et backlog dans les seuils paramétrés' },
    {
      key: 'donnees',
      label: DIMENSION_LABEL.donnees,
      state: !toolSet ? 'indisponible' : connectorStatus === 'connecté' ? 'ok' : 'attention',
      reason: !toolSet ? 'ITSM non renseigné — configuration requise' : connectorStatus === 'connecté' ? 'Dernière synchronisation (simulation) réussie' : `Synchronisation (simulation) : ${connectorStatus ?? 'inconnue'}`,
    },
  ];
}

/** État opérationnel d'un site : rouge incident critique, orange point d'attention, vert toutes dimensions dans les seuils. */
export function clientHealth(alerts: Alert[], objectives: ObjectiveLike[] = [], connectorStatus: string | null = 'connecté'): { health: Health; reasons: string[]; dimensions: HealthDimension[] } {
  const dimensions = healthDimensions(alerts, objectives, connectorStatus);
  const flagged = dimensions.filter((d) => d.state !== 'ok');
  const reasons = flagged.map((d) => `${d.label} : ${d.reason}`);
  if (dimensions.some((d) => d.state === 'critique')) return { health: 'rouge', reasons, dimensions };
  if (flagged.length) return { health: 'orange', reasons, dimensions };
  return { health: 'vert', reasons: ['Toutes les dimensions sont dans les seuils paramétrés'], dimensions };
}
