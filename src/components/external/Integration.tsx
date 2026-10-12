import type { ClientView } from '../../external/derive';
import type { SyncLogEntry } from '../../external/sync';
import { adapters, ALL_PRIORITIES, ALL_STATUSES } from '../../external/itsm/adapters';
import { DEMO_SYNC_SECONDS } from '../../external/useExternal';
import { formatMinutesOuvrees } from '../../external/metrics';
import { Detail } from '../ui';
import { ItsmMissing, fmtDateTime } from './common';
import { connectorRegistry } from '../../config/itsm';

interface Props {
  view: ClientView;
  writes: SyncLogEntry[];
  canSync: boolean;
  onSync: () => void;
}

const NR = <em className="nr">Non renseigné</em>;

export function Integration(props: Props) {
  if (!props.view.client.tool) return <ItsmMissing name={props.view.client.name} />;
  return <IntegrationDetail {...props} />;
}

function IntegrationDetail({ view, writes, canSync, onSync }: Props) {
  const { client, connector } = view;
  const adapter = adapters[client.tool!];
  const entry = connectorRegistry.find((c) => c.clientId === client.id);
  const transitions = adapter.capabilities.transitions;
  return (
    <div className="xc-integration">
      <div className="notice">
        Les connecteurs réels seront exécutés par le backend SEATPI ONE (OAuth / comptes de service, secrets stockés côté serveur). Aucun jeton n’est présent dans le navigateur ; ce prototype lit une source fictive et n’effectue aucun appel réseau.
      </div>
      <div className="xc-detail-grid">
        <section>
          <h4>Connecteur {client.tool}</h4>
          <Detail
            items={[
              ['Outil', `${adapter.tool} — ${adapter.description}`],
              ['Mode (démonstration)', adapter.capabilities.mode],
              ['Instance', entry?.instance ?? NR],
              ['URL API', entry?.apiUrl ?? NR],
              ['Mode d’authentification', entry?.authMode ?? NR],
              ['Statut au registre', `${entry?.status ?? 'Non connecté'} — flux de démonstration simulé`],
              ['Permission lecture / écriture', `${entry?.readPermission ?? 'À obtenir'} / ${entry?.writePermission ?? 'À obtenir'}`],
              ['État de connexion', <span key="s" className={`badge ${connector.status === 'connecté' ? 'ok' : connector.status === 'dégradé' ? 'warn' : 'bad'}`}>{connector.status}</span>],
              ['Dernière synchronisation réussie', fmtDateTime(connector.lastSuccessAt)],
              ['Dernière tentative', fmtDateTime(connector.lastAttemptAt)],
              ['Synchronisation planifiée', `toutes les ${connector.intervalMin} min (démo accélérée : ${DEMO_SYNC_SECONDS} s) · prochaine ${fmtDateTime(connector.nextSyncAt)}`],
              ['Enregistrements reçus', connector.lastStats?.received ?? '—'],
              ['Doublons écartés', connector.lastStats?.duplicates ?? '—'],
              ['Rejetés (correspondance)', connector.lastStats?.rejected ?? '—'],
              ['Créés / mis à jour', connector.lastStats ? `${connector.lastStats.created} / ${connector.lastStats.updated}` : '—'],
            ]}
          />
          <button className="action" disabled={!canSync} onClick={onSync} title={canSync ? undefined : 'Réservé à la responsable Helpdesk et à l’administrateur'}>
            Synchroniser maintenant
          </button>
          <h4>Journal</h4>
          <ol className="xc-log">
            {[...writes.filter((w) => w.message.includes(client.tool!)), ...connector.log].slice(0, 15).map((l, i) => (
              <li key={i} className={l.level}>
                <time>{fmtDateTime(l.at)}</time> {l.message}
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h4>Correspondance des statuts</h4>
          <table className="xc-table compact">
            <thead>
              <tr>
                <th>Valeur {client.tool}</th>
                <th>Statut normalisé</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(adapter.statusMap).map(([raw, s]) => (
                <tr key={raw}>
                  <td>
                    <code>{raw}</code>
                  </td>
                  <td>{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>Correspondance des priorités</h4>
          <table className="xc-table compact">
            <tbody>
              {Object.entries(adapter.priorityMap).map(([raw, p]) => (
                <tr key={raw}>
                  <td>
                    <code>{raw}</code>
                  </td>
                  <td>{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>Transitions autorisées par la source</h4>
          {typeof transitions === 'string' ? (
            <p className="hint">{transitions === 'libre' ? `Libres. ${adapter.capabilities.note}` : adapter.capabilities.note}</p>
          ) : (
            <ul className="xc-mini">
              {ALL_STATUSES.map((s) => (
                <li key={s}>
                  <b>{s}</b> → {(transitions[s] ?? []).join(', ') || 'aucune'}
                </li>
              ))}
            </ul>
          )}
          <h4>Calendrier et matrice SLA</h4>
          <p className="hint">
            {client.calendar.label} · décompte suspendu en : {client.slaPauseStatuses.join(', ')}, Résolu, Clôturé.
          </p>
          <table className="xc-table compact">
            <thead>
              <tr>
                <th>Priorité</th>
                <th>Prise en charge</th>
                <th>Résolution</th>
              </tr>
            </thead>
            <tbody>
              {ALL_PRIORITIES.map((p) => (
                <tr key={p}>
                  <td>{p}</td>
                  <td>{formatMinutesOuvrees(client.sla[p].takeChargeMin)}</td>
                  <td>{formatMinutesOuvrees(client.sla[p].resolutionMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <h4>Adaptateurs disponibles</h4>
      <div className="xc-adapters">
        {Object.values(adapters).map((a) => (
          <div key={a.tool} className={a.tool === client.tool ? 'active' : ''}>
            <b>{a.tool}</b>
            <small>{a.description}</small>
            <span className="badge muted">{a.capabilities.mode}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
