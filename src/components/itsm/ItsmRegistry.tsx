import { ITSM_MAPPING, ITSM_NOT_SET, clientRegistry, connectorRegistry, itsmOf, type MappedTool } from '../../config/itsm';
import { adapters } from '../../external/itsm/adapters';
import { externalClients } from '../../external/config';
import type { ConnectorState } from '../../external/sync';
import { formatMinutesOuvrees } from '../../external/metrics';
import { fmtDateTime } from '../external/common';

const NR = <em className="nr">Non renseigné</em>;

/** Registre ITSM : cartographie de référence, clients et connecteurs. */
export function ItsmRegistry({ connectors }: { connectors: Record<string, ConnectorState> }) {
  return (
    <section className="xc module" aria-label="Connecteurs ITSM">
      <div className="xc-head">
        <div>
          <b>Connecteurs ITSM — registre et cartographie</b>
          <span>Configuration unique réutilisée dans toute l’application (src/config/itsm.ts)</span>
        </div>
      </div>
      <div className="notice">
        Aucune connexion réelle n’est établie. Les URL, instances et modes d’authentification restent « Non renseigné » tant qu’ils n’ont pas été fournis. Les secrets seront stockés côté serveur, jamais dans le navigateur ni dans GitHub Pages.
      </div>

      <h3>Cartographie de référence</h3>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>Outil ITSM</th>
              <th>Clients</th>
            </tr>
          </thead>
          <tbody>
            {(Object.entries(ITSM_MAPPING) as [MappedTool, string[]][]).map(([tool, clients]) => (
              <tr key={tool}>
                <td>
                  <b>{tool}</b>
                </td>
                <td>{clients.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Clients</h3>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Type</th>
              <th>Équipe de traitement</th>
              <th>Outil ITSM</th>
            </tr>
          </thead>
          <tbody>
            {clientRegistry.map((c) => {
              const tool = itsmOf(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td>{c.kind === 'externe' ? 'Site client externe' : 'Plateau interne'}</td>
                  <td>
                    {c.teamLabel}
                    {c.allocationToConfirm && <small>Rattachement de démonstration à confirmer</small>}
                  </td>
                  <td>{tool ? <span className="badge info">{tool}</span> : <span className="badge nr-badge">{ITSM_NOT_SET}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Registre des connecteurs</h3>
      <div className="connector-grid">
        {connectorRegistry.map((entry) => {
          const adapter = adapters[entry.tool];
          const client = clientRegistry.find((c) => c.id === entry.clientId);
          const external = externalClients.find((c) => c.id === entry.clientId);
          const demo = external ? connectors[external.id] : undefined;
          return (
            <article key={entry.id} className="connector-card">
              <header>
                <b>
                  {entry.tool} · {client?.name ?? entry.clientId}
                </b>
                <span className={`badge ${demo ? 'info' : 'muted'}`}>{demo ? 'Flux de démonstration simulé' : entry.status}</span>
              </header>
              <dl className="detail">
                <div>
                  <dt>Instance</dt>
                  <dd>{entry.instance ?? NR}</dd>
                </div>
                <div>
                  <dt>URL API</dt>
                  <dd>{entry.apiUrl ?? NR}</dd>
                </div>
                <div>
                  <dt>Authentification</dt>
                  <dd>{entry.authMode ?? NR}</dd>
                </div>
                <div>
                  <dt>Dernière synchronisation</dt>
                  <dd>{demo?.lastSuccessAt ? `${fmtDateTime(demo.lastSuccessAt)} (démo)` : 'Jamais'}</dd>
                </div>
                <div>
                  <dt>Lecture / écriture</dt>
                  <dd>
                    {entry.readPermission} / {entry.writePermission}
                  </dd>
                </div>
                <div>
                  <dt>Capacités (hypothèse)</dt>
                  <dd>{adapter.capabilities.mode}</dd>
                </div>
                <div>
                  <dt>Règles SLA</dt>
                  <dd>{external ? `${external.calendar.label} · P1 ${formatMinutesOuvrees(external.sla.P1.resolutionMin)} (démo)` : NR}</dd>
                </div>
              </dl>
              <details>
                <summary>Champs disponibles ({adapter.fields.length})</summary>
                <p className="hint">{adapter.fields.join(', ')}</p>
              </details>
              <details>
                <summary>Correspondance statuts et priorités</summary>
                <ul className="xc-mini">
                  {Object.entries(adapter.statusToRaw).map(([norm, raw]) => (
                    <li key={norm}>
                      <code>{raw}</code> → {norm}
                    </li>
                  ))}
                  {Object.entries(adapter.priorityToRaw).map(([norm, raw]) => (
                    <li key={norm}>
                      <code>{raw}</code> → {norm}
                    </li>
                  ))}
                </ul>
                <p className="hint">Vocabulaire par défaut de l’outil : à valider sur l’instance réelle du client.</p>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
