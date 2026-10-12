// Historique des modifications (démonstration) : qui, quoi, ancienne / nouvelle valeur, quand, où.
// En production, cet historique devra être enregistré côté serveur, horodaté et non modifiable.
import { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface AuditEntry {
  at: number;
  user: string;
  module: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const ref = useRef(entries);
  ref.current = entries;
  const record = useCallback((e: Omit<AuditEntry, 'at'>) => {
    const next = [{ ...e, at: Date.now() }, ...ref.current].slice(0, 500);
    ref.current = next;
    setEntries(next);
  }, []);
  const reset = useCallback(() => {
    ref.current = [];
    setEntries([]);
  }, []);
  return { entries, record, reset };
}

export type AuditLog = ReturnType<typeof useAuditLog>;

/** Contexte : utilisateur courant (profil simulé) et journal, partagés par les champs modifiables. */
export interface AuditContextValue {
  user: string;
  record: AuditLog['record'];
}

export const AuditContext = createContext<AuditContextValue>({ user: 'Démonstration', record: () => undefined });
export const useAudit = () => useContext(AuditContext);
