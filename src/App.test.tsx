import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';

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
const openRoom = (label: string) => fireEvent.click(within(document.querySelector('.twod')!).getByRole('button', { name: new RegExp(label) }));

describe('App (mode démo)', () => {
  it('affiche la mention mode démo et bascule en 2D sans WebGL', () => {
    render(<App />);
    expect(screen.getByText('MODE DÉMO')).toBeTruthy();
    expect(screen.getByText(/WebGL n'est pas disponible/)).toBeTruthy();
    // 7 pièces, 2 services internes (Exploitation, CSM) et 3 sites clients externes
    expect(document.querySelectorAll('.twod-grid:not(.poles) button')).toHaveLength(12);
    expect(document.querySelectorAll('.twod-grid.poles button')).toHaveLength(5);
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
    fireEvent.click(within(document.querySelector('.twod')!).getByRole('button', { name: /Pôle Sodiaal/ }));
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
    expect(panel().getAllByText(/INVIVO|PRIMAGAZ|MONEXT/).length).toBeGreaterThanOrEqual(3);
  });

  it('liste les déplacements des managers CSM dans la vue globale', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Rôle simulé'), { target: { value: 'responsable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clients externes' }));
    expect(screen.getByRole('heading', { name: 'Déplacements des managers CSM' })).toBeTruthy();
    expect(screen.getAllByText(/Siège SEATPI → Siège (INVIVO|PRIMAGAZ|MONEXT)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/En route|Chez le client|Retour/).length).toBeGreaterThan(0);
  });
});
