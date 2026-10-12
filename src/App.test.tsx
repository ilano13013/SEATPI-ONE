import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import { helpdeskPoles, rooms } from './data/layout';

// jsdom ne fournit pas WebGL : on vérifie le parcours via le mode 2D accessible.
vi.mock('./lib/env', () => ({ hasWebGL: () => false, prefersReducedMotion: () => true, isNarrowScreen: () => false }));

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const panel = () => within(screen.getByRole('complementary', { name: /./ }));
// Les espaces sont regroupés par site en 2D : on cible La Ciotat (site principal) par défaut.
const openRoom = (label: string, site = 'La Ciotat') =>
  fireEvent.click(within(screen.getByRole('region', { name: site })).getAllByRole('button', { name: new RegExp(label) })[0]);

describe('App (mode démo)', () => {
  it('affiche la mention mode démo et bascule en 2D sans WebGL', () => {
    render(<App />);
    expect(screen.getByText('MODE DÉMO')).toBeTruthy();
    expect(screen.getByText(/WebGL n'est pas disponible/)).toBeTruthy();
    // Tous les espaces des trois sites et des sites clients externes (hors carte d'ensemble).
    expect(document.querySelectorAll('.twod-grid:not(.poles) button')).toHaveLength(rooms.filter((r) => r.floor !== 'carte').length);
    expect(screen.getByRole('region', { name: 'Montpellier' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Paris' })).toBeTruthy();
    expect(document.querySelectorAll('.twod-grid.poles button')).toHaveLength(helpdeskPoles.length);
  });

  it('ouvre le bon panneau au clic sur une pièce', () => {
    render(<App />);
    openRoom('Salle de pause');
    expect(panel().getByRole('heading', { name: 'Salle de pause' })).toBeTruthy();
    expect(panel().getByText('Agent A04')).toBeTruthy();
    openRoom('Parc automobile');
    expect(panel().getByRole('heading', { name: 'Parc automobile' })).toBeTruthy();
  });

  it('filtre les files du plateau Helpdesk par pôle client', () => {
    render(<App />);
    expect(panel().getAllByRole('button', { name: /^(Thelem|IRD|Ortec|Multi dédié|Sodiaal) ·/ })).toHaveLength(7);
    fireEvent.change(panel().getByLabelText('Pôle client'), { target: { value: 'ortec' } });
    const rows = panel().getAllByRole('button', { name: /^Ortec ·/ });
    expect(rows).toHaveLength(2);
    expect(panel().queryByText(/^Thelem ·/)).toBeNull();
    fireEvent.click(rows[0]);
    expect(panel().getByText('Objectif SLA')).toBeTruthy();
  });

  it('ouvre un pôle client depuis le plateau', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('region', { name: 'La Ciotat' })).getByRole('button', { name: /Pôle Sodiaal/ }));
    expect(panel().getByRole('heading', { name: 'Plateau Helpdesk' })).toBeTruthy();
    expect((panel().getByLabelText('Pôle client') as HTMLSelectElement).value).toBe('sodiaal');
    expect(panel().getAllByRole('button', { name: /^Sodiaal ·/ })).toHaveLength(1);
    expect(panel().getByText('Agents connectés')).toBeTruthy();
    // Revenir au plateau entier
    fireEvent.change(panel().getByLabelText('Pôle client'), { target: { value: 'all' } });
    expect(panel().getAllByRole('button', { name: /^(Thelem|IRD|Ortec|Multi dédié|Sodiaal) ·/ })).toHaveLength(7);
  });

  it('adapte les vues au rôle simulé', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'direction' } });
    fireEvent.click(panel().getByRole('tab', { name: /Agents/ }));
    expect(panel().getByText(/Vue agrégée/)).toBeTruthy();
    expect(panel().queryByText('Agent A01')).toBeNull();

    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'rh' } });
    expect(panel().getByText('Accès restreint')).toBeTruthy();
  });

  it("n'effectue aucun appel réseau", () => {
    render(<App />);
    openRoom('Stock informatique');
    openRoom('Direction');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ouvre le cockpit des clients externes et navigue jusqu’aux tickets', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    const cockpit = within(screen.getByRole('region', { name: 'Supervision des clients externes' }));
    // Vue consolidée : les trois clients et la ligne interne.
    for (const name of ['INVIVO', 'PRIMAGAZ', 'MONEXT', 'Plateau Helpdesk (interne)', 'Total clients externes']) {
      expect(cockpit.getAllByText(name).length).toBeGreaterThan(0);
    }
    fireEvent.click(within(cockpit.getByRole('navigation', { name: 'Clients' })).getByRole('button', { name: /MONEXT/ }));
    const open = cockpit.getByRole('button', { name: /Tickets ouverts/ });
    const count = Number(open.querySelector('strong')!.textContent);
    fireEvent.click(open);
    expect(cockpit.getByRole('tab', { name: 'Tickets', selected: true })).toBeTruthy();
    expect(cockpit.getByText(new RegExp(`^${count} ticket\\(s\\)`))).toBeTruthy();
    // Détail d'un ticket depuis le tableau.
    fireEvent.click(document.querySelector('.xc-table tbody tr')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Historique des changements')).toBeTruthy();
  });

  it('masque la supervision externe au rôle Agent', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'agent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    expect(screen.getByText('Accès restreint')).toBeTruthy();
  });

  it('présente les services internes Exploitation et CSM', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    openRoom('Service Exploitation');
    expect(panel().getByRole('heading', { name: 'Service Exploitation' })).toBeTruthy();
    expect(panel().getByRole('heading', { name: 'Escalades en cours' })).toBeTruthy();
    openRoom('Service CSM');
    expect(panel().getByRole('heading', { name: 'Service CSM' })).toBeTruthy();
    // Chaque site affiche le compte suivi par son CSM.
    expect(panel().getAllByText('INVIVO').length).toBeGreaterThan(0);
    openRoom('Service CSM', 'Montpellier');
    expect(panel().getAllByText('PRIMAGAZ').length).toBeGreaterThan(0);
  });

  it('liste les déplacements des managers CSM dans la vue globale', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    expect(screen.getByRole('heading', { name: 'Déplacements des managers CSM' })).toBeTruthy();
    expect(screen.getAllByText(/SEATPI (La Ciotat|Montpellier|Paris) → Siège (INVIVO|PRIMAGAZ|MONEXT)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/En route|Chez le client|Retour/).length).toBeGreaterThan(0);
  });

  it('ouvre les espaces des sites de Montpellier et Paris avec leurs propres données', () => {
    render(<App />);
    openRoom('Plateau Helpdesk', 'Montpellier');
    expect(panel().getByText('Montpellier')).toBeTruthy();
    expect(panel().getAllByRole('button', { name: /^(LBR FR|Eurapharma) ·/ })).toHaveLength(2);
    expect(panel().queryByText(/^Thelem ·/)).toBeNull();
    openRoom('Commercial', 'Paris');
    expect(panel().getByRole('heading', { name: 'Commercial' })).toBeTruthy();
    expect(panel().getByText('Paris')).toBeTruthy();
    // Pas de RH ni de Stock hors de La Ciotat.
    expect(within(screen.getByRole('region', { name: 'Paris' })).queryByRole('button', { name: /Ressources humaines|Stock/ })).toBeNull();
  });

  it('affiche la cartographie ITSM unique et signale PRIMAGAZ comme non renseigné', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connecteurs ITSM' }));
    const reg = within(screen.getByRole('region', { name: 'Connecteurs ITSM' }));
    expect(reg.getByText('INVIVO, DMB')).toBeTruthy();
    expect(reg.getByText('THELEM, TRANSGOURMET, MONEXT')).toBeTruthy();
    expect(reg.getAllByText('ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE').length).toBe(4); // PRIMAGAZ, IRD, ORTEC, SODIAAL
    // Cockpit PRIMAGAZ : aucun ticket inventé.
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    const cockpit = within(screen.getByRole('region', { name: 'Supervision des clients externes' }));
    fireEvent.click(within(cockpit.getByRole('navigation', { name: 'Clients' })).getByRole('button', { name: /PRIMAGAZ/ }));
    fireEvent.click(cockpit.getByRole('tab', { name: 'Tickets' }));
    expect(cockpit.getByText('ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE')).toBeTruthy();
  });

  it('cockpit Helpdesk consolidé : compteur cliquable, filtres partagés tableau / Kanban', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Cockpit Helpdesk consolidé' }));
    const hd = within(screen.getByRole('region', { name: 'Cockpit Helpdesk consolidé' }));
    const tile = hd.getByRole('button', { name: /Tickets ouverts/ });
    const count = Number(within(tile).getByText(/^\d+$/).textContent);
    expect(count).toBeGreaterThan(0);
    fireEvent.click(tile);
    expect(hd.getByText(new RegExp(`Tickets ouverts · ${count} ticket`))).toBeTruthy();
    fireEvent.change(hd.getByLabelText('Outil ITSM'), { target: { value: 'GLPI' } });
    const rows = hd.getAllByRole('row').slice(1);
    expect(rows.every((r) => /GLPI/.test(r.textContent ?? '') || /Aucun ticket/.test(r.textContent ?? ''))).toBe(true);
    const tableCount = hd.getByRole('tab', { name: /Tableau/ }).textContent;
    expect(hd.getByRole('tab', { name: /Kanban/ }).textContent?.replace('Kanban', '')).toBe(tableCount?.replace('Tableau', ''));
    // Création simulée sur un client sans ITSM : refusée.
    fireEvent.click(hd.getByRole('button', { name: /Nouveau ticket/ }));
    const dlg = within(screen.getByRole('dialog'));
    fireEvent.change(dlg.getByLabelText('Client'), { target: { value: 'primagaz' } });
    expect(dlg.getByText('ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE')).toBeTruthy();
    expect((dlg.getByRole('button', { name: /Créer dans/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('management : refus de congé avec commentaire obligatoire et historique', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Management : congés/ }));
    const mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: /Congés/ }));
    const before = mg.getAllByRole('button', { name: 'Refuser' }).length;
    fireEvent.click(mg.getAllByRole('button', { name: 'Refuser' })[0]);
    expect(screen.getByText(/commentaire est obligatoire/)).toBeTruthy();
    fireEvent.change(mg.getAllByPlaceholderText(/Commentaire/)[0], { target: { value: 'Charge trop forte' } });
    fireEvent.click(mg.getAllByRole('button', { name: 'Refuser' })[0]);
    expect(mg.queryAllByRole('button', { name: 'Refuser' }).length).toBe(before - 1);
    fireEvent.click(mg.getByRole('tab', { name: 'Historique' }));
    expect(mg.getAllByText(/Charge trop forte/).length).toBeGreaterThan(0);
  });

  it('management : CRA — compteurs et validation d’un CRA soumis', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Modules' })).getByRole('button', { name: /Management : congés/ }));
    const mg = within(screen.getByRole('region', { name: 'Cockpit Management' }));
    fireEvent.click(mg.getByRole('tab', { name: 'CRA' }));
    const validated = () => Number(within(mg.getByRole('button', { name: /^Validés/ })).getByText(/^\d+$/).textContent);
    const v0 = validated();
    fireEvent.click(mg.getByRole('button', { name: /^Soumis/ }));
    fireEvent.click(mg.getAllByRole('row')[1]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Valider' }));
    expect(validated()).toBe(v0 + 1);
  });
});
