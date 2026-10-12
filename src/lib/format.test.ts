import { describe, expect, it } from 'vitest';
import { formatDuration, formatMinutes, slaTone } from './format';

describe('formatage', () => {
  it('formate les durées', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(372)).toBe('06:12');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatMinutes(95)).toBe('1 h 35');
  });

  it('qualifie le SLA par rapport à son objectif', () => {
    expect(slaTone(96, 95)).toBe('ok');
    expect(slaTone(93, 95)).toBe('warn');
    expect(slaTone(88, 95)).toBe('bad');
  });
});
