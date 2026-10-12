import { useState } from 'react';
import type { DemoState, InventoryItem, Vehicle } from '../../types';
import { currentState, fmtDayShort, nextBooking, SLOT_SHORT, type CarBooking, type Slot } from '../../fleet/bookings';
import { FleetCalendar } from '../fleet/FleetCalendar';
import { Modal } from '../external/common';
import { can, type Role } from '../../auth/roles';
import { formatEuro } from '../../lib/format';
import { Badge, Chips, Detail, Row, SimulatedAction } from '../ui';

interface Props {
  state: DemoState;
  role: Role;
}

/** Compteurs RH calculés depuis la même source que la checklist congés (outil RH simulé). */
export interface RhCounters {
  /** Demandes « Soumise » dans l'outil RH = lignes de la checklist congés. */
  pending: number;
  /** Demandes dont le suivi interne n'est pas « Traité ». */
  remaining: number;
  /** Collaborateurs Helpdesk (N1 et N2) des trois sites. */
  headcount: number;
  /** En congé validé aujourd'hui (outil RH). */
  onLeaveToday: number;
  onOpenLeaves?: () => void;
}

export function RhPanel({ state, role, rh }: Props & { rh?: RhCounters }) {
  const { hr } = state;
  return (
    <>
      <p className="hint">Indicateurs agrégés uniquement. Les données RH nominatives restent dans le SIRH.</p>
      {rh && (
        <>
          <p className="hint">Périmètre : collaborateurs Helpdesk (N1 et N2) des trois sites · aujourd’hui · demandes en attente dans l’outil RH (simulé).</p>
          <div className="kpis">
            <button className="as-button" onClick={rh.onOpenLeaves} disabled={!rh.onOpenLeaves} aria-label={`Congés à valider dans l’outil RH : ${rh.pending} — ouvrir la checklist congés`}>
              <small>Congés à valider (outil RH)</small>
              <strong>{rh.pending}</strong>
            </button>
            <div>
              <small>Dont suivi « À traiter / Relancé »</small>
              <strong>{rh.remaining}</strong>
            </div>
            <div>
              <small>Effectif Helpdesk</small>
              <strong>{rh.headcount}</strong>
            </div>
            <div>
              <small>Prévus aujourd’hui (hors congés validés)</small>
              <strong>{rh.headcount - rh.onLeaveToday}</strong>
            </div>
          </div>
        </>
      )}
      <div className="kpis">
        <div>
          <small>Formations à venir</small>
          <strong>{hr.upcomingTrainings}</strong>
        </div>
        <div>
          <small>Habilitations à renouveler</small>
          <strong>{hr.certificationsToRenew}</strong>
        </div>
      </div>
      <p className="hint">Formations et habilitations : indicateurs fictifs (SIRH non connecté). Le suivi interne des congés ne valide rien dans l’outil RH.</p>
      <SimulatedAction label="Ouvrir la file de validation des congés" allowed={can(role, 'rh', 'edit')} />
    </>
  );
}

const CATEGORIES = ['Toutes', 'Casques', 'Postes', 'Écrans', 'Accessoires'] as const;

export function StockPanel({ state, role }: Props) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Toutes');
  const [openId, setOpenId] = useState<string | null>(null);
  const items = state.inventory.filter((i) => category === 'Toutes' || i.category === category);
  const alerts = state.inventory.filter(isLow).length;
  return (
    <>
      <div className="kpis">
        <div>
          <small>Références</small>
          <strong>{state.inventory.length}</strong>
        </div>
        <div>
          <small>Alertes de stock</small>
          <strong className={alerts ? 'tone-bad' : ''}>{alerts}</strong>
        </div>
      </div>
      <Chips label="Filtrer par catégorie" options={CATEGORIES} value={category} onChange={setCategory} />
      <div className="list">
        {items.map((i) => (
          <Row
            key={i.id}
            open={openId === i.id}
            onToggle={() => setOpenId(openId === i.id ? null : i.id)}
            title={i.label}
            meta={`${i.category} · ${i.assigned} affectés`}
            aside={<Badge tone={isLow(i) ? 'bad' : 'ok'}>{i.inStock} en stock</Badge>}
          >
            <Detail
              items={[
                ['Seuil d’alerte', i.alertThreshold],
                ['En stock', i.inStock],
                ['Affectés', i.assigned],
              ]}
            />
            <SimulatedAction label="Enregistrer une affectation" allowed={can(role, 'stock', 'edit')} />
          </Row>
        ))}
      </div>
    </>
  );
}

const isLow = (i: InventoryItem) => i.inStock <= i.alertThreshold;

