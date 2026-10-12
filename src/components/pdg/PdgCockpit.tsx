// Cockpit PDG : vue d'ensemble de l'entreprise (démonstration).
// Chaque indicateur affiche son périmètre ; aucun résultat calculé sur des périmètres
// différents n'est additionné (Helpdesk, enveloppes déplacements et recrutement restent séparés).
import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { DemoState } from '../../types';
import type { ClientView } from '../../external/derive';
import type { HdTicket } from '../../helpdesk/consolidation';
import { counters } from '../../helpdesk/consolidation';
import type { ManagementState } from '../../management/useManagement';
import type { FinanceState } from '../../finance/useFinance';
import { closedTotals, ENTITIES, ENTITY_LABEL, forEntity, landingTotals, monthResult, monthsOf, prestationAmount, recruitmentBalance, recruitmentImputed, RULE_TO_CONFIRM, travelBalance, type Entity } from '../../finance/budget';
import { craCounters, leaveConflicts } from '../../management/rules';
import { departments, internalSites } from '../../data/sites';
import { rooms } from '../../data/layout';
import { clientRegistry, ITSM_NOT_SET, itsmOf, POLE_GROUP_LABEL } from '../../config/itsm';
import { isOpen, periods, slaRate } from '../../external/metrics';
import { HealthDot } from '../external/common';
import type { AppView } from '../Rail';
import { can, type Role } from '../../auth/roles';

