// Calendrier de réservation des véhicules, semaine par semaine : cases libres sélectionnables,
// cases indisponibles barrées (réservé, entretien) ou grisées (passé) ; proposition de dates.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Vehicle } from '../../types';
import { addDays, dateKey, startOfWeek } from '../../external/calendar';
import { bookingAt, DURATION_LABEL, fmtDay, fmtDayShort, propose, SLOT_LABEL, SLOT_SHORT, SLOTS, slotState, weekDays, type CarBooking, type Duration, type Proposal, type Slot, type SlotState } from '../../fleet/bookings';

interface Props {
  vehicles: Vehicle[];
  bookings: CarBooking[];
  now: number;
  user: string;
  canBook: boolean;
  onBook: (p: { vehicleId: string; day: string; slots: Slot[]; purpose: string }) => { ok: boolean; message: string };
  onCancel: (id: string) => void;
}

const STATE_TEXT: Record<SlotState, string> = { libre: 'Libre', réservé: 'Réservé', entretien: 'Entretien', passé: 'Passé' };

/** Prochain jour ouvré (aujourd'hui si ouvré). */
const nextBusinessDay = (now: number) => {
  let t = now;
  while ([0, 6].includes(new Date(t).getDay())) t = addDays(t, 1);
  return dateKey(t);
};

