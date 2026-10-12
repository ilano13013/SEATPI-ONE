import type { DemoState } from '../../types';
import { can, type Role } from '../../auth/roles';
import { formatDuration } from '../../lib/format';
import { statusColors } from '../../lib/status';
import { BREAK_STATUSES } from '../../services/simulation';
import { Empty } from '../ui';

export function PausePanel({ state, role }: { state: DemoState; role: Role }) {
  const onBreak = state.agents.filter((a) => BREAK_STATUSES.includes(a.status)).sort((a, b) => b.statusSinceSec - a.statusSinceSec);
  const individual = can(role, 'pause', 'individual');
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <p className="hint">
        Les avatars de la salle de pause représentent un <b>état de travail</b> déclaré, pas une localisation physique. Aucun classement ni
        indicateur disciplinaire n'est produit.
      </p>
      <div className="kpis">
        {BREAK_STATUSES.map((s) => (
          <div key={s}>
            <small>{s}</small>
            <strong style={{ color: statusColors[s] }}>{onBreak.filter((a) => a.status === s).length}</strong>
          </div>
        ))}
      </div>
      {individual ? (
        <div className="list">
          {onBreak.length === 0 && <Empty>Aucun agent en pause actuellement.</Empty>}
          {onBreak.map((a) => (
            <div className="agent" key={a.id}>
              <span className="avatar" style={{ background: statusColors[a.status] }}>
                {a.name.slice(-3)}
              </span>
              <div>
                <b>{a.name}</b>
                <small>
                  {a.status} · {clientName(a.clientId)}
                </small>
              </div>
              <time>{formatDuration(a.statusSinceSec)}</time>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">Vue agrégée : le détail par agent est réservé aux Team Leaders et Responsables.</p>
      )}
    </>
  );
}
