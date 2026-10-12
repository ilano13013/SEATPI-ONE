import type { AgentStatus } from '../types';

/** Couleurs partagées entre la scène 3D, la légende et les panneaux. */
export const statusColors: Record<AgentStatus, string> = {
  Disponible: '#22a06b',
  'En appel': '#2f6fe4',
  'Post-appel': '#8b5cf6',
  Pause: '#f59e0b',
  Repas: '#ea580c',
  Formation: '#0ea5a4',
  'Hors ligne': '#94a3b8',
};

export const allStatuses = Object.keys(statusColors) as AgentStatus[];