export function FleetCalendar({ vehicles, bookings, now, user, canBook, onBook, onCancel }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(`${nextBusinessDay(now)}T12:00:00`).getTime()));
  const [day, setDay] = useState(() => nextBusinessDay(now));
  const [duration, setDuration] = useState<Duration>('journee');
  const [vehicleId, setVehicleId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const days = weekDays(weekStart);
  const name = (id: string) => vehicles.find((v) => v.id === id)?.label ?? id;
  const proposed = useMemo(() => new Set((proposals ?? []).flatMap((p) => p.slots.map((s) => `${p.vehicleId}|${p.day}|${s}`))), [proposals]);
  const mine = bookings.filter((b) => b.by === user && b.kind === 'réservation' && slotState([], b.vehicleId, b.day, b.slot, now) !== 'passé').sort((a, b) => (a.day + a.slot).localeCompare(b.day + b.slot));

  const run = (d = day, du = duration, v = vehicleId) => {
    setResult(null);
    setProposals(propose(bookings, vehicles, { day: d, duration: du, vehicleId: v || undefined }, now));
  };
  const pickCell = (v: string, d: string, s: Slot) => {
    setDay(d);
    setDuration(s);
    setVehicleId(v);
    run(d, s, v);
  };
  const confirm = (p: Proposal) => {
    const r = onBook({ vehicleId: p.vehicleId, day: p.day, slots: p.slots, purpose });
    setResult(r);
    if (r.ok) setProposals(null);
  };

  return (
    <div className="fleet">
      <section aria-label="Proposition de date">
        <h4>Proposer une date</h4>
        <div className="fleet-form">
          <label>
            Date souhaitée
            <input type="date" value={day} min={dateKey(now)} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label>
            Durée
            <select value={duration} onChange={(e) => setDuration(e.target.value as Duration)}>
              {(Object.keys(DURATION_LABEL) as Duration[]).map((d) => (
                <option key={d} value={d}>
                  {DURATION_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Véhicule
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Indifférent</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motif
            <input value={purpose} placeholder="Ex. visite client" onChange={(e) => setPurpose(e.target.value)} />
          </label>
          <button className="action primary" onClick={() => run()}>
            Proposer des dates
          </button>
        </div>
        {proposals && (
          <div className="fleet-proposals" role="status">
            {proposals.length === 0 ? (
              <p className="hint">Aucun créneau libre sur les 4 prochaines semaines pour ces critères.</p>
            ) : (
              <>
                <p className="hint">{proposals[0].exact ? 'Le créneau demandé est disponible.' : 'Le créneau demandé est indisponible : voici les disponibilités les plus proches.'}</p>
                <ul>
                  {proposals.map((p) => (
                    <li key={`${p.vehicleId}${p.day}${p.slots.join()}`}>
                      <span>
                        <b>{fmtDay(p.day)}</b> · {p.slots.length === 2 ? 'journée entière' : SLOT_LABEL[p.slots[0]].toLowerCase()} · {name(p.vehicleId)}
                        {p.exact && <span className="badge ok">demandé</span>}
                      </span>
                      <span className="fleet-prop-actions">
                        <button className="ghost" onClick={() => setWeekStart(startOfWeek(new Date(`${p.day}T12:00:00`).getTime()))}>
                          Voir dans le calendrier
                        </button>
                        <button className="action primary" disabled={!canBook} title={canBook ? undefined : 'Réservation non autorisée pour votre profil'} onClick={() => confirm(p)}>
                          Réserver ce créneau
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {result && (
          <p className={`xc-result ${result.ok ? 'ok' : 'bad'}`} role="status">
            {result.message}
          </p>
        )}
      </section>

      <section aria-label="Calendrier de réservation">
        <div className="fleet-weekbar">
          <button className="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semaine précédente">
            <ChevronLeft size={14} />
          </button>
          <b>
            Semaine du {fmtDayShort(days[0])} au {fmtDayShort(days[4])}
          </b>
          <button className="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semaine suivante">
            <ChevronRight size={14} />
          </button>
          <button className="ghost" onClick={() => setWeekStart(startOfWeek(now))}>
            Cette semaine
          </button>
        </div>
        <div className="xc-tablewrap">
          <table className="fleet-grid">
            <caption className="sr-only">Disponibilités des véhicules, semaine du {fmtDay(days[0])}</caption>
            <thead>
              <tr>
                <th rowSpan={2} scope="col">
                  Véhicule
                </th>
                {days.map((d) => (
                  <th key={d} colSpan={2} scope="colgroup" className={d === dateKey(now) ? 'today' : ''}>
                    {fmtDayShort(d)}
                  </th>
                ))}
              </tr>
              <tr>
                {days.flatMap((d) =>
                  SLOTS.map((s) => (
                    <th key={d + s} scope="col" className="sub">
                      {SLOT_SHORT[s]}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <th scope="row">
                    {v.label}
                    <small>{v.plate}</small>
                  </th>
                  {days.flatMap((d) =>
                    SLOTS.map((s) => {
                      const st = slotState(bookings, v.id, d, s, now);
                      const b = bookingAt(bookings, v.id, d, s);
                      const label = `${v.label}, ${fmtDay(d)}, ${SLOT_SHORT[s].toLowerCase()} : ${STATE_TEXT[st].toLowerCase()}${b ? ` — ${b.purpose} (${b.by})` : ''}`;
                      const sel = proposed.has(`${v.id}|${d}|${s}`);
                      return (
                        <td key={d + s} className={`fc ${st === 'réservé' ? 'reserve' : st}${sel ? ' proposed' : ''}`}>
                          {st === 'libre' ? (
                            <button aria-label={`${label} — choisir ce créneau`} title={label} onClick={() => pickCell(v.id, d, s)}>
                              <span aria-hidden>{sel ? '★' : ''}</span>
                            </button>
                          ) : (
                            <span role="img" aria-label={label} title={label}>
                              <s aria-hidden>{st === 'passé' ? '' : STATE_TEXT[st]}</s>
                            </span>
                          )}
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fleet-legend">
          <span className="fc libre">
            <i />
          </span>{' '}
          libre (cliquer pour choisir) ·{' '}
          <span className="fc reserve">
            <i />
          </span>{' '}
          réservé (barré) ·{' '}
          <span className="fc entretien">
            <i />
          </span>{' '}
          entretien (barré) ·{' '}
          <span className="fc passé">
            <i />
          </span>{' '}
          passé ·{' '}
          <span className="fc libre proposed">
            <i />
          </span>{' '}
          créneau proposé
        </p>
      </section>

      <section aria-label="Mes réservations">
        <h4>Mes réservations à venir ({mine.length})</h4>
        {mine.length === 0 ? (
          <p className="hint">Aucune réservation à votre nom.</p>
        ) : (
          <ul className="fleet-mine">
            {mine.map((b) => (
              <li key={b.id}>
                <span>
                  {fmtDay(b.day)} · {SLOT_SHORT[b.slot].toLowerCase()} · {name(b.vehicleId)} · {b.purpose}
                </span>
                <button className="ghost" onClick={() => onCancel(b.id)}>
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
