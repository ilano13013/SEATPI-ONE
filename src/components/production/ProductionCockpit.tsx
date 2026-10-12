// ADMINISTRATION → PRÉPARATION À LA PRODUCTION.
import { useMemo, useState } from 'react';
import { ArrowLeft, FileDown, Printer } from 'lucide-react';
import { DOMAINS, READINESS_ITEMS, reportMarkdown, setStatus, STATUSES, summarize, type Domain, type ReadinessItem, type ReadinessStatus } from '../../production/readiness';
import { activeData, PRODUCTION_PREREQUISITES } from '../../data/provider';
import { can, type Role } from '../../auth/roles';
import { Modal, Toast, downloadText } from '../external/common';

const TONE: Record<ReadinessStatus, string> = { 'Non renseigné': 'muted', 'À configurer': 'warn', 'En cours': 'info', 'À tester': 'info', Validé: 'ok', Bloquant: 'bad' };

export function ProductionCockpit({ role, items, onItems, onBack }: { role: Role; items: ReadinessItem[]; onItems: (i: ReadinessItem[]) => void; onBack: () => void }) {
  const [domain, setDomain] = useState<Domain | ''>('');
  const [status, setStatusFilter] = useState<ReadinessStatus | ''>('');
  const [open, setOpen] = useState<string | null>(null);
  const [evidence, setEvidence] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const s = useMemo(() => summarize(items), [items]);
  const editable = can(role, 'integrations', 'configure');
  const list = items.filter((i) => (!domain || i.domain === domain) && (!status || i.status === status));
  const today = new Date().toISOString().slice(0, 10);

  const change = (id: string, next: ReadinessStatus) => {
    const r = setStatus(items, id, next, today, evidence);
    setToast(r);
    if (r.ok) {
      onItems(r.items);
      setEvidence('');
    }
  };
  const print = (md: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Rapport de préparation — SEATPI ONE</title><pre style="font:12px/1.5 system-ui;white-space:pre-wrap">${esc}</pre>`);
    w.document.close();
    w.print();
  };

  return (
    <section className="xc prod" aria-label="Préparation à la production">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <div>
          <small className="crumb">Administration › Préparation à la production</small>
          <b>Préparation à la production</b>
          <span>Ce qui manque pour passer de la démonstration à une exploitation réelle · {items.length} éléments</span>
        </div>
        <button className="action" onClick={() => setReport(reportMarkdown(items, new Date().toLocaleString('fr-FR')))}>
          GÉNÉRER LE RAPPORT DE PRÉPARATION
        </button>
      </div>
      <p className="fin-warning">
        Source de données active : <b>{activeData.provider.label}</b>. {activeData.warning ?? 'Aucune bascule vers des données réelles n’est possible tant que les prérequis ne sont pas validés :'} {!activeData.warning && PRODUCTION_PREREQUISITES.join(' ; ')}.
      </p>

      <div className="xc-kpis">
        <button className="xc-kpi" onClick={() => setStatusFilter('')}>
          <small>Éléments</small>
          <strong>{s.total}</strong>
        </button>
        <button className="xc-kpi ok" onClick={() => setStatusFilter('Validé')}>
          <small>Validés</small>
          <strong>{s.validated}</strong>
        </button>
        <button className={`xc-kpi ${s.blocking ? 'bad' : 'ok'}`} onClick={() => setStatusFilter('Bloquant')}>
          <small>Bloquants</small>
          <strong>{s.blocking}</strong>
        </button>
        <button className="xc-kpi" onClick={() => setStatusFilter('À tester')}>
          <small>En cours / à tester</small>
          <strong>{s.inProgress}</strong>
        </button>
        <div className="xc-kpi">
          <small>Taux de préparation</small>
          <strong>{s.rate.toLocaleString('fr-FR')} %</strong>
          <em>avancement de la liste — pas une certification de sécurité</em>
        </div>
        <div className={`xc-kpi ${s.go ? 'ok' : 'bad'}`}>
          <small>Décision</small>
          <strong>{s.go ? 'GO' : 'NO-GO'}</strong>
          <em>{s.go ? 'prérequis réunis' : s.goReasons.join(' ; ')}</em>
        </div>
      </div>

      <h3>Éléments critiques manquants ({s.criticalMissing.length})</h3>
      <ul className="xc-mini">
        {s.criticalMissing.map((i) => (
          <li key={i.id}>
            <button className="link" onClick={() => setOpen(i.id)}>
              {i.id}
            </button>{' '}
            {i.title} — <span className={`badge ${TONE[i.status]}`}>{i.status}</span> · {i.owner}
          </li>
        ))}
      </ul>

      <div className="xc-toolbar">
        <select aria-label="Domaine" value={domain} onChange={(e) => setDomain(e.target.value as Domain | '')}>
          <option value="">Tous les domaines</option>
          {DOMAINS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select aria-label="Statut" value={status} onChange={(e) => setStatusFilter(e.target.value as ReadinessStatus | '')}>
          <option value="">Tous les statuts</option>
          {STATUSES.map((st) => (
            <option key={st}>{st}</option>
          ))}
        </select>
        <span className="hint">{list.length} élément(s)</span>
      </div>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Réf.</th>
              <th>Domaine</th>
              <th>Élément</th>
              <th>Priorité</th>
              <th>Statut</th>
              <th>Responsable</th>
              <th>Dépendances</th>
              <th>Dernière vérification</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id} tabIndex={0} onClick={() => setOpen(i.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(i.id)}>
                <td>
                  <b>{i.id}</b>
                </td>
                <td>{i.domain}</td>
                <td>{i.title}</td>
                <td>{i.priority}</td>
                <td>
                  <span className={`badge ${TONE[i.status]}`}>{i.status}</span>
                </td>
                <td>{i.owner}</td>
                <td>{i.dependencies.join(', ') || '—'}</td>
                <td>{i.lastCheck ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open &&
        (() => {
          const i = items.find((x) => x.id === open)!;
          return (
            <Modal title={`${i.id} — ${i.title}`} onClose={() => setOpen(null)}>
              <dl className="prod-detail">
                <dt>Ce qui manque</dt>
                <dd>{i.missing}</dd>
                <dt>Pourquoi</dt>
                <dd>{i.why}</dd>
                <dt>Responsable</dt>
                <dd>{i.owner}</dd>
                <dt>Action</dt>
                <dd>{i.action}</dd>
                <dt>Priorité</dt>
                <dd>{i.priority}</dd>
                <dt>Dépendances</dt>
                <dd>{i.dependencies.join(', ') || 'Aucune'}</dd>
                <dt>Statut</dt>
                <dd>
                  <span className={`badge ${TONE[i.status]}`}>{i.status}</span>
                </dd>
                <dt>Dernière vérification</dt>
                <dd>
                  {i.lastCheck ?? 'Jamais'}
                  {i.evidence ? ` — preuve : ${i.evidence}` : ''}
                </dd>
              </dl>
              {editable ? (
                <>
                  <p className="hint">Mise à jour simulée (non enregistrée sur un serveur). « Validé » exige une preuve de vérification réelle et des dépendances validées.</p>
                  <input className="prod-evidence" aria-label="Preuve de vérification" placeholder="Preuve de vérification (obligatoire pour Validé)" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
                  <div className="mg-actions">
                    {STATUSES.filter((st) => st !== i.status).map((st) => (
                      <button key={st} className={st === 'Validé' ? 'action' : 'ghost'} onClick={() => change(i.id, st)}>
                        {st}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="restricted">Mise à jour réservée aux rôles Responsable Helpdesk et Admin (maquette).</p>
              )}
            </Modal>
          );
        })()}

      {report && (
        <Modal wide title="Rapport de préparation à la production" onClose={() => setReport(null)}>
          <div className="mg-actions">
            <button className="action" onClick={() => downloadText(`SEATPI_ONE_preparation_production_${today}.md`, report)}>
              <FileDown size={14} /> Télécharger (Markdown)
            </button>
            <button className="ghost" onClick={() => print(report)}>
              <Printer size={14} /> Imprimer / enregistrer en PDF
            </button>
          </div>
          <pre className="prod-report">{report}</pre>
        </Modal>
      )}
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </section>
  );
}

export const INITIAL_READINESS = READINESS_ITEMS;
