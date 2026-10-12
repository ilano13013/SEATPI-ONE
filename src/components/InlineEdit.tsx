// Modification en direct d'un champ (« inline editing ») :
// clic → saisie → Enregistrer / Annuler (Entrée / Échap) → validation → enregistrement
// → historique (utilisateur, champ, ancienne et nouvelle valeur, date, module).
// Sans permission, la valeur reste en lecture seule (avec un cadenas discret).
import { useState, type ReactNode } from 'react';
import { Check, Lock, Pencil, X } from 'lucide-react';
import { useAudit } from '../audit/audit';

export interface SaveResult {
  ok: boolean;
  message: string;
}

interface Props<T extends string | number> {
  value: T;
  /** Libellé du champ (historique et accessibilité). */
  field: string;
  module: string;
  canEdit: boolean;
  /** Raison affichée si la modification n'est pas autorisée. */
  lockedReason?: string;
  type?: 'text' | 'number';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** Modification sensible : confirmation explicite avant enregistrement. */
  sensitive?: boolean;
  format?: (v: T) => ReactNode;
  validate?: (v: T) => string | null;
  onSave: (v: T) => SaveResult | void;
}

export function InlineEdit<T extends string | number>({ value, field, module, canEdit, lockedReason, type, options, min, max, step, sensitive, format, validate, onSave }: Props<T>) {
  const { user, record } = useAudit();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const numeric = type === 'number' || typeof value === 'number';
  const shown = format ? format(value) : options ? (options.find((o) => o.value === value)?.label ?? String(value)) : String(value);

  if (!canEdit)
    return (
      <span className="ie-ro" title={lockedReason ?? 'Lecture seule pour votre profil'}>
        {shown} <Lock size={10} aria-hidden />
      </span>
    );

  if (!editing)
    return (
      <button
        type="button"
        className="ie-value"
        aria-label={`Modifier ${field}`}
        onClick={() => {
          setDraft(String(value));
          setError(null);
          setConfirm(false);
          setEditing(true);
        }}
      >
        {shown} <Pencil size={10} aria-hidden />
      </button>
    );

  const parsed = (numeric ? Number(draft.replace(',', '.')) : draft) as T;
  const save = () => {
    if (numeric && (draft.trim() === '' || !Number.isFinite(parsed as number))) return setError('Valeur numérique attendue.');
    if (numeric && min !== undefined && (parsed as number) < min) return setError(`Valeur minimale : ${min}.`);
    if (numeric && max !== undefined && (parsed as number) > max) return setError(`Valeur maximale : ${max}.`);
    if (!numeric && !String(parsed).trim()) return setError('Valeur obligatoire.');
    const invalid = validate?.(parsed);
    if (invalid) return setError(invalid);
    if (parsed === value) return setEditing(false);
    if (sensitive && !confirm) return setConfirm(true);
    const r = onSave(parsed);
    if (r && !r.ok) return setError(r.message);
    record({ user, module, field, oldValue: String(value), newValue: String(parsed) });
    setEditing(false);
  };

  return (
    <span className="ie-edit" role="group" aria-label={`Modification : ${field}`}>
      {options ? (
        <select autoFocus aria-label={field} value={draft} onChange={(e) => setDraft(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          aria-label={field}
          type={numeric ? 'number' : 'text'}
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setConfirm(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setEditing(false);
            }
          }}
        />
      )}
      <button type="button" className="ie-ok" aria-label={confirm ? "Confirmer" : "Enregistrer"} onClick={save}>
        <Check size={12} /> {confirm ? 'Confirmer' : ''}
      </button>
      <button type="button" className="ie-cancel" aria-label="Annuler" onClick={() => setEditing(false)}>
        <X size={12} />
      </button>
      {confirm && <span className="ie-confirm">Modification sensible : cliquez sur Confirmer pour enregistrer.</span>}
      {error && (
        <span className="ie-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
