// Charge des équipes et des techniciens. Indicateurs de pilotage collectif :
// ils ne produisent aucun classement individuel.
import type { ExternalClient, ExternalTeam, Priority, Technician, Ticket } from './types';
import { businessMinutesBetween, businessMinutesPerDay, dateKey, nextBusinessDays } from './calendar';
import { statusIntervals } from './sla';
import { isOpen, resolvedIn, type Period } from './metrics';

/** Effort restant estimé par ticket ouvert (heures), barème par priorité. */
export const EFFORT_H: Record<Priority, number> = { P1: 4, P2: 2.5, P3: 1.5, P4: 0.75 };
/** Horizon de capacité : jours ouvrés à venir (jour courant inclus au prorata). */
export const CAPACITY_HORIZON_DAYS = 2;
export const LOAD_THRESHOLDS = { tension: 0.85, surcharge: 1 };

export type LoadLevel = 'ok' | 'tension' | 'surcharge';

export function loadLevel(ratio: number): LoadLevel {
  return ratio > LOAD_THRESHOLDS.surcharge ? 'surcharge' : ratio > LOAD_THRESHOLDS.tension ? 'tension' : 'ok';
}

export function isOnLeave(tech: Technician, at: number): boolean {
  return tech.leaveDates.includes(dateKey(at));
}

/** Heures disponibles d'un technicien sur l'horizon (planning, disponibilité déclarée, congés). */
export function capacityHours(tech: Technician, now: number, client: ExternalClient): number {
  const days = nextBusinessDays(now, CAPACITY_HORIZON_DAYS, client.calendar);
  const dayMin = businessMinutesPerDay(client.calendar);
  return days.reduce((sum, day) => {
    if (isOnLeave(tech, day)) return sum;
    let share = 1;
    if (dateKey(day) === dateKey(now)) {
      const close = new Date(day).setHours(client.calendar.endHour);
      const open = new Date(day).setHours(client.calendar.startHour);
      share = Math.min(1, Math.max(0, (close - Math.max(now, open)) / (dayMin * 60_000)));
    }
    return sum + tech.hoursPerDay * tech.availability * share;
  }, 0);
}

export const effortOf = (list: Ticket[]) => list.reduce((s, t) => s + EFFORT_H[t.priority], 0);

/**
 * Part du temps passé imputable à la période : temps passé du ticket au prorata
 * du temps ouvré « En cours » écoulé dans la période.
 */
export function timeSpentInPeriod(t: Ticket, p: Period, client: ExternalClient): number {
  const intervals = statusIntervals(t.createdAt, t.history, p.end).filter((iv) => iv.status === 'En cours');
  const total = statusIntervals(t.createdAt, t.history, Math.max(p.end, t.updatedAt))
    .filter((iv) => iv.status === 'En cours')
    .reduce((s, iv) => s + businessMinutesBetween(iv.from, iv.to, client.calendar), 0);
  if (!total) return 0;
  const inside = intervals.reduce((s, iv) => s + businessMinutesBetween(Math.max(iv.from, p.start), Math.min(iv.to, p.end), client.calendar), 0);
  return Math.round(t.timeSpentMin * Math.min(1, inside / total));
}

export interface TeamLoad {
  team: ExternalTeam;
  techs: Technician[];
  presentToday: number;
  effortH: number;
  capacityH: number;
  ratio: number;
  level: LoadLevel;
  openIds: string[];
  unassignedIds: string[];
}

export function teamLoads(tickets: Ticket[], teams: ExternalTeam[], techs: Technician[], client: ExternalClient, now: number): TeamLoad[] {
  return teams.map((team) => {
    const members = techs.filter((t) => t.teamId === team.id);
    const open = tickets.filter((t) => t.teamId === team.id && isOpen(t) && t.status !== 'En attente');
    const effortH = effortOf(open);
    const capacityH = members.reduce((s, m) => s + capacityHours(m, now, client), 0);
    const ratio = capacityH > 0 ? effortH / capacityH : effortH > 0 ? Infinity : 0;
    return {
      team,
      techs: members,
      presentToday: members.filter((m) => !isOnLeave(m, now)).length,
      effortH: Math.round(effortH * 10) / 10,
      capacityH: Math.round(capacityH * 10) / 10,
      ratio,
      level: loadLevel(ratio),
      openIds: open.map((t) => t.id),
      unassignedIds: open.filter((t) => !t.assigneeId).map((t) => t.id),
    };
  });
}

export interface TechStats {
  tech: Technician;
  assigned: Ticket[];
  inProgress: Ticket[];
  resolved: Ticket[];
  late: Ticket[];
  timeSpentMin: number;
  remaining: Ticket[];
  capacityH: number;
  effortH: number;
  ratio: number;
  onLeaveToday: boolean;
}

export function techStats(tech: Technician, tickets: Ticket[], client: ExternalClient, now: number, period: Period): TechStats {
  const mine = tickets.filter((t) => t.assigneeId === tech.id);
  const open = mine.filter(isOpen);
  const resolved = mine.filter((t) => resolvedIn(t, period));
  const capacityH = capacityHours(tech, now, client);
  const effortH = effortOf(open.filter((t) => t.status !== 'En attente'));
  return {
    tech,
    assigned: open,
    inProgress: open.filter((t) => t.status === 'En cours'),
    resolved,
    late: open.filter((t) => t.sla.state === 'dépassé'),
    timeSpentMin: mine.reduce((s, t) => s + timeSpentInPeriod(t, period, client), 0),
    remaining: open,
    capacityH: Math.round(capacityH * 10) / 10,
    effortH,
    ratio: capacityH > 0 ? effortH / capacityH : effortH > 0 ? Infinity : 0,
    onLeaveToday: isOnLeave(tech, now),
  };
}

/** Planning des prochains jours ouvrés pour la fiche technicien. */
export function planning(tech: Technician, now: number, client: ExternalClient, days = 5): { day: number; state: 'Présent' | 'Congé' | 'Temps partiel' }[] {
  return nextBusinessDays(now, days, client.calendar).map((day) => ({
    day,
    state: isOnLeave(tech, day) ? 'Congé' : tech.availability < 1 ? 'Temps partiel' : 'Présent',
  }));
}
