/**
 * Centralized Date-Aware Forecast Advisory Utility — Bangladesh Crop Outlook (EXP_38)
 *
 * Implements deterministic calendar-based date calculations in Asia/Dhaka timezone.
 * Reusable across Dashboard, District Explorer, Forecast Comparison, and District Detail Drawer.
 */

export type AdvisoryCase = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ForecastAdvisory {
  caseType: AdvisoryCase;
  message: string;
  badgeLabel: string;
  recheckDateStr: string;
  seasonStartDateStr: string;
  seasonEndDateStr: string;
  isPastRecheck: boolean;
  isSeasonStarted: boolean;
  isSeasonEnded: boolean;
  isCurrentSeason: boolean;
  planningOrder: number;
}

export interface AdvisoryParams {
  seasonName: string; // 'Rabi' | 'Kharif-I' | 'Kharif-II'
  targetYearStart: number; // e.g. 2026, 2027
  planningOrder?: number; // 1, 2, or 3
  referenceDate?: Date | string; // Optional simulated date for deterministic testing
  isSupported?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Static deterministic date for SSR and prerender phases (Nov 3, 2026 Asia/Dhaka)
// Prevents Next.js Turbopack blocking route errors on new Date() in Client Components during prerender
const STATIC_PRERENDER_DHAKA_DATE = new Date(2026, 10, 3);

/**
 * Returns a Date object representing the current date in Asia/Dhaka timezone.
 * If a reference date is provided, parses it deterministically without UTC timezone offset errors.
 */
export function getDhakaDate(ref?: Date | string): Date {
  if (ref) {
    if (typeof ref === 'string') {
      const parts = ref.split(/[-T]/);
      if (parts.length >= 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      return new Date(ref);
    }
    return ref;
  }

  // When evaluated during Next.js server-side prerender, return the stable static date
  // to avoid Next.js "unstable value new Date() in a Client Component" error.
  if (typeof window === 'undefined') {
    return STATIC_PRERENDER_DHAKA_DATE;
  }

  try {
    // Current date in Asia/Dhaka (evaluated in the browser client)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(new Date());
    const y = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
    const m = parseInt(parts.find((p) => p.type === 'month')?.value || '11', 10) - 1;
    const d = parseInt(parts.find((p) => p.type === 'day')?.value || '3', 10);
    return new Date(y, m, d);
  } catch {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

/**
 * Evaluates the date-aware forecast advisory for any planning season and target year.
 */
export function getForecastAdvisory({
  seasonName,
  targetYearStart,
  planningOrder = 1,
  referenceDate,
  isSupported = true,
}: AdvisoryParams): ForecastAdvisory {
  const today = getDhakaDate(referenceDate);

  // Fallback for unsupported releases or expired future years
  if (!isSupported || targetYearStart < 2026 || targetYearStart > 2027) {
    return {
      caseType: 'E',
      message: 'An updated forecast is needed for this season.',
      badgeLabel: 'Update needed',
      recheckDateStr: '',
      seasonStartDateStr: '',
      seasonEndDateStr: '',
      isPastRecheck: true,
      isSeasonStarted: false,
      isSeasonEnded: true,
      isCurrentSeason: false,
      planningOrder,
    };
  }

  // Exact Season Calendar Dates (EXP_36 research specification):
  // Kharif-I: Mar 15 – Jul 15
  // Kharif-II: Jul 15 – Oct 15
  // Rabi: Oct 15 – Mar 15 (following year)
  let sStart: Date;
  let sEnd: Date;

  if (seasonName === 'Kharif-I') {
    sStart = new Date(targetYearStart, 2, 15); // March 15
    sEnd = new Date(targetYearStart, 6, 15); // July 15
  } else if (seasonName === 'Kharif-II') {
    sStart = new Date(targetYearStart, 6, 15); // July 15
    sEnd = new Date(targetYearStart, 9, 15); // October 15
  } else {
    // Rabi
    sStart = new Date(targetYearStart, 9, 15); // October 15
    sEnd = new Date(targetYearStart + 1, 2, 15); // March 15 (next year)
  }

  // Recommended pre-season recheck date: season start minus 14 calendar days
  // March 15 - 14 days = March 1
  // July 15 - 14 days = July 1
  // October 15 - 14 days = October 1
  const recheckDate = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate() - 14);

  const recheckDateStr = `${MONTH_NAMES[recheckDate.getMonth()]} ${recheckDate.getDate()}, ${recheckDate.getFullYear()}`;
  const seasonStartDateStr = `${MONTH_NAMES[sStart.getMonth()]} ${sStart.getDate()}, ${sStart.getFullYear()}`;
  const seasonEndDateStr = `${MONTH_NAMES[sEnd.getMonth()]} ${sEnd.getDate()}, ${sEnd.getFullYear()}`;

  // Time comparison at midnight
  const todayTime = today.getTime();
  const startTime = sStart.getTime();
  const endTime = sEnd.getTime();
  const recheckTime = recheckDate.getTime();

  const isSeasonStarted = todayTime >= startTime;
  const isSeasonEnded = todayTime >= endTime;
  const isPastRecheck = todayTime >= recheckTime;
  const isCurrentSeason = isSeasonStarted && !isSeasonEnded;

  // ── CASE E: Season has already ended
  if (isSeasonEnded) {
    return {
      caseType: 'E',
      message: 'An updated forecast is needed for this season.',
      badgeLabel: 'Season concluded',
      recheckDateStr,
      seasonStartDateStr,
      seasonEndDateStr,
      isPastRecheck: true,
      isSeasonStarted: true,
      isSeasonEnded: true,
      isCurrentSeason: false,
      planningOrder,
    };
  }

  // ── CASE A: Current growing season has started
  if (isSeasonStarted) {
    return {
      caseType: 'A',
      message: 'This growing season has started. Check for the latest forecast update when new information becomes available.',
      badgeLabel: 'Season in progress',
      recheckDateStr,
      seasonStartDateStr,
      seasonEndDateStr,
      isPastRecheck: true,
      isSeasonStarted: true,
      isSeasonEnded: false,
      isCurrentSeason: true,
      planningOrder,
    };
  }

  // ── CASE D: Recheck date has passed, but season has not started yet
  if (isPastRecheck && !isSeasonStarted) {
    return {
      caseType: 'D',
      message: 'The suggested review date has passed. Check whether a newer forecast is available before planning.',
      badgeLabel: 'Review suggested',
      recheckDateStr,
      seasonStartDateStr,
      seasonEndDateStr,
      isPastRecheck: true,
      isSeasonStarted: false,
      isSeasonEnded: false,
      isCurrentSeason: false,
      planningOrder,
    };
  }

  // ── CASE C: Third planning season (advance forecast)
  if (planningOrder === 3) {
    return {
      caseType: 'C',
      message: `Advance forecast — check again on ${recheckDateStr} as the growing season approaches.`,
      badgeLabel: `Check on ${recheckDateStr}`,
      recheckDateStr,
      seasonStartDateStr,
      seasonEndDateStr,
      isPastRecheck: false,
      isSeasonStarted: false,
      isSeasonEnded: false,
      isCurrentSeason: false,
      planningOrder,
    };
  }

  // ── CASE B: Upcoming season, recheck date is in the future
  return {
    caseType: 'B',
    message: `Early forecast — check again on ${recheckDateStr} for the latest available estimate.`,
    badgeLabel: `Check on ${recheckDateStr}`,
    recheckDateStr,
    seasonStartDateStr,
    seasonEndDateStr,
    isPastRecheck: false,
    isSeasonStarted: false,
    isSeasonEnded: false,
    isCurrentSeason: false,
    planningOrder,
  };
}

/**
 * Convenient helper accepting a SeasonItem-compatible object.
 */
export function getSeasonItemAdvisory(
  season: { season: string; target_year_start: number; planning_order?: number; window_start?: string },
  referenceDate?: Date | string
): ForecastAdvisory {
  const targetYearStart = season.target_year_start ||
    (season.window_start ? parseInt(season.window_start.split('-')[0], 10) : 2026);
  return getForecastAdvisory({
    seasonName: season.season,
    targetYearStart,
    planningOrder: season.planning_order,
    referenceDate,
  });
}

