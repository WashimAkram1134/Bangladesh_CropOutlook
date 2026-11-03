import { describe, it, expect } from 'vitest';
import { getForecastAdvisory, getDhakaDate } from '../lib/forecastAdvisory';

describe('Date-Aware Forecast Advisory Utility (EXP_38)', () => {
  it('1. September 20, 2026: Rabi 2026-27 is upcoming, recheck in future (Case B)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Rabi',
      targetYearStart: 2026,
      planningOrder: 1,
      referenceDate: '2026-09-20',
    });
    expect(adv.caseType).toBe('B');
    expect(adv.recheckDateStr).toBe('October 1, 2026');
    expect(adv.message).toBe('Early forecast — check again on October 1, 2026 for the latest available estimate.');
    expect(adv.isPastRecheck).toBe(false);
    expect(adv.isSeasonStarted).toBe(false);
  });

  it('2. October 1, 2026: Recheck date arrived, but Rabi has not started yet (Case D)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Rabi',
      targetYearStart: 2026,
      planningOrder: 1,
      referenceDate: '2026-10-01',
    });
    expect(adv.caseType).toBe('D');
    expect(adv.message).toBe('The suggested review date has passed. Check whether a newer forecast is available before planning.');
    expect(adv.isPastRecheck).toBe(true);
    expect(adv.isSeasonStarted).toBe(false);
  });

  it('3. October 16, 2026: Rabi growing season has started (Case A)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Rabi',
      targetYearStart: 2026,
      planningOrder: 1,
      referenceDate: '2026-10-16',
    });
    expect(adv.caseType).toBe('A');
    expect(adv.message).toBe('This growing season has started. Check for the latest forecast update when new information becomes available.');
    expect(adv.isSeasonStarted).toBe(true);
  });

  it('4. November 3, 2026 (Today): Rabi 2026-27 is in progress (Case A)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Rabi',
      targetYearStart: 2026,
      planningOrder: 1,
      referenceDate: '2026-11-03',
    });
    expect(adv.caseType).toBe('A');
    expect(adv.message).toBe('This growing season has started. Check for the latest forecast update when new information becomes available.');
    expect(adv.isSeasonStarted).toBe(true);
    // Never show October 1, 2026 as a future reminder!
    expect(adv.message).not.toContain('October 1, 2026');
  });

  it('5. November 3, 2026: Kharif-I 2027 is 2nd planning season (Case B)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Kharif-I',
      targetYearStart: 2027,
      planningOrder: 2,
      referenceDate: '2026-11-03',
    });
    expect(adv.caseType).toBe('B');
    expect(adv.recheckDateStr).toBe('March 1, 2027');
    expect(adv.message).toBe('Early forecast — check again on March 1, 2027 for the latest available estimate.');
  });

  it('6. November 3, 2026: Kharif-II 2027 is 3rd planning season (Case C)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Kharif-II',
      targetYearStart: 2027,
      planningOrder: 3,
      referenceDate: '2026-11-03',
    });
    expect(adv.caseType).toBe('C');
    expect(adv.recheckDateStr).toBe('July 1, 2027');
    expect(adv.message).toBe('Advance forecast — check again on July 1, 2027 as the growing season approaches.');
  });

  it('7. February 1, 2027: Kharif-I 2027 before recheck date (Case B)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Kharif-I',
      targetYearStart: 2027,
      planningOrder: 1,
      referenceDate: '2027-02-01',
    });
    expect(adv.caseType).toBe('B');
    expect(adv.recheckDateStr).toBe('March 1, 2027');
    expect(adv.message).toBe('Early forecast — check again on March 1, 2027 for the latest available estimate.');
  });

  it('8. March 1, 2027: Kharif-I 2027 recheck date reached, season starts Mar 15 (Case D)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Kharif-I',
      targetYearStart: 2027,
      planningOrder: 1,
      referenceDate: '2027-03-01',
    });
    expect(adv.caseType).toBe('D');
    expect(adv.message).toBe('The suggested review date has passed. Check whether a newer forecast is available before planning.');
  });

  it('9. March 16, 2027: Kharif-I 2027 season started (Case A)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Kharif-I',
      targetYearStart: 2027,
      planningOrder: 1,
      referenceDate: '2027-03-16',
    });
    expect(adv.caseType).toBe('A');
    expect(adv.message).toBe('This growing season has started. Check for the latest forecast update when new information becomes available.');
  });

  it('10. July 1, 2027: Kharif-II 2027 recheck reached, season starts Jul 15 (Case D)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Kharif-II',
      targetYearStart: 2027,
      planningOrder: 2,
      referenceDate: '2027-07-01',
    });
    expect(adv.caseType).toBe('D');
    expect(adv.message).toBe('The suggested review date has passed. Check whether a newer forecast is available before planning.');
  });

  it('11. July 16, 2027: Kharif-II 2027 season started (Case A)', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Kharif-II',
      targetYearStart: 2027,
      planningOrder: 2,
      referenceDate: '2027-07-16',
    });
    expect(adv.caseType).toBe('A');
    expect(adv.message).toBe('This growing season has started. Check for the latest forecast update when new information becomes available.');
  });

  it('12. Unsupported/expired season generates Case E', () => {
    const adv = getForecastAdvisory({
      seasonName: 'Rabi',
      targetYearStart: 2028,
      planningOrder: 1,
      referenceDate: '2028-11-01',
    });
    expect(adv.caseType).toBe('E');
    expect(adv.message).toBe('An updated forecast is needed for this season.');
  });
});
