// Moyens généraux — gestion opérationnelle des déplacements professionnels (démonstration).
//
// Les montants Helpdesk (engagements, dépenses, plafond) restent dans l'enveloppe du
// département Helpdesk (src/finance) : ils ne sont PAS dupliqués ici. Ce module ne porte
// que le suivi opérationnel : réservations, justificatifs, demandes des autres services.
import { useCallback, useRef, useState } from 'react';
import type { TravelBudget } from '../finance/budget';

export type BookingStatus = 'À réserver' | 'Réservé' | 'Annulé' | 'Sans objet';
export type ReceiptStatus = 'Reçu' | 'Manquant';

export interface Booking {
  transport: BookingStatus;
  hotel: BookingStatus;
}

/** Demande d'un service hors Helpdesk : suivie opérationnellement, budget non modélisé. */
export interface OtherRequest {
  id: string;
  department: string;
  label: string;
  date: string;
  estimate: number;
  status: 'Demandée' | 'Organisée' | 'Réalisée' | 'Annulée';
}

export interface MoyensLog {
  at: number;
  by: string;
  action: string;
  detail: string;
}

export interface MoyensState {
  /** Réservations par engagement de déplacement (identifiant ENG-…). */
  bookings: Record<string, Booking>;
  /** Justificatifs par dépense réalisée (identifiant DEP-…). */
  receipts: Record<string, ReceiptStatus>;
  otherRequests: OtherRequest[];
  log: MoyensLog[];
}

export const DEFAULT_BOOKING: Booking = { transport: 'À réserver', hotel: 'Sans objet' };

export function initialMoyens(travel: TravelBudget): MoyensState {
  const receipts: Record<string, ReceiptStatus> = {};
  travel.expenses.forEach((e, i) => (receipts[e.id] = i >= travel.expenses.length - 2 ? 'Manquant' : 'Reçu'));
  const bookings: Record<string, Booking> = {};
  travel.commitments.forEach((c, i) => (bookings[c.id] = { transport: i === 0 ? 'Réservé' : 'À réserver', hotel: c.label.includes('Comité') ? 'À réserver' : 'Sans objet' }));
  return {
    bookings,
    receipts,
    otherRequests: [
      { id: 'MG-001', department: 'Commercial', label: 'Rendez-vous prospect — Lyon', date: '2026-10-21', estimate: 320, status: 'Organisée' },
      { id: 'MG-002', department: 'Exploitation', label: 'Intervention salle serveurs — Paris', date: '2026-10-27', estimate: 180, status: 'Demandée' },
    ],
    log: [],
  };
}

export function useMoyens(travel: TravelBudget) {
  const init = useRef<MoyensState>();
  if (!init.current) init.current = initialMoyens(travel);
  const [state, setState] = useState(init.current);
  const ref = useRef(state);
  ref.current = state;
  const apply = (next: MoyensState, by: string, action: string, detail: string) => {
    const withLog = { ...next, log: [{ at: Date.now(), by, action, detail }, ...next.log].slice(0, 200) };
    ref.current = withLog;
    setState(withLog);
  };

  const setBooking = useCallback((commitmentId: string, patch: Partial<Booking>, by: string) => {
    const s = ref.current;
    const current = s.bookings[commitmentId] ?? DEFAULT_BOOKING;
    apply({ ...s, bookings: { ...s.bookings, [commitmentId]: { ...current, ...patch } } }, by, 'Réservation', `${commitmentId} : ${Object.entries(patch).map(([k, v]) => `${k === 'transport' ? 'transport' : 'hôtel'} ${v}`).join(', ')}`);
  }, []);

  const setReceipt = useCallback((expenseId: string, status: ReceiptStatus, by: string) => {
    const s = ref.current;
    apply({ ...s, receipts: { ...s.receipts, [expenseId]: status } }, by, 'Justificatif', `${expenseId} : ${status}`);
  }, []);

  const addOtherRequest = useCallback((req: Omit<OtherRequest, 'id' | 'status'>, by: string): { ok: boolean; message: string } => {
    if (!req.label.trim() || !req.department.trim()) return { ok: false, message: 'Service et objet obligatoires.' };
    const s = ref.current;
    const id = `MG-${String(s.otherRequests.length + 1).padStart(3, '0')}`;
    apply({ ...s, otherRequests: [...s.otherRequests, { ...req, id, status: 'Demandée' }] }, by, 'Demande de déplacement', `${id} ${req.department} : ${req.label}`);
    return { ok: true, message: `Demande ${id} enregistrée (Moyens généraux).` };
  }, []);

  const setOtherStatus = useCallback((id: string, status: OtherRequest['status'], by: string) => {
    const s = ref.current;
    apply({ ...s, otherRequests: s.otherRequests.map((r) => (r.id === id ? { ...r, status } : r)) }, by, 'Suivi de demande', `${id} : ${status}`);
  }, []);

  const reset = useCallback((t: TravelBudget) => {
    const fresh = initialMoyens(t);
    ref.current = fresh;
    setState(fresh);
  }, []);

  return { state, setBooking, setReceipt, addOtherRequest, setOtherStatus, reset };
}

export type MoyensStore = ReturnType<typeof useMoyens>;
