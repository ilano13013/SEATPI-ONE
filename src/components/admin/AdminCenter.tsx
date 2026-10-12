// ⚙️ Administration de SEATPI ONE : connexions & API, rôles & permissions, référentiel clients
// (CRM), paramètres SLA / tableaux de bord et historique des modifications.
// Démonstration : aucune connexion réelle, aucun secret saisi, aucune persistance.
import { useState } from 'react';
import { AccessNotice } from '../ui';
import { missingRight } from '../../auth/access';
import { ArrowLeft, Lock, Pencil, Plug, Plus, ShieldCheck } from 'lucide-react';
import type { AdminStore, ClientStatus } from '../../admin/useAdmin';
import { AUTH_TYPES, CONFIG_STATUSES, configStatus, DEMO_TEST_MESSAGE, ITSM_TOOLS, missingFields, readinessLinksOf, toolOfConnector, type ConnectorKind } from '../../admin/connections';
import { clientBudget, clientRecord, clientRegistry, itsmOf, POLE_GROUP_LABEL, type MappedTool, type PoleGroup } from '../../config/itsm';
import { ACTIONS, actionLabels, can, clientScope, permissionModules, roleLabels, type Action, type PermissionRule, type Role } from '../../auth/roles';
import type { AuditEntry } from '../../audit/audit';
import type { FinanceStore } from '../../finance/useFinance';
import { contracts } from '../../external/config';
import { Tabs } from '../ui';
import { Toast, fmtDateTime } from '../external/common';
import { InlineEdit, type SaveResult } from '../InlineEdit';

export type AdminTab = 'connexions' | 'roles' | 'clients' | 'parametres' | 'historique';

interface Props {
  admin: AdminStore;
  fin: FinanceStore;
  role: Role;
  tab: AdminTab;
  onTab: (t: AdminTab) => void;
  rules: PermissionRule[];
  onRules: (r: PermissionRule[]) => void;
  audit: AuditEntry[];
  onOpenProduction: () => void;
  onBack: () => void;
}

const TOOLS: MappedTool[] = ['EasyVista', 'Jira', 'GLPI', 'ISILOG', 'Zendesk', 'ServiceNow'];
const STATUS_TONE: Record<string, string> = { 'Non configuré': 'muted', 'Configuration incomplète': 'warn', 'Prêt à tester': 'info', Connecté: 'ok', 'Erreur de connexion': 'bad' };
const NR = <em className="nr">Non renseigné</em>;
const roles = Object.keys(roleLabels) as Role[];

export function AdminCenter(props: Props) {
  const { role, tab, onTab, onBack } = props;
  if (!can(role, 'integrations') && !can(role, 'permissions'))
    return (
      <section className="xc" aria-label="Administration">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <AccessNotice access={missingRight(role, ['integrations', 'permissions'])} />
      </section>
    );
  return (
    <section className="xc adm" aria-label="Administration">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <small className="crumb">Administration</small>
          <b>Administration de SEATPI ONE</b>
          <span>Paramètres modifiables sans toucher au code · démonstration : non persistés, aucune connexion réelle · en production, contrôlés et enregistrés par le backend</span>
        </div>
        <button className="ghost" onClick={props.onOpenProduction}>
          <ShieldCheck size={14} /> Préparation à la production
        </button>
      </div>
      <div className="xc-tabs">
        <Tabs
          value={tab}
          onChange={onTab}
          tabs={[
            { id: 'connexions', label: 'Connexions & API' },
            { id: 'roles', label: 'Rôles & permissions' },
            { id: 'clients', label: 'Clients (CRM)' },
            { id: 'parametres', label: 'Paramètres SLA et tableaux de bord' },
            { id: 'historique', label: 'Historique des modifications' },
          ]}
        />
      </div>
      {tab === 'connexions' && <Connections {...props} />}
      {tab === 'roles' && <Permissions {...props} />}
      {tab === 'clients' && <Crm {...props} />}
      {tab === 'parametres' && <Settings {...props} />}
      {tab === 'historique' && <History entries={props.audit} />}
    </section>
  );
}

