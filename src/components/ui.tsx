import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { Tone } from '../lib/format';

export function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'active' : ''} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone, children }: { tone: Tone | 'info' | 'muted'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

/** Ligne de liste cliquable qui déplie un bloc de détails. */
export function Row({ title, meta, aside, open, onToggle, children }: { title: ReactNode; meta?: ReactNode; aside?: ReactNode; open: boolean; onToggle: () => void; children?: ReactNode }) {
  return (
    <div className={`row${open ? ' open' : ''}`}>
      <button className="row-head" aria-expanded={open} onClick={onToggle}>
        <span className="row-main">
          <b>{title}</b>
          {meta && <small>{meta}</small>}
        </span>
        {aside && <span className="row-aside">{aside}</span>}
      </button>
      {open && children && <div className="row-detail">{children}</div>}
    </div>
  );
}

export function Detail({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="detail">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Bouton d'action simulée : ne modifie aucune donnée. */
export function SimulatedAction({ label, allowed }: { label: string; allowed: boolean }) {
  const [done, setDone] = useState(false);
  if (!allowed) {
    return (
      <button className="action" disabled title="Action non autorisée pour ce rôle (maquette)">
        <Lock size={13} /> {label}
      </button>
    );
  }
  return (
    <button className="action" onClick={() => setDone(true)}>
      {done ? 'Action simulée — aucune donnée modifiée' : label}
    </button>
  );
}

export function Restricted({ what }: { what: string }) {
  return (
    <div className="restricted">
      <Lock size={18} />
      <div>
        <b>Accès restreint</b>
        <p>Le rôle sélectionné n'a pas accès à {what} dans cette maquette.</p>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