interface Props {
  sim: DemoState;
  views: ClientView[];
  tickets: HdTicket[];
  mgmt: ManagementState;
  fin: FinanceState;
  now: number;
  role: Role;
  onOpen: (v: AppView, sub?: string) => void;
  onBack: () => void;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} %`);

interface Risk {
  level: 'bad' | 'warn';
  label: string;
  view: AppView;
  sub?: string;
}

export function PdgCockpit(props: Props) {
  if (!can(props.role, 'finance'))
    return (
      <section className="xc pdg" aria-label="Cockpit PDG">
        <button className="ghost" onClick={props.onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <p className="restricted">Cockpit réservé à la Direction (accessible en démonstration aux rôles Direction, Finance et Responsable Helpdesk ; contrôle simulé, pas une mesure de sécurité).</p>
      </section>
    );
  return <PdgView {...props} />;
}

function PdgView({ sim, views, tickets, mgmt, fin, now, onOpen, onBack }: Props) {
  // Budgets distincts : Helpdesk N1 (frais de recrutement imputables selon la règle) et MCO N2.
  const byEntity = useMemo(
    () =>
      Object.fromEntries(
        ENTITIES.map((e) => {
          const d = forEntity(fin, e);
          const rows = monthsOf(fin.year).map((m) => monthResult(m, fin.currentMonth, d.costs, d.adjustments, d.prestations, e === 'helpdesk' ? recruitmentImputed(fin.recruitment, m) : 0));
          return [e, { closed: closedTotals(rows), landing: landingTotals(rows) }];
        }),
      ) as Record<Entity, { closed: ReturnType<typeof closedTotals>; landing: ReturnType<typeof landingTotals> }>,
    [fin],
  );
  const travel = travelBalance(fin.travel);
  const recruit = recruitmentBalance(fin.recruitment);
  const week = periods(now).week;
  const n1 = tickets.filter((t) => t.scope === 'interne');
  const n2 = tickets.filter((t) => t.scope === 'externe');
  const kN1 = counters(n1, now);
  const kN2 = counters(n2, now);
  const latestWeek = mgmt.cra.reduce((w, c) => (c.weekStart > w ? c.weekStart : w), '');
  const cra = craCounters(mgmt.cra.filter((c) => c.weekStart === latestWeek));
  const pendingLeaves = mgmt.leaves.filter((l) => l.status === 'Soumise');
  const conflicts = pendingLeaves.filter((l) => leaveConflicts(l, mgmt.collaborators, mgmt.leaves, mgmt.rules).length > 0);
  const toValidate = fin.prestations.filter((p) => p.status === 'À valider');
  const noItsm = clientRegistry.filter((c) => !itsmOf(c.id));
  const connectorIssues = views.filter((v) => v.connector.status === 'erreur' || v.connector.status === 'dégradé');

  const risks: Risk[] = [
    ...(kN1.horsSla.length + kN2.horsSla.length ? [{ level: 'bad' as const, label: `${kN1.horsSla.length + kN2.horsSla.length} ticket(s) hors SLA (N1 : ${kN1.horsSla.length}, N2 : ${kN2.horsSla.length})`, view: 'helpdesk' as AppView }] : []),
    ...connectorIssues.map((v) => ({ level: 'warn' as const, label: `Connecteur ${v.client.tool} ${v.client.name} : ${v.connector.status}`, view: 'itsm' as AppView })),
    { level: 'warn', label: `${noItsm.length} client(s) sans outil ITSM renseigné (${noItsm.map((c) => c.name).join(', ')}) — ${ITSM_NOT_SET}`, view: 'itsm' },
    ...(travel.consumedRate >= 80 ? [{ level: (travel.balance <= 0 ? 'bad' : 'warn') as Risk['level'], label: `Enveloppe déplacements consommée ou engagée à ${travel.consumedRate.toLocaleString("fr-FR")} % (solde ${eur(travel.balance)})`, view: 'finance' as AppView, sub: 'deplacements' }] : []),
    ...(fin.recruitment.rule === 'À confirmer' ? [{ level: 'warn' as const, label: `Budget recrutement : ${RULE_TO_CONFIRM}`, view: 'finance' as AppView, sub: 'recrutement' }] : []),
    ...(conflicts.length ? [{ level: 'warn' as const, label: `${conflicts.length} demande(s) de congé en attente avec effectif réduit (checklist congés)`, view: 'management' as AppView }] : []),
    ...(cra.missing + cra.toFix ? [{ level: 'warn' as const, label: `${cra.missing} CRA manquant(s) et ${cra.toFix} à corriger (dernière semaine échue)`, view: 'management' as AppView }] : []),
    ...(toValidate.length ? [{ level: 'warn' as const, label: `${toValidate.length} prestation(s) à valider (${eur(toValidate.reduce((n, p) => n + prestationAmount(p), 0))})`, view: 'finance' as AppView, sub: 'revenus' }] : []),
    ...ENTITIES.filter((e) => byEntity[e].closed.revenue > 0 && byEntity[e].closed.result < 0).map((e) => ({ level: 'bad' as const, label: `Résultat analytique ${ENTITY_LABEL[e]} négatif sur les mois clos`, view: 'finance' as AppView, sub: `rentabilite@${e}` })),
  ];

  const byPop = (site: string | null) => mgmt.collaborators.filter((c) => c.site === site);
  const revenueOf = (clientId: string) => fin.prestations.filter((p) => p.clientId === clientId && p.status === 'Validée').reduce((n, p) => n + prestationAmount(p), 0);

  return (
    <section className="xc pdg" aria-label="Cockpit PDG">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <b>Cockpit PDG — SEATPI</b>
          <span>3 sites · {departments.length} départements · {mgmt.collaborators.length} collaborateurs (pseudonymes) · données FICTIVES de démonstration</span>
        </div>
      </div>

      <h3>Risques à arbitrer ({risks.length})</h3>
      <ul className="pdg-risks">
        {risks.map((r, i) => (
          <li key={i}>
            <button className={`xc-alert ${r.level === 'bad' ? 'critical' : 'warn'}`} onClick={() => onOpen(r.view, r.sub)}>
              {r.label}
            </button>
          </li>
        ))}
      </ul>

      {ENTITIES.map((e) => {
        const t = byEntity[e];
        return (
          <div key={e}>
            <h3>Budget {ENTITY_LABEL[e]} — entité financière distincte</h3>
            {t.landing.revenue === 0 && t.landing.cost === 0 && <p className="hint">Budget vide pour le moment : coûts et revenus sont portés par le Helpdesk N1.</p>}
            {t.landing.revenue === 0 && t.landing.cost > 0 && <p className="hint">Aucun client rattaché à ce budget pour le moment : il ne porte que des coûts.</p>}
            <div className="xc-kpis">
              <button className="xc-kpi" onClick={() => onOpen('finance', `rentabilite@${e}`)}>
                <small>Résultat analytique (mois clos)</small>
                <strong className={t.closed.result < 0 ? 'xc-warn' : ''}>{eur(t.closed.result)}</strong>
                <em>
                  marge {pct(t.closed.margin)} · périmètre {ENTITY_LABEL[e]}
                </em>
              </button>
              <button className="xc-kpi" onClick={() => onOpen('finance', `previsions@${e}`)}>
                <small>Atterrissage annuel</small>
                <strong>{eur(t.landing.result)}</strong>
                <em>marge projetée {pct(t.landing.margin)}</em>
              </button>
              <button className="xc-kpi" onClick={() => onOpen('finance', `revenus@${e}`)}>
                <small>Revenus validés (mois clos)</small>
                <strong>{eur(t.closed.revenue)}</strong>
              </button>
              <button className="xc-kpi" onClick={() => onOpen('finance', `couts@${e}`)}>
                <small>Coûts opérationnels (mois clos)</small>
                <strong>{eur(t.closed.cost)}</strong>
              </button>
            </div>
          </div>
        );
      })}
      <p className="hint">Deux budgets distincts (Helpdesk N1 et MCO N2) : leurs résultats ne sont jamais additionnés. Résultats analytiques de département, distincts du résultat comptable de l’entreprise ; aucun total entreprise n’est calculé.</p>

      <h3>Enveloppes suivies séparément (non additionnées au résultat)</h3>
      <div className="xc-kpis">
        <button className="xc-kpi" onClick={() => onOpen('finance', 'deplacements')}>
          <small>Déplacements — solde</small>
          <strong className={travel.balance <= 0 ? 'xc-warn' : ''}>{eur(travel.balance)}</strong>
          <em>
            {travel.consumedRate.toLocaleString("fr-FR")} % de {eur(travel.ceiling)} consommé ou engagé
          </em>
        </button>
        <button className="xc-kpi" onClick={() => onOpen('finance', 'recrutement')}>
          <small>Recrutement — solde</small>
          <strong>{eur(recruit.balance)}</strong>
          <em>{fin.recruitment.rule === 'À confirmer' ? RULE_TO_CONFIRM : fin.recruitment.rule}</em>
        </button>
      </div>

      <h3>Performances (périmètres distincts)</h3>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Périmètre</th>
              <th>Ouverts</th>
              <th>Hors SLA</th>
              <th>Résolus semaine</th>
              <th>SLA semaine</th>
              <th>Effectif</th>
            </tr>
          </thead>
          <tbody>
            <tr tabIndex={0} onClick={() => onOpen('helpdesk')}>
              <td>Helpdesk N1 — plateaux internes (clients avec ITSM)</td>
              <td>{kN1.ouverts.length}</td>
              <td>{kN1.horsSla.length}</td>
              <td>{kN1.resolus.length}</td>
              <td>{pct(slaRate(n1, week).rate)}</td>
              <td>{sim.agents.length} agents</td>
            </tr>
            <tr tabIndex={0} onClick={() => onOpen('mco')}>
              <td>MCO N2 — sites clients INVIVO, PRIMAGAZ, MONEXT</td>
              <td>{kN2.ouverts.length}</td>
              <td>{kN2.horsSla.length}</td>
              <td>{kN2.resolus.length}</td>
              <td>{pct(slaRate(n2, week).rate)}</td>
              <td>{mgmt.collaborators.filter((c) => c.population === 'Technicien N2').length} techniciens</td>
            </tr>
            <tr tabIndex={0} onClick={() => onOpen('exploitation')}>
              <td>Exploitation — escalades reçues</td>
              <td>{views.reduce((n, v) => n + v.tickets.filter((t) => t.escalations.some((e) => e.to === 'Exploitation' && e.status === 'En cours')).length, 0)}</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>{mgmt.collaborators.filter((c) => c.population === 'Exploitation').length} collaborateurs</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Sites</h3>
      <div className="xc-sites">
        {internalSites.map((s) => (
          <div key={s.id} className="xc-site" style={{ borderTopColor: s.color }}>
            <b>
              {s.name}
              {s.main ? ' ★' : ''}
            </b>
            <ul className="xc-mini">
              <li>{rooms.filter((r) => r.location === s.id).length} espaces · {departments.filter((d) => d.sites.includes(s.id)).length} départements</li>
              <li>{sim.agents.filter((a) => a.site === s.id).length} agents Helpdesk N1</li>
              <li>{byPop(s.id).length} collaborateurs rattachés (hors N2 chez les clients)</li>
              <li>{departments.filter((d) => !d.sites.includes(s.id)).map((d) => d.label).join(', ') || 'Tous les départements'}{departments.some((d) => !d.sites.includes(s.id)) ? ' : absents' : ''}</li>
            </ul>
          </div>
        ))}
      </div>

      <h3>Effectifs</h3>
      <div className="xc-kpis">
        {(['Agent N1', 'Technicien N2', 'Exploitation', 'CSM', 'Encadrement'] as const).map((p) => (
          <div key={p} className="xc-kpi">
            <small>{p}</small>
            <strong>{mgmt.collaborators.filter((c) => c.population === p).length}</strong>
            <em>{pendingLeaves.filter((l) => mgmt.collaborators.find((c) => c.id === l.personId)?.population === p).length} congé(s) en attente (outil RH)</em>
          </div>
        ))}
      </div>

      <h3>Clients et contrats</h3>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Client</th>
              <th>Type</th>
              <th>Outil ITSM</th>
              <th>Contrat(s)</th>
              <th>Tickets ouverts</th>
              <th>Revenus validés {fin.year}</th>
            </tr>
          </thead>
          <tbody>
            {clientRegistry.map((c) => {
              const v = views.find((x) => x.client.id === c.id);
              const contractIds = [...new Set(fin.prestations.filter((p) => p.clientId === c.id).map((p) => p.contractId))];
              return (
                <tr key={c.id}>
                  <td className="clientcell">
                    {v && <HealthDot health={v.health} />} <b>{c.name}</b>
                  </td>
                  <td>{[c.pole ? `${POLE_GROUP_LABEL[c.pole]} (N1)` : null, c.kind === 'externe' ? 'Site client (N2)' : null].filter(Boolean).join(' + ')}</td>
                  <td>{itsmOf(c.id) ?? <em className="nr">Non renseigné</em>}</td>
                  <td>{contractIds.join(', ') || '—'}</td>
                  <td>{itsmOf(c.id) ? tickets.filter((t) => t.clientId === c.id && isOpen(t)).length : '—'}</td>
                  <td>{eur(revenueOf(c.id))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
