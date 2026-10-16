/**
 * Unit tests — Area and production calculation utilities
 */
import { describe, it, expect } from 'vitest';
import { calcProduction, formatNumber } from '../lib/utils';

describe('calcProduction', () => {
  it('multiplies yield × area correctly', () => {
    expect(calcProduction(3.5, 10000)).toBeCloseTo(35000, 2);
  });

  it('returns null when yield is null', () => {
    expect(calcProduction(null, 10000)).toBeNull();
  });

  it('returns null when area is null', () => {
    expect(calcProduction(3.5, null)).toBeNull();
  });

  it('returns null when area is zero (avoid silent replacement)', () => {
    expect(calcProduction(3.5, 0)).toBeNull();
  });

  it('returns null when both inputs are null', () => {
    expect(calcProduction(null, null)).toBeNull();
  });

  it('handles fractional yield correctly', () => {
    // 2.753 t/ha × 15000 ha = 41295 tonnes
    expect(calcProduction(2.753, 15000)).toBeCloseTo(41295, 1);
  });

  it('handles large production values without overflow', () => {
    // 5 t/ha × 500000 ha = 2,500,000 tonnes
    expect(calcProduction(5, 500_000)).toBe(2_500_000);
  });

  it('handles very small area (1 ha)', () => {
    expect(calcProduction(4.0, 1)).toBe(4.0);
  });
});

describe('formatNumber', () => {
  it('formats integers with thousands separator', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats with specified decimal places', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
  });

  it('rounds to specified decimals', () => {
    expect(formatNumber(3.567, 2)).toBe('3.57');
  });

  it('formats zero without decimals', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats zero with decimals', () => {
    expect(formatNumber(0, 3)).toBe('0.000');
  });
});
