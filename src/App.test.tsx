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
    expect(document.querySelectorAll('.twod-grid button')).toHaveLength(7);
  });

  it('ouvre le bon panneau au clic sur une pièce', () => {
    render(<App />);
    openRoom('Salle de pause');
    expect(panel().getByRole('heading', { name: 'Salle de pause' })).toBeTruthy();
    expect(panel().getByText('Agent A04')).toBeTruthy();
    openRoom('Parc automobile');
    expect(panel().getByRole('heading', { name: 'Parc automobile' })).toBeTruthy();
  });

  it('filtre les files du plateau Helpdesk par client', () => {
    render(<App />);
    expect(panel().getAllByRole('button', { name: /Support N1|Facturation|Assistance|Support N2|Hotline/ })).toHaveLength(7);
    fireEvent.change(panel().getByLabelText('Client'), { target: { value: 'dmb' } });
    const rows = panel().getAllByRole('button', { name: /DMB ·/ });
    expect(rows).toHaveLength(2);
    expect(panel().queryByText(/HSTV ·/)).toBeNull();
    fireEvent.click(rows[0]);
    expect(panel().getByText('Objectif SLA')).toBeTruthy();
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
});
