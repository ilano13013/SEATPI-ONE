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

/** Nombre de tickets hors SLA (ou proches) à partir duquel un site passe à l'orange. */
export const ORANGE_SLA_COUNT = 3;

/** État opérationnel d'un site : vert dans les seuils, orange risque, rouge incident critique. */
export function clientHealth(alerts: Alert[]): { health: Health; reasons: string[] } {
  const critical = alerts.filter((a) => a.severity === 'critical');
  if (critical.length) return { health: 'rouge', reasons: critical.map((a) => a.message) };
  // Orange : plusieurs tickets hors SLA ou proches de l'échéance, surcharge ou backlog au-dessus du seuil.
  const warn = alerts.filter(
    (a) =>
      ((a.kind === 'hors SLA' || a.kind === 'proche SLA') && a.ticketIds.length >= ORANGE_SLA_COUNT) || a.kind === 'surcharge équipe' || a.kind === 'backlog au-dessus du seuil',
  );
  if (warn.length) return { health: 'orange', reasons: warn.map((a) => a.message) };
  return { health: 'vert', reasons: ['Activité dans les seuils définis'] };
}
