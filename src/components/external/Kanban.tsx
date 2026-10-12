import { useMemo, useState } from 'react';
import type { Ticket, TicketStatus } from '../../external/types';
import type { ClientView } from '../../external/derive';
import { adapters, checkTransition } from '../../external/itsm/adapters';
import { ticketFlags, type AlertSettings } from '../../external/alerts';
import { isOpen } from '../../external/metrics';
import type { ActionResult } from '../../external/useExternal';
import { PriorityBadge, Toast } from './common';

const MAIN: TicketStatus[] = ['Nouveau', 'Affecté', 'En cours', 'En attente', 'Résolu', 'Clôturé'];
const EXCEPTIONS: TicketStatus[] = ['Bloqué', 'Escaladé', 'Réouvert'];
const DONE_DAYS = 3;
const DONE_LIMIT = 25;

interface Props {
  view: ClientView;
  now: number;
  individual: boolean;
  editable: boolean;
  settings: AlertSettings;
  onStaleHours: (h: number) => void;
  onMove: (ticketId: string, to: TicketStatus) => ActionResult;
  onOpen: (ticketId: string) => void;
  onFilter: (label: string, ids: string[]) => void;
}

export function Kanban({ view, now, individual, editable, settings, onStaleHours, onMove, onOpen, onFilter }: Props) {
  const [team, setTeam] = useState('toutes');
  const [dragged, setDragged] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<ActionResult | null>(null);
  const adapter = adapters[view.client.tool];

  const columns = useMemo(() => {
    const list = view.tickets.filter((t) => (team === 'toutes' || t.teamId === team) && (isOpen(t) || now - t.updatedAt < DONE_DAYS * 86_400_000));
    const by = new Map<TicketStatus, Ticket[]>();
    for (const t of list) by.set(t.status, [...(by.get(t.status) ?? []), t]);
    for (const [s, l] of by) {
      l.sort((a, b) => (isOpen(a) ? a.priority.localeCompare(b.priority) || a.createdAt - b.createdAt : b.updatedAt - a.updatedAt));
      if (!isOpen(l[0])) by.set(s, l.slice(0, DONE_LIMIT));
    }
    return by;
  }, [view.tickets, team, now]);

  const techName = (id: string | null) => (id ? (individual ? (view.techs.find((t) => t.id === id)?.name ?? '?') : 'Affecté') : 'Non affecté');

  const drop = (to: TicketStatus) => {
    if (!dragged) return;
    setToast(onMove(dragged.id, to));
    setDragged(null);
  };

  const column = (s: TicketStatus) => {
    const list = columns.get(s) ?? [];
    const allowed = dragged ? checkTransition(adapter, dragged.status, s) : null;
    return (
      <div
        key={s}
        className={`xc-col${allowed ? (allowed.ok && editable ? ' can-drop' : ' no-drop') : ''}`}
        onDragOver={(e) => {
          if (allowed?.ok && editable) e.preventDefault();
        }}
        onDrop={() => drop(s)}
        aria-label={`Colonne ${s}`}
      >
        <h4>
          {s} <span>{list.length}</span>
        </h4>
        <div className="xc-cards">
          {list.map((t) => {
            const flags = ticketFlags(t, now, settings);
            return (
              <article
                key={t.id}
                className={`xc-card ${t.sla.state === 'dépassé' && isOpen(t) ? 'late' : ''}`}
                draggable={editable && adapter.capabilities.mode === 'lecture-écriture'}
                onDragStart={() => setDragged(t)}
                onDragEnd={() => setDragged(null)}
              >
                <button onClick={() => onOpen(t.id)} aria-label={`Ouvrir ${t.id} ${t.title}`}>
                  <span className="xc-card-top">
                    <b>{t.id}</b>
                    <PriorityBadge p={t.priority} />
                  </span>
                  <span className="xc-card-title">{t.title}</span>
                  <small>{techName(t.assigneeId)}</small>
                  {flags.length > 0 && (
                    <span className="xc-flags">
                      {flags.map((f) => (
                        <em key={f} className={f === 'hors SLA' || f === 'P1/P2 non pris' ? 'bad' : 'warn'}>
                          {f}
                        </em>
                      ))}
                    </span>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="xc-kanban">
      <div className="xc-toolbar">
        <select aria-label="Équipe" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="toutes">Toutes les équipes</option>
          {view.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="xc-inline">
          Alerte « sans mise à jour » après
          <input type="number" min={1} max={240} value={settings.staleHours} onChange={(e) => onStaleHours(Math.max(1, Number(e.target.value) || 1))} aria-label="Seuil sans mise à jour (heures)" />h
        </label>
      </div>
      <div className="xc-alertstrip">
        {view.alerts.map((a) => (
          <button key={a.id} className={`xc-alert ${a.severity}`} onClick={() => onFilter(a.message, a.ticketIds)}>
            <b>{a.kind}</b> {a.ticketIds.length}
          </button>
        ))}
      </div>
      <p className="hint">
        {adapter.tool} — {adapter.capabilities.mode}. {adapter.capabilities.note}{' '}
        {editable ? 'Glissez une carte vers une colonne autorisée (surlignée en vert) ; l’opération est transmise à l’outil source (simulation).' : 'Votre rôle ne permet pas de déplacer les tickets.'} Résolus / clôturés : {DONE_DAYS} derniers jours.
      </p>
      <div className="xc-board">{MAIN.map(column)}</div>
      <h4 className="xc-lane">Exceptions</h4>
      <div className="xc-board exceptions">{EXCEPTIONS.map(column)}</div>
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </div>
  );
}
