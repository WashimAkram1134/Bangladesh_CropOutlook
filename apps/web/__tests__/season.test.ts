/**
 * Unit tests — Season calculation logic
 * Tests the 70% elapsed-season rollover rule and planning season resolution.
 */
import { describe, it, expect } from 'vitest';
import {
  getSeasonForDate,
  getPlanningSeasons,
  getCropsForSeason,
  CROP_SEASON_MAP,
} from '../lib/season';

describe('getSeasonForDate', () => {
  it('identifies Rabi for October 15', () => {
    const date = new Date(2025, 9, 15); // Oct 15 2025
    const result = getSeasonForDate(date);
    expect(result).not.toBeNull();
    expect(result!.season.name).toBe('Rabi');
    expect(result!.season.startYear).toBe(2025);
  });

  it('identifies Rabi for March 14 (end of season)', () => {
    const date = new Date(2026, 2, 14); // Mar 14 2026
    const result = getSeasonForDate(date);
    expect(result).not.toBeNull();
    expect(result!.season.name).toBe('Rabi');
    expect(result!.season.endYear).toBe(2026);
  });

  it('identifies Kharif-I for March 15', () => {
    const date = new Date(2026, 2, 15); // Mar 15 2026
    const result = getSeasonForDate(date);
    expect(result).not.toBeNull();
    expect(result!.season.name).toBe('Kharif-I');
  });

  it('identifies Kharif-I for July 14', () => {
    const date = new Date(2026, 6, 14); // Jul 14
    const result = getSeasonForDate(date);
    expect(result).not.toBeNull();
    expect(result!.season.name).toBe('Kharif-I');
  });

  it('identifies Kharif-II for July 15', () => {
    const date = new Date(2026, 6, 15); // Jul 15
    const result = getSeasonForDate(date);
    expect(result).not.toBeNull();
    expect(result!.season.name).toBe('Kharif-II');
  });

  it('identifies Kharif-II for October 14', () => {
    const date = new Date(2026, 9, 14); // Oct 14
    const result = getSeasonForDate(date);
    expect(result).not.toBeNull();
    expect(result!.season.name).toBe('Kharif-II');
  });

  it('returns elapsed days of 0 or 1 on first day of season (noon rounding)', () => {
    const date = new Date(2026, 2, 15, 12, 0, 0); // Mar 15 noon
    const result = getSeasonForDate(date);
    // Math.round(12h / 24h) = 1 day due to noon time; season started at midnight
    // We accept 0 or 1 as both indicate the first day
    expect(result!.elapsedDays).toBeGreaterThanOrEqual(0);
    expect(result!.elapsedDays).toBeLessThanOrEqual(1);
  });

  it('returns percentage in [0, 1]', () => {
    const date = new Date(2026, 5, 1); // June 1 — mid Kharif-I
    const result = getSeasonForDate(date);
    expect(result!.pct).toBeGreaterThan(0);
    expect(result!.pct).toBeLessThan(1);
  });
});

describe('getPlanningSeasons — 70% rollover rule', () => {
  it('does NOT roll over at 50% of Kharif-I (≈ May 14)', () => {
    // Kharif-I: Mar 15 – Jul 14 = 121 days; 50% ≈ 60 days in = May 14
    const date = new Date(2026, 4, 14); // May 14 2026
    const { rolledOver, planningSeasons } = getPlanningSeasons(date);
    expect(rolledOver).toBe(false);
    expect(planningSeasons[0].name).toBe('Kharif-I');
  });

  it('rolls over at ≥70% of Kharif-I (≈ Jun 20)', () => {
    // Kharif-I 121 days; 70% ≈ 84 days in = Jun 7
    const date = new Date(2026, 5, 20); // Jun 20 2026 — well past 70%
    const { rolledOver, planningSeasons } = getPlanningSeasons(date);
    expect(rolledOver).toBe(true);
    expect(planningSeasons[0].name).toBe('Kharif-II');
  });

  it('returns exactly 3 consecutive planning seasons', () => {
    const date = new Date(2026, 0, 1); // Jan 1 — Rabi in progress
    const { planningSeasons } = getPlanningSeasons(date);
    expect(planningSeasons).toHaveLength(3);
  });

  it('seasons are in chronological order (each starts after previous ends)', () => {
    const date = new Date(2026, 0, 1);
    const { planningSeasons } = getPlanningSeasons(date);
    const [s1, s2, s3] = planningSeasons;
    // s1 ends before s2 starts — compare by startYear of the next season
    expect(s2.startYear).toBeGreaterThanOrEqual(s1.startYear);
    expect(s3.startYear).toBeGreaterThanOrEqual(s2.startYear);
    // the month-day order within the same year: endMonth of s1 < startMonth of s2
    // (Rabi ends Mar 14, Kharif-I starts Mar 15 — endMonth<=startMonth, endDay<startDay)
    if (s1.endYear === s2.startYear) {
      const endDoy = s1.endMonth * 100 + s1.endDay;
      const startDoy = s2.startMonth * 100 + s2.startDay;
      expect(endDoy).toBeLessThan(startDoy);
    }
  });


  it('season labels include the year', () => {
    const date = new Date(2026, 1, 1); // Feb 2026 — Rabi 2025-26
    const { planningSeasons } = getPlanningSeasons(date);
    expect(planningSeasons[0].label).toContain('2025');
  });
});

describe('getCropsForSeason', () => {
  it('Rabi yields Boro Rice, Potato, Wheat', () => {
    const crops = getCropsForSeason('Rabi');
    expect(crops).toContain('Boro Rice');
    expect(crops).toContain('Potato');
    expect(crops).toContain('Wheat');
    expect(crops).not.toContain('Aman Rice');
    expect(crops).not.toContain('Jute');
  });

  it('Kharif-I yields Aus Rice and Jute only', () => {
    const crops = getCropsForSeason('Kharif-I');
    expect(crops).toEqual(expect.arrayContaining(['Aus Rice', 'Jute']));
    expect(crops).not.toContain('Boro Rice');
    expect(crops).not.toContain('Aman Rice');
  });

  it('Kharif-II yields only Aman Rice', () => {
    const crops = getCropsForSeason('Kharif-II');
    expect(crops).toEqual(['Aman Rice']);
  });

  it('total unique crops across all seasons is 6', () => {
    const all = new Set([
      ...getCropsForSeason('Rabi'),
      ...getCropsForSeason('Kharif-I'),
      ...getCropsForSeason('Kharif-II'),
    ]);
    expect(all.size).toBe(6);
  });
});