const VEHICLE_FILTERS = ['Tous', 'Disponible', 'Réservé', 'Entretien'] as const;
const vehicleTone = (s: Vehicle['status']) => (s === 'Disponible' ? 'ok' : s === 'Réservé' ? 'info' : 'warn');

/** Calendrier de réservation du parc (état partagé, conservé hors du panneau). */
export interface FleetProps {
  bookings: CarBooking[];
  now: number;
  user: string;
  onBook: (p: { vehicleId: string; day: string; slots: Slot[]; purpose: string }) => { ok: boolean; message: string };
  onCancel: (id: string) => void;
}

export function ParkingPanel({ state, role, fleet }: Props & { fleet?: FleetProps }) {
  const [filter, setFilter] = useState<(typeof VEHICLE_FILTERS)[number]>('Tous');
  const [openId, setOpenId] = useState<string | null>(null);
  const [calendar, setCalendar] = useState(false);
  const canBook = can(role, 'vehicules', 'view');
  // État et prochaine réservation lus dans le calendrier (même source que la grille).
  const statusOf = (v: Vehicle) => (fleet ? currentState(fleet.bookings, v.id, fleet.now) : v.status);
  const nextOf = (v: Vehicle) => {
    if (!fleet) return v.nextBooking;
    const b = nextBooking(fleet.bookings, v.id, fleet.now);
    return b ? `${fmtDayShort(b.day)} ${SLOT_SHORT[b.slot].toLowerCase()}` : null;
  };
  return (
    <>
      {fleet && (
        <button className="action primary" onClick={() => setCalendar(true)}>
          Réserver un véhicule — calendrier et proposition de date
        </button>
      )}
      <Chips label="Filtrer par disponibilité" options={VEHICLE_FILTERS} value={filter} onChange={setFilter} />
      <div className="list">
        {state.vehicles
          .filter((v) => filter === 'Tous' || statusOf(v) === filter)
          .map((v) => (
            <Row
              key={v.id}
              open={openId === v.id}
              onToggle={() => setOpenId(openId === v.id ? null : v.id)}
              title={v.label}
              meta={`${v.plate} · prochaine réservation : ${nextOf(v) ?? 'aucune'}`}
              aside={<Badge tone={vehicleTone(statusOf(v))}>{statusOf(v)}</Badge>}
            >
              <Detail
                items={[
                  ['Immatriculation (fictive)', v.plate],
                  ['Kilométrage', `${v.km.toLocaleString('fr-FR')} km`],
                  ['Prochaine réservation', nextOf(v) ?? 'Aucune'],
                ]}
              />
              {fleet ? (
                <button className="action" onClick={() => setCalendar(true)}>
                  Voir ses disponibilités
                </button>
              ) : (
                <SimulatedAction label="Réserver ce véhicule" allowed={canBook && v.status === 'Disponible'} />
              )}
            </Row>
          ))}
      </div>
      {fleet && calendar && (
        <Modal title="Réservation des véhicules (démonstration)" wide onClose={() => setCalendar(false)}>
          <FleetCalendar vehicles={state.vehicles} bookings={fleet.bookings} now={fleet.now} user={fleet.user} canBook={canBook} onBook={fleet.onBook} onCancel={fleet.onCancel} />
        </Modal>
      )}
    </>
  );
}

export function DirectionPanel({ state, role }: Props) {
  const allocated = state.budgets.reduce((s, b) => s + b.allocated, 0);
  const spent = state.budgets.reduce((s, b) => s + b.spent, 0);
  return (
    <>
      <div className="kpis">
        <div>
          <small>Budget alloué</small>
          <strong>{formatEuro(allocated)}</strong>
        </div>
        <div>
          <small>Consommé</small>
          <strong>{Math.round((spent / allocated) * 100)} %</strong>
        </div>
      </div>
      <div className="list">
        {state.budgets.map((b) => {
          const pct = Math.round((b.spent / b.allocated) * 100);
          const tone = pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : 'ok';
          return (
            <div className="budget" key={b.id}>
              <div>
                <b>{b.costCenter}</b>
                <span>
                  {formatEuro(b.spent)} / {formatEuro(b.allocated)}
                </span>
              </div>
              <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${b.costCenter} : ${pct} % consommé`}>
                <i className={tone} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <SimulatedAction label="Approuver une dépense" allowed={can(role, 'finance', 'edit')} />
    </>
  );
}

export function AccueilPanel({ state }: Props) {
  return (
    <>
      <h3>Agenda du jour</h3>
      <div className="list">
        {state.reception.map((e) => (
          <div className="kv" key={e.id}>
            <span>
              <time>{e.time}</time> {e.label}
            </span>
            <Badge tone={e.kind === 'Réunion' ? 'info' : 'muted'}>{e.kind}</Badge>
          </div>
        ))}
      </div>
    </>
  );
}