function Connections({ admin, role, onOpenProduction }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<SaveResult | null>(null);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<ConnectorKind>('ITSM');
  const [newClient, setNewClient] = useState('');
  const editable = can(role, 'integrations', 'configure');
  const c = admin.state.connectors.find((x) => x.id === open);
  const card = (x: (typeof admin.state.connectors)[number]) => {
    const st = configStatus(x);
    const tool = toolOfConnector(x);
    return (
      <button key={x.id} className={`connector-card adm-card${open === x.id ? ' active' : ''}`} onClick={() => setOpen(open === x.id ? null : x.id)} aria-label={`Fiche ${x.scope === 'client' ? clientRecord(x.clientId!)?.name ?? x.name : x.name}`}>
        <span className="adm-logo" aria-hidden>
          {(x.scope === 'client' ? (tool ?? '?') : x.name).slice(0, 2).toUpperCase()}
        </span>
        <span>
          <b>{x.scope === 'client' ? (clientRecord(x.clientId!)?.name ?? x.name) : x.name}</b>
          <small>{x.scope === 'client' ? `${tool ?? 'ITSM à confirmer'} · domaine propre au client` : `${x.kind} · tous les clients`}</small>
        </span>
        <span className={`badge ${STATUS_TONE[st]}`}>{st}</span>
      </button>
    );
  };
  return (
    <>
      <p className="fin-warning">
        Aucune URL propre à l’entreprise n’est pré-remplie et aucune connexion réelle n’existe. Les clés API et mots de passe ne sont jamais saisis ici : seule la référence du secret conservé dans le coffre du futur backend est renseignée. {editable ? '' : 'Configuration réservée aux administrateurs : consultation uniquement.'}
      </p>
      <div className="adm-legend">
        Statuts :{' '}
        {CONFIG_STATUSES.map((s) => (
          <span key={s} className={`badge ${STATUS_TONE[s]}`}>
            {s}
          </span>
        ))}
      </div>
      <h3>Connecteurs ITSM — un par client (chaque client a son propre domaine)</h3>
      {[...ITSM_TOOLS, null].map((tool) => {
        const list = admin.state.connectors.filter((x) => x.scope === 'client' && toolOfConnector(x) === tool);
        if (!list.length) return null;
        return (
          <div key={tool ?? 'none'} className="adm-group">
            <h4>
              {tool ?? 'Outil à confirmer'} <small className="hint">· {list.length} client(s)</small>
            </h4>
            <div className="connector-grid">{list.map(card)}</div>
          </div>
        );
      })}
      <h3>Connecteurs généraux — communs à tous les clients</h3>
      <div className="connector-grid">{admin.state.connectors.filter((x) => x.scope === 'général').map(card)}</div>
      {editable && (
        <div className="mg-form">
          <input aria-label="Nom du nouveau connecteur" placeholder="Nouveau connecteur (nom du service)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select aria-label="Type de connecteur" value={newKind} onChange={(e) => setNewKind(e.target.value as ConnectorKind)}>
            {(['ITSM', 'Statistiques', 'Téléphonie', 'Autre'] as const).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <select aria-label="Portée du connecteur" value={newClient} onChange={(e) => setNewClient(e.target.value)}>
            <option value="">Commun à tous les clients</option>
            {clientRegistry.map((cl) => (
              <option key={cl.id} value={cl.id}>
                Propre au client {clientRecord(cl.id)?.name}
              </option>
            ))}
          </select>
          <button className="action" onClick={() => setToast(admin.addConnector(newName, newKind, newClient || null))}>
            <Plus size={14} /> Ajouter un connecteur
          </button>
        </div>
      )}

      {c && (
        <article className="adm-sheet" aria-label={`Configuration ${c.scope === 'client' ? (clientRecord(c.clientId!)?.name ?? c.name) : c.name}`}>
          <header>
            <span className="adm-logo" aria-hidden>
              {c.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h3>{c.scope === 'client' ? `${clientRecord(c.clientId!)?.name ?? c.name} — ${toolOfConnector(c) ?? 'ITSM à confirmer'}` : c.name}</h3>
              <small>
                Logo officiel non intégré (marque de l’éditeur) · {c.kind} · {c.scope === 'client' ? 'connecteur propre au client (domaine dédié)' : 'connecteur commun à tous les clients'}
              </small>
            </div>
            <span className={`badge ${STATUS_TONE[configStatus(c)]}`}>{configStatus(c)}</span>
          </header>
          <dl className="prod-detail">
            <dt>URL de documentation</dt>
            <dd>
              <InlineEdit value={c.docUrl} field={`${c.name} — URL de documentation`} module="Connexions & API" canEdit={editable} format={(v) => v || NR} onSave={(v) => admin.setConnectorField(c.id, 'docUrl', v)} />
              <small className="hint"> URL officielle à renseigner après vérification (non vérifiable depuis cet environnement).</small>
            </dd>
            <dt>Type d’authentification</dt>
            <dd>
              <InlineEdit value={c.authType ?? ''} field={`${c.name} — authentification`} module="Connexions & API" canEdit={editable} options={[{ value: '', label: 'Non renseigné' }, ...AUTH_TYPES.map((a) => ({ value: a, label: a }))]} format={(v) => v || NR} onSave={(v) => admin.setConnectorField(c.id, 'authType', v)} />
            </dd>
            <dt>Référence du secret</dt>
            <dd>
              <InlineEdit value={c.secretRef} field={`${c.name} — référence du secret`} module="Connexions & API" canEdit={editable} sensitive format={(v) => v || NR} onSave={(v) => admin.setConnectorField(c.id, 'secretRef', v)} />
              <small className="hint"> Nom du secret dans le coffre du backend — jamais la valeur.</small>
            </dd>
            <dt>Connexion réelle</dt>
            <dd>{configStatus(c) === 'Prêt à tester' ? 'Prêt à tester — aucun test réel possible sans backend sécurisé' : configStatus(c)}</dd>
            <dt>Dernier test</dt>
            <dd>{c.lastTest ? `${fmtDateTime(c.lastTest.at)} — ${c.lastTest.result}` : 'Jamais'}</dd>
            <dt>Dernière synchronisation réelle</dt>
            <dd>{c.lastSync ? fmtDateTime(c.lastSync) : 'Aucune (pas de connexion réelle)'}</dd>
            <dt>Simulation</dt>
            <dd>{c.scope === 'client' ? 'Flux de tickets fictifs générés dans le navigateur, indépendant de cette configuration' : 'Extraction fictive (aucune connexion)'}</dd>
            <dt>Éléments manquants</dt>
            <dd>{missingFields(c).join(' ; ') || 'Aucun'}</dd>
          </dl>
          <button className="action" onClick={() => setToast(admin.testConnection(c.id))}>
            <Plug size={14} /> Tester la connexion
          </button>
          <p className="hint">En démonstration, le bouton affiche « {DEMO_TEST_MESSAGE} » : aucun succès n’est simulé.</p>

          <h4>Instances ({c.instances.length})</h4>
          {c.instances.map((i) => (
            <div key={i.id} className="adm-instance">
              <dl className="prod-detail">
                <dt>Nom</dt>
                <dd>
                  <InlineEdit value={i.label} field={`${c.name} — nom d’instance`} module="Connexions & API" canEdit={editable} onSave={(v) => admin.setInstanceField(c.id, i.id, 'label', v)} />
                </dd>
                <dt>URL de connexion</dt>
                <dd>
                  <InlineEdit value={i.instanceUrl} field={`${c.name} / ${i.label} — URL de connexion`} module="Connexions & API" canEdit={editable} format={(v) => v || NR} onSave={(v) => admin.setInstanceField(c.id, i.id, 'instanceUrl', v)} />
                </dd>
                <dt>URL de l’API</dt>
                <dd>
                  <InlineEdit value={i.apiUrl} field={`${c.name} / ${i.label} — URL de l’API`} module="Connexions & API" canEdit={editable} format={(v) => v || NR} onSave={(v) => admin.setInstanceField(c.id, i.id, 'apiUrl', v)} />
                </dd>
                <dt>Clients associés</dt>
                {c.scope === 'client' ? (
                  <dd>{clientRecord(c.clientId!)?.name} (connecteur dédié)</dd>
                ) : c.instances.length === 1 && i.clients.length === clientRegistry.length ? (
                  <dd>Tous les clients ({clientRegistry.length})</dd>
                ) : (
                <dd className="adm-clients">
                  {clientRegistry.map((cl) => (
                    <label key={cl.id} className={i.clients.includes(cl.id) ? 'on' : ''}>
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={i.clients.includes(cl.id)}
                        onChange={(e) => admin.setInstanceClients(c.id, i.id, e.target.checked ? [...i.clients, cl.id] : i.clients.filter((x) => x !== cl.id))}
                      />
                      {cl.name}
                    </label>
                  ))}
                </dd>
                )}
                <dt>Endpoints spécifiques</dt>
                <dd>
                  {i.endpoints.length ? i.endpoints.map((e) => <code key={e.name}>{`${e.name} : ${e.path}`}</code>) : NR}
                  {editable && <EndpointForm onAdd={(n, p) => setToast(admin.addEndpoint(c.id, i.id, n, p))} />}
                </dd>
              </dl>
              {editable && c.instances.length > 1 && (
                <button className="link" onClick={() => admin.removeInstance(c.id, i.id)}>
                  Retirer cette instance
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button className="ghost" onClick={() => admin.addInstance(c.id)}>
              <Plus size={12} /> Ajouter une instance
            </button>
          )}
          <h4>Paramètres de configuration</h4>
          <ul className="xc-mini">
            {c.params.length === 0 && <li className="hint">Aucun paramètre.</li>}
            {c.params.map((p) => (
              <li key={p.key}>
                <code>{p.key}</code> = {p.value}
              </li>
            ))}
          </ul>
          {editable && <ParamForm onAdd={(k, v) => setToast(admin.setParam(c.id, k, v))} />}
          <h4>Préparation à la production</h4>
          <p>
            Éléments liés : {readinessLinksOf(c).join(', ') || '—'}{' '}
            <button className="link" onClick={onOpenProduction}>
              Ouvrir la liste de contrôle
            </button>
          </p>
        </article>
      )}
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </>
  );
}

function EndpointForm({ onAdd }: { onAdd: (name: string, path: string) => void }) {
  const [n, setN] = useState('');
  const [p, setP] = useState('');
  return (
    <span className="mg-form">
      <input aria-label="Nom de l’endpoint" placeholder="Nom (ex. tickets)" value={n} onChange={(e) => setN(e.target.value)} />
      <input aria-label="Chemin de l’endpoint" placeholder="/chemin" value={p} onChange={(e) => setP(e.target.value)} />
      <button className="ghost" onClick={() => onAdd(n, p)}>
        Ajouter
      </button>
    </span>
  );
}

function ParamForm({ onAdd }: { onAdd: (k: string, v: string) => void }) {
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  return (
    <div className="mg-form">
      <input aria-label="Nom du paramètre" placeholder="Paramètre (ex. pageSize)" value={k} onChange={(e) => setK(e.target.value)} />
      <input aria-label="Valeur du paramètre" placeholder="Valeur (jamais un secret)" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="ghost" onClick={() => onAdd(k, v)}>
        Enregistrer le paramètre
      </button>
    </div>
  );
}

function Permissions({ role, rules, onRules }: Props) {
  const [target, setTarget] = useState<Role>('teamLeader');
  const [scoped, setScoped] = useState({ module: 'objectifs', action: 'edit' as Action, pole: '', department: '', team: '' });
  const editable = can(role, 'permissions', 'configure');
  const base = rules.filter((r) => r.role === target && !r.scope);
  const has = (m: string, a: Action) => base.some((r) => r.module === m && r.actions.includes(a));
  const toggle = (m: string, a: Action) => {
    const existing = base.find((r) => r.module === m);
    const actions = existing ? (existing.actions.includes(a) ? existing.actions.filter((x) => x !== a) : [...existing.actions, a]) : [a];
    const others = rules.filter((r) => r !== existing);
    onRules([...others, ...(actions.length ? [{ id: `${target}:${m}`, role: target, module: m as PermissionRule['module'], actions }] : [])]);
  };
  return (
    <>
      <p className="fin-warning">Les permissions simulées illustrent l’expérience par profil ; elles ne constituent pas une sécurité. En production, chaque lecture et modification sera vérifiée côté serveur. Le droit de lecture ne donne pas le droit de modifier.</p>
      <label className="xc-inline">
        Rôle
        <select value={target} onChange={(e) => setTarget(e.target.value as Role)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </label>
      {!editable && <p className="restricted">Gestion des rôles réservée aux administrateurs : consultation uniquement.</p>}
      <div className="xc-tablewrap">
        <table className="xc-table compact adm-matrix">
          <thead>
            <tr>
              <th>Module</th>
              {ACTIONS.map((a) => (
                <th key={a}>{actionLabels[a]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionModules.map((m) => (
              <tr key={m.id}>
                <td>{m.label}</td>
                {ACTIONS.map((a) => (
                  <td key={a}>
                    <input type="checkbox" aria-label={`${roleLabels[target]} — ${m.label} — ${actionLabels[a]}`} disabled={!editable} checked={has(m.id, a)} onChange={() => toggle(m.id, a)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Droits limités à un périmètre (département, pôle, équipe)</h3>
      <ul className="xc-mini">
        {rules
          .filter((r) => r.scope)
          .map((r) => (
            <li key={r.id}>
              {roleLabels[r.role]} · {permissionModules.find((m) => m.id === r.module)?.label} · {r.actions.map((a) => actionLabels[a]).join(', ')} · périmètre :{' '}
              {Object.entries(r.scope!)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k === 'pole' ? 'pôle' : k === 'department' ? 'département' : 'équipe'} ${k === 'pole' && v !== 'n2' ? POLE_GROUP_LABEL[v as PoleGroup] : v}`)
                .join(', ')}{' '}
              {editable && (
                <button className="link" onClick={() => onRules(rules.filter((x) => x.id !== r.id))}>
                  Retirer
                </button>
              )}
            </li>
          ))}
        {!rules.some((r) => r.scope) && <li className="hint">Aucun droit limité à un périmètre.</li>}
      </ul>
      {editable && (
        <div className="mg-form">
          <select aria-label="Module du droit" value={scoped.module} onChange={(e) => setScoped({ ...scoped, module: e.target.value })}>
            {permissionModules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select aria-label="Action du droit" value={scoped.action} onChange={(e) => setScoped({ ...scoped, action: e.target.value as Action })}>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionLabels[a]}
              </option>
            ))}
          </select>
          <select aria-label="Pôle du droit" value={scoped.pole} onChange={(e) => setScoped({ ...scoped, pole: e.target.value })}>
            <option value="">Tous les pôles</option>
            <option value="multi">Pôle Multi</option>
            <option value="dedie">Pôle Dédié</option>
            <option value="n2">MCO N2</option>
          </select>
          <input aria-label="Département du droit" placeholder="Département (optionnel)" value={scoped.department} onChange={(e) => setScoped({ ...scoped, department: e.target.value })} />
          <input aria-label="Équipe du droit" placeholder="Équipe (optionnel)" value={scoped.team} onChange={(e) => setScoped({ ...scoped, team: e.target.value })} />
          <button
            className="action"
            onClick={() => {
              const scope = Object.fromEntries(Object.entries({ pole: scoped.pole, department: scoped.department.trim(), team: scoped.team.trim() }).filter(([, v]) => v));
              if (!Object.keys(scope).length) return;
              onRules([...rules, { id: `${target}:${scoped.module}:${Date.now()}`, role: target, module: scoped.module as PermissionRule['module'], actions: [scoped.action], scope }]);
            }}
          >
            Ajouter le droit pour {roleLabels[target]}
          </button>
        </div>
      )}
    </>
  );
}

/** Référentiel clients (CRM) — aussi accessible directement depuis le menu (droit « Référentiel clients »). */
export function Crm({ admin, fin, role }: Pick<Props, 'admin' | 'fin' | 'role'>) {
  // Les profils qui consultent le CRM modifient les champs métier de leur périmètre
  // (rattachement budgétaire, forfait) ; ni secrets, ni permissions, ni validations financières.
  const scope = clientScope(role);
  const canEdit = (id: string) => can(role, 'clients', 'edit') && (!scope || scope === id);
  // Champs structurants (nom, pôle, outil ITSM) : administration du référentiel.
  const canConfigure = can(role, 'clients', 'configure');
  const lockConf = 'Champ structurant : droit « Administration » sur « Référentiel clients (CRM) » requis';
  const lock = can(role, 'clients', 'edit') ? 'Hors de votre périmètre client : lecture seule' : 'Lecture seule : droit « Modification » sur « Référentiel clients (CRM) » manquant pour votre profil';
  return (
    <>
      <p className="hint">Référentiel central des clients. Cliquez sur un champ pour le modifier selon vos droits. Le pôle et l’outil ITSM sont des modifications sensibles (confirmation) : elles mettent à jour le référentiel, les filtres et les fiches connecteurs ; les flux de tickets fictifs déjà générés ne sont pas régénérés. Le pôle n’est jamais déduit de l’outil ITSM.</p>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Client</th>
              <th>Pôle (N1)</th>
              <th>N2 chez le client</th>
              <th>Outil ITSM</th>
              <th>Budget (revenus)</th>
              <th>Contrat</th>
              <th>Forfait mensuel (contrat N2)</th>
              <th>Secteur</th>
              <th>Référent</th>
              <th>Statut</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {clientRegistry.map((base) => {
              const c = clientRecord(base.id)!;
              const crm = admin.state.crm[c.id];
              const contract = contracts.find((x) => x.clientId === c.id);
              const editable = canEdit(c.id);
              const forfait = contract ? (fin.state.prestations.find((p) => p.contractId === contract.id && p.type === 'Forfait' && p.status === 'Prévisionnelle')?.unitPrice ?? contract.monthlyBudget) : null;
              return (
                <tr key={c.id}>
                  <td>
                    <InlineEdit value={c.name} field={`Nom du client ${base.name}`} module="Clients (CRM)" canEdit={canConfigure} lockedReason={lockConf} onSave={(v) => admin.setClientOverride(c.id, { name: v })} />
                  </td>
                  <td>
                    <InlineEdit
                      value={c.pole ?? ''}
                      field={`Pôle de ${c.name}`}
                      module="Clients (CRM)"
                      canEdit={canConfigure}
                      lockedReason={lockConf}
                      sensitive
                      options={[{ value: '', label: 'Aucun (pas de N1)' }, { value: 'multi', label: 'Pôle Multi' }, { value: 'dedie', label: 'Pôle Dédié' }]}
                      onSave={(v) => admin.setClientOverride(c.id, { pole: (v || null) as PoleGroup | null })}
                    />
                  </td>
                  <td>{c.kind === 'externe' ? 'Oui (MCO N2)' : '—'}</td>
                  <td>
                    <InlineEdit
                      value={itsmOf(c.id) ?? ''}
                      field={`Outil ITSM de ${c.name}`}
                      module="Clients (CRM)"
                      canEdit={canConfigure}
                      lockedReason={lockConf}
                      sensitive
                      options={[{ value: '', label: 'À confirmer (non renseigné)' }, ...TOOLS.map((t) => ({ value: t, label: t }))]}
                      onSave={(v) => admin.setClientOverride(c.id, { tool: (v || null) as MappedTool | null })}
                    />
                  </td>
                  <td>
                    <InlineEdit
                      value={clientBudget(c.id)}
                      field={`Budget de rattachement de ${c.name}`}
                      module="Clients (CRM)"
                      canEdit={editable}
                      lockedReason={lock}
                      sensitive
                      options={[{ value: 'helpdesk', label: 'Helpdesk N1' }, { value: 'mco', label: 'MCO N2' }]}
                      onSave={(v) => admin.setClientOverride(c.id, { budget: v as 'helpdesk' | 'mco' })}
                    />
                  </td>
                  <td>
                    <InlineEdit value={crm.contractRef} field={`Référence contrat ${c.name}`} module="Clients (CRM)" canEdit={editable} lockedReason={lock} onSave={(v) => admin.setCrm(c.id, { contractRef: v })} />
                  </td>
                  <td>
                    {contract && forfait !== null ? (
                      <InlineEdit value={forfait} field={`Forfait mensuel ${c.name} (mois à venir)`} module="Données contractuelles" canEdit={editable} lockedReason={lock} sensitive type="number" min={0} format={(v) => `${Math.round(v).toLocaleString('fr-FR')} €`} onSave={(v) => fin.setContractForfait(contract.id, v, role)} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <InlineEdit value={crm.sector} field={`Secteur ${c.name}`} module="Clients (CRM)" canEdit={editable} lockedReason={lock} format={(v) => v || NR} validate={() => null} onSave={(v) => admin.setCrm(c.id, { sector: v })} />
                  </td>
                  <td>
                    <InlineEdit value={crm.referent} field={`Référent ${c.name}`} module="Clients (CRM)" canEdit={editable} lockedReason={lock} format={(v) => v || NR} onSave={(v) => admin.setCrm(c.id, { referent: v })} />
                  </td>
                  <td>
                    <InlineEdit value={crm.status} field={`Statut ${c.name}`} module="Clients (CRM)" canEdit={editable} lockedReason={lock} options={(['Actif', 'En démarrage', 'Suspendu'] as ClientStatus[]).map((s) => ({ value: s, label: s }))} onSave={(v) => admin.setCrm(c.id, { status: v as ClientStatus })} />
                  </td>
                  <td>
                    <InlineEdit value={crm.notes} field={`Notes ${c.name}`} module="Clients (CRM)" canEdit={editable} lockedReason={lock} format={(v) => v || '—'} onSave={(v) => admin.setCrm(c.id, { notes: v })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        <Pencil size={10} aria-hidden /> champ modifiable · <Lock size={10} aria-hidden /> lecture seule (droit ou périmètre). Les valeurs calculées (résultat, marge, prévisions) ne se saisissent pas : elles sont recalculées. Chaque modification est journalisée (utilisateur, date, module, champ, ancienne et nouvelle valeur).
      </p>
      <p className="hint">Forfait mensuel : modifie les prestations à venir (prévisionnelles et à valider) du contrat ; le résultat analytique et les prévisions sont recalculés immédiatement.</p>
    </>
  );
}

function Settings({ admin, role }: Props) {
  const editable = can(role, 'sla', 'edit');
  const editDash = can(role, 'dashboard', 'edit');
  const s = admin.state.sla;
  const cell = (kind: 'answerObjective' | 'n2TakeCharge' | 'n2Resolution', id: string, label: string) => {
    const v = s[kind][id] ?? null;
    return (
      <span className="adm-obj">
        <InlineEdit value={v ?? 0} field={`${label} — ${clientRecord(id)?.name ?? id}`} module="Paramètres SLA" canEdit={editable} sensitive type="number" min={0} max={100} step={0.5} format={() => (v === null ? 'Non renseigné' : `${v} %`)} onSave={(n) => admin.setSla(kind, id, n)} />
        {editable && v !== null && (
          <button className="link" onClick={() => admin.setSla(kind, id, null)}>
            Effacer
          </button>
        )}
      </span>
    );
  };
  return (
    <>
      <p className="fin-warning">
        Aucun seuil contractuel n’est inventé : les objectifs sont « non renseignés » tant qu’ils n’ont pas été saisis à partir des contrats. {s.demoObjectives && 'Des objectifs de DÉMONSTRATION (fictifs) sont actuellement chargés.'}
      </p>
      {editable && (
        <button className="ghost" onClick={admin.loadDemoObjectives}>
          Charger des objectifs de démonstration (fictifs, clairement identifiés)
        </button>
      )}
      <h3>Objectifs SLA par client</h3>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Client</th>
              <th>Pôle</th>
              <th>SLA décroché (téléphonie)</th>
              <th>N2 — prise en charge</th>
              <th>N2 — résolution</th>
            </tr>
          </thead>
          <tbody>
            {clientRegistry.map((c) => (
              <tr key={c.id}>
                <td>{clientRecord(c.id)?.name}</td>
                <td>{clientRecord(c.id)?.pole ? POLE_GROUP_LABEL[clientRecord(c.id)!.pole!] : '—'}</td>
                <td>{clientRecord(c.id)?.pole ? cell('answerObjective', c.id, 'Objectif SLA décroché') : '—'}</td>
                <td>{c.kind === 'externe' ? cell('n2TakeCharge', c.id, 'Objectif N2 prise en charge') : '—'}</td>
                <td>{c.kind === 'externe' ? cell('n2Resolution', c.id, 'Objectif N2 résolution') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Paramètres des tableaux de bord</h3>
      <dl className="prod-detail">
        <dt>Seuil du backlog (cockpit Helpdesk)</dt>
        <dd>
          <InlineEdit value={admin.state.dashboard.backlogHours} field="Seuil du backlog (heures)" module="Tableaux de bord" canEdit={editDash} type="number" min={1} max={720} step={1} format={(v) => `${v} h`} onSave={(v) => admin.setDashboard({ backlogHours: v })} />
        </dd>
      </dl>
    </>
  );
}

function History({ entries }: { entries: AuditEntry[] }) {
  const [module, setModule] = useState('');
  const modules = [...new Set(entries.map((e) => e.module))];
  const list = entries.filter((e) => !module || e.module === module);
  return (
    <>
      <p className="hint">Toutes les modifications faites en direct dans l’application (démonstration : non persistées ; en production, journal serveur non modifiable).</p>
      <select aria-label="Module" value={module} onChange={(e) => setModule(e.target.value)}>
        <option value="">Tous les modules</option>
        {modules.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <div className="xc-tablewrap">
        <table className="xc-table compact" aria-label="Historique des modifications">
          <thead>
            <tr>
              <th>Date et heure</th>
              <th>Utilisateur</th>
              <th>Module</th>
              <th>Champ</th>
              <th>Ancienne valeur</th>
              <th>Nouvelle valeur</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => (
              <tr key={i}>
                <td>{fmtDateTime(e.at)}</td>
                <td>{e.user}</td>
                <td>{e.module}</td>
                <td>{e.field}</td>
                <td>{e.oldValue || '—'}</td>
                <td>{e.newValue || '—'}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="hint">
                  Aucune modification depuis le chargement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
