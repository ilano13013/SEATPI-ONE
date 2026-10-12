import { useState } from 'react';
import type { Service, Technician, Ticket, TicketStatus } from '../../external/types';
import { adapters, ALL_STATUSES, checkTransition } from '../../external/itsm/adapters';
import { clientById, contractById } from '../../external/config';
import { internalClientById } from '../../helpdesk/internalClients';
import { ticketTeams } from '../../helpdesk/teams';
import { formatMinutesOuvrees } from '../../external/metrics';
import { can, type Role } from '../../auth/roles';
import type { ActionResult } from '../../external/useExternal';
import { Detail } from '../ui';
import { Modal, PriorityBadge, SlaBadge, StatusBadge, fmtDateTime, fmtHours } from './common';

interface Props {
  ticket: Ticket;
  techs: Technician[];
  role: Role;
  onClose: () => void;
  onMove: (to: TicketStatus, escalateTo?: Service) => ActionResult;
  onAssign: (techId: string) => ActionResult;
}

const KIND_LABEL = { création: 'Création', statut: 'Statut', affectation: 'Affectation', escalade: 'Escalade', commentaire: 'Commentaire' } as const;

export function TicketDetail({ ticket: t, techs, role, onClose, onMove, onAssign }: Props) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [escalateTo, setEscalateTo] = useState<Service>('Exploitation');
  const adapter = adapters[t.source.tool];
    const team = ticketTeams.find((x) => x.id === t.teamId);
  // Un même client peut être traité en N1 (plateau) et en N2 (chez le client) : le contexte vient de l'équipe.
  const client = team?.service === 'Helpdesk N1' ? internalClientById(t.clientId)! : clientById(t.clientId);
  const individual = can(role, 'externes', 'individual');
  const editable = can(role, 'externes', 'edit');
  const techName = (login: string | null | undefined) => {
    if (!login) return 'personne';
    const tech = techs.find((x) => x.sourceLogin === login || x.id === login);
    return individual ? (tech?.name ?? login) : 'technicien';
  };
  const teamTechs = techs.filter((x) => x.teamId === t.teamId);
  const options = ALL_STATUSES.filter((s) => s !== t.status).map((s) => ({ s, check: checkTransition(adapter, t.status, s) }));

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <>
          {t.id} · {t.title}
        </>
      }
    >
      <div className="xc-detail-badges">
        <PriorityBadge p={t.priority} />
        <StatusBadge status={t.status} />
        <SlaBadge state={t.sla.state} paused={t.sla.paused && t.status !== 'Résolu' && t.status !== 'Clôturé'} />
        <span className="badge muted">
          Source : {t.source.tool} n° {t.source.id}
        </span>
      </div>
      <p className="xc-desc">{t.description}</p>

      <div className="xc-detail-grid">
        <section>
          <h4>Informations</h4>
          <Detail
            items={[
              ['Identifiant interne', t.id],
              ['Identifiant source', `${t.source.tool} · ${t.source.id}`],
              ['Statut source (original)', t.sourceStatus],
              ['Priorité source (originale)', t.sourcePriority],
              ['Client', client.name],
              ['Site', t.site],
              ['Contrat', `${t.contractId} — ${contractById(t.contractId).label}`],
              ['Catégorie', t.category],
              ['Technicien', t.assigneeId ? (individual ? (techs.find((x) => x.id === t.assigneeId)?.name ?? '—') : 'Affecté') : 'Non affecté'],
              ['Groupe de traitement', team?.name ?? t.teamId],
              ['Création', fmtDateTime(t.createdAt)],
              ['Dernière mise à jour', fmtDateTime(t.updatedAt)],
              ['Prise en charge', fmtDateTime(t.takenAt)],
              ['Résolution', fmtDateTime(t.resolvedAt)],
              ['Clôture', fmtDateTime(t.closedAt)],
              ['Temps passé', fmtHours(t.timeSpentMin)],
              ['Réouvertures', t.reopenCount],
            ]}
          />
        </section>
        <section>
          <h4>SLA ({client.calendar.label})</h4>
          <Detail
            items={[
              ['Délai contractuel', formatMinutesOuvrees(t.sla.budgetMin)],
              ['Temps ouvré consommé', formatMinutesOuvrees(t.sla.consumedMin)],
              ['Échéance de résolution', t.sla.dueAt ? fmtDateTime(t.sla.dueAt) : 'Décompte suspendu'],
              ['Échéance de prise en charge', fmtDateTime(t.sla.takeChargeDueAt)],
              ['Prise en charge dans le délai', t.sla.takeChargeMet === null ? 'En attente' : t.sla.takeChargeMet ? 'Oui' : 'Non'],
              ['Suspension', client.slaPauseStatuses.join(', ') + ', Résolu, Clôturé'],
            ]}
          />
          <h4>Actions</h4>
          <p className="hint">
            {adapter.tool} : {adapter.capabilities.mode}. {adapter.capabilities.note}
            {!editable && ' Votre rôle ne permet pas de modifier les tickets.'}
          </p>
          <label className="field block">
            <span>Changer le statut</span>
            <select
              value=""
              disabled={!editable}
              onChange={(e) => {
                if (e.target.value) setResult(onMove(e.target.value as TicketStatus, escalateTo));
              }}
            >
              <option value="">— Choisir —</option>
              {options.map(({ s, check }) => (
                <option key={s} value={s} disabled={!check.ok} title={check.reason}>
                  {s}
                  {check.ok ? '' : ' (non autorisé par la source)'}
                </option>
              ))}
            </select>
          </label>
          <label className="field block">
            <span>Destinataire en cas d’escalade</span>
            <select value={escalateTo} disabled={!editable} onChange={(e) => setEscalateTo(e.target.value as Service)}>
              <option value="Exploitation">Exploitation (service interne SEATPI)</option>
              <option value="CSM">CSM (service interne SEATPI)</option>
              <option value="Équipe externe">Équipe externe (éditeur, constructeur, opérateur)</option>
            </select>
          </label>
          {individual && (
            <label className="field block">
              <span>Affecter à</span>
              <select
                value=""
                disabled={!editable || !adapter.capabilities.canAssign}
                onChange={(e) => {
                  if (e.target.value) setResult(onAssign(e.target.value));
                }}
              >
                <option value="">— Choisir un technicien de l’équipe —</option>
                {teamTechs.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {result && <p className={`xc-result ${result.ok ? 'ok' : 'bad'}`}>{result.ok ? `Écriture simulée : ${result.message}` : result.message}</p>}
        </section>
      </div>

      {t.escalations.length > 0 && (
        <section>
          <h4>Escalades</h4>
          {t.escalations.map((e) => (
            <div key={e.id} className="xc-escalation">
              <Detail
                items={[
                  ['Service d’origine', e.from],
                  ['Service destinataire', e.to],
                  ['Date', fmtDateTime(e.at)],
                  ['Motif', e.reason],
                  ['Responsable', e.owner],
                  ['Statut', e.status],
                ]}
              />
              <ol className="xc-trail">
                {e.history.map((h, i) => (
                  <li key={i}>
                    <time>{fmtDateTime(h.at)}</time> {h.label}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}

      <section>
        <h4>Historique des changements</h4>
        <ol className="xc-history">
          {[...t.history].reverse().map((e, i) => (
            <li key={i}>
              <time>{fmtDateTime(e.at)}</time>
              <b>{KIND_LABEL[e.kind]}</b>
              <span>
                {e.kind === 'statut' && `${e.from} → ${e.to}`}
                {e.kind === 'affectation' && `${techName(e.from)} → ${techName(e.to)}`}
                {e.kind === 'escalade' && `${e.from} → ${e.to}`}
                {e.kind === 'création' && `via ${e.by}`}
                {e.note && ` — ${e.note}`}
              </span>
              <small>{e.kind === 'statut' || e.kind === 'commentaire' ? (individual || !e.by.startsWith('Tech.') ? e.by : 'technicien') : ''}</small>
            </li>
          ))}
        </ol>
      </section>
    </Modal>
  );
}
