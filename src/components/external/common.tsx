import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ExternalClientId, Priority, SlaState, TicketStatus } from '../../external/types';
import type { Health } from '../../external/alerts';

export type ClientTab = 'dashboard' | 'tickets' | 'kanban' | 'techs' | 'objectives' | 'escalations' | 'integration' | 'report';

export interface ExternalNav {
  scope: 'global' | ExternalClientId;
  tab: ClientTab | 'globalReport';
  /** Filtre issu d'un indicateur cliquable. */
  filter?: { label: string; ids: string[] };
  ticketId?: string;
  techId?: string;
}

export const fmtDateTime = (t: number | null | undefined) =>
  t == null ? '—' : new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const fmtDay = (t: number) => new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export const fmtHours = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`);

export const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

export const statusTone: Record<TicketStatus, string> = {
  Nouveau: 'info',
  Affecté: 'info',
  'En cours': 'brand',
  'En attente': 'muted',
  Bloqué: 'bad',
  Escaladé: 'violet',
  Résolu: 'ok',
  Clôturé: 'muted',
  Réouvert: 'warn',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge ${statusTone[status]}`}>{status}</span>;
}

export function PriorityBadge({ p }: { p: Priority }) {
  return <span className={`badge ${p === 'P1' ? 'bad' : p === 'P2' ? 'warn' : p === 'P3' ? 'info' : 'muted'}`}>{p}</span>;
}

export function SlaBadge({ state, paused }: { state: SlaState; paused?: boolean }) {
  const tone = state === 'dépassé' ? 'bad' : state === 'à risque' ? 'warn' : 'ok';
  return <span className={`badge ${tone}`}>{paused && state !== 'dépassé' ? 'suspendu' : state}</span>;
}

export const healthLabel: Record<Health, string> = { vert: 'Dans les seuils', orange: 'Risque SLA / surcharge', rouge: 'Incident critique', gris: 'ITSM non renseigné' };

export function HealthDot({ health }: { health: Health }) {
  return <i className={`hdot ${health}`} aria-label={healthLabel[health]} title={healthLabel[health]} />;
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="xc-overlay" onClick={onClose}>
      <div className={`xc-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="xc-modal-head">
          <h3>{title}</h3>
          <button ref={closeRef} className="icon" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="xc-modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Bandeau des clients sans outil ITSM renseigné (aucune donnée de ticket inventée). */
export function ItsmMissing({ name }: { name: string }) {
  return (
    <div className="itsm-missing" role="status">
      <b>ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE</b>
      <span>
        Aucun outil ITSM n’est associé à {name} dans la cartographie de référence. Aucun ticket n’est affiché ni simulé pour ce client tant que l’outil, l’instance et les accès ne sont pas renseignés (voir Administration → Préparation à la production).
      </span>
    </div>
  );
}

export function Toast({ message, ok, onDone }: { message: string; ok: boolean; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(id);
    // Le minuteur ne repart que pour un nouveau message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);
  return (
    <div className={`xc-toast ${ok ? 'ok' : 'bad'}`} role="status">
      {message}
    </div>
  );
}

/** Barre de charge effort / capacité. */
export function LoadBar({ ratio }: { ratio: number }) {
  const pct = Number.isFinite(ratio) ? Math.round(ratio * 100) : 999;
  const tone = ratio > 1 ? 'bad' : ratio > 0.85 ? 'warn' : 'ok';
  return (
    <span className="loadbar" role="meter" aria-valuemin={0} aria-valuemax={150} aria-valuenow={Math.min(pct, 150)} aria-label={`Charge ${pct} %`}>
      <span className="track">
        <i className={tone} style={{ width: `${Math.min(100, pct / 1.5)}%` }} />
        <em style={{ left: `${100 / 1.5}%` }} aria-hidden />
      </span>
      <b>{Number.isFinite(ratio) ? `${pct} %` : '∞'}</b>
    </span>
  );
}

export function downloadText(filename: string, content: string, type = 'text/markdown') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
