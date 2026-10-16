/**
 * Season calculation module — Bangladesh Crop Outlook
 * Implements the 70% elapsed-season rollover rule.
 */

export type SeasonName = 'Rabi' | 'Kharif-I' | 'Kharif-II';

export interface Season {
  name: SeasonName;
  /** Calendar year the season *starts* in */
  startYear: number;
  /** Calendar year the season *ends* in */
  endYear: number;
  /** Inclusive start date (month 1-indexed, day) */
  startMonth: number;
  startDay: number;
  /** Inclusive end date */
  endMonth: number;
  endDay: number;
  /** Human-readable label e.g. "Rabi 2024–25" */
  label: string;
  /** Short label e.g. "Oct – Mar" */
  monthRange: string;
}

/** Season definitions by start-month within the same calendar year */
const SEASON_DEFS: {
  name: SeasonName;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  crossYear: boolean; // does the season end in the *next* calendar year?
}[] = [
  // Rabi: Oct 15 – Mar 14 (next year)
  { name: 'Rabi', startMonth: 10, startDay: 15, endMonth: 3, endDay: 14, crossYear: true },
  // Kharif-I: Mar 15 – Jul 14 (same year)
  { name: 'Kharif-I', startMonth: 3, startDay: 15, endMonth: 7, endDay: 14, crossYear: false },
  // Kharif-II: Jul 15 – Oct 14 (same year)
  { name: 'Kharif-II', startMonth: 7, startDay: 15, endMonth: 10, endDay: 14, crossYear: false },
];

/** Duration of a season in total days (approximate, used for percentage calc) */
function seasonDurationDays(def: (typeof SEASON_DEFS)[0], startYear: number): number {
  const start = new Date(startYear, def.startMonth - 1, def.startDay);
  const endYear = def.crossYear ? startYear + 1 : startYear;
  const end = new Date(endYear, def.endMonth - 1, def.endDay);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Days elapsed since start of season (negative if before start) */
function daysElapsed(def: (typeof SEASON_DEFS)[0], startYear: number, now: Date): number {
  const start = new Date(startYear, def.startMonth - 1, def.startDay);
  return Math.round((now.getTime() - start.getTime()) / 86_400_000);
}

/** Build a Season object from a def + start year */
function buildSeason(def: (typeof SEASON_DEFS)[0], startYear: number): Season {
  const endYear = def.crossYear ? startYear + 1 : startYear;
  const startMonthName = new Date(startYear, def.startMonth - 1, 1).toLocaleString('en-US', {
    month: 'short',
  });
  const endMonthName = new Date(endYear, def.endMonth - 1, 1).toLocaleString('en-US', {
    month: 'short',
  });

  let label: string;
  if (def.crossYear) {
    label = `${def.name} ${startYear}–${String(endYear).slice(-2)}`;
  } else {
    label = `${def.name} ${startYear}`;
  }

  return {
    name: def.name,
    startYear,
    endYear,
    startMonth: def.startMonth,
    startDay: def.startDay,
    endMonth: def.endMonth,
    endDay: def.endDay,
    label,
    monthRange: `${startMonthName} – ${endMonthName}`,
  };
}

/**
 * Determine which season a given date falls within.
 * Returns { season, elapsed, duration, pct } or null if date is exactly between seasons
 * (which shouldn't happen given the contiguous design).
 */
export function getSeasonForDate(now: Date): {
  season: Season;
  elapsedDays: number;
  totalDays: number;
  pct: number;
} | null {
  const year = now.getFullYear();

  // Check all three seasons for both this year and previous year as origin
  const candidates = [year - 1, year].flatMap((y) =>
    SEASON_DEFS.map((def) => ({ def, startYear: y }))
  );

  for (const { def, startYear } of candidates) {
    const endYear = def.crossYear ? startYear + 1 : startYear;
    const start = new Date(startYear, def.startMonth - 1, def.startDay);
    const end = new Date(endYear, def.endMonth - 1, def.endDay, 23, 59, 59);
    if (now >= start && now <= end) {
      const total = seasonDurationDays(def, startYear);
      const elapsed = daysElapsed(def, startYear, now);
      return {
        season: buildSeason(def, startYear),
        elapsedDays: elapsed,
        totalDays: total,
        pct: elapsed / total,
      };
    }
  }
  return null;
}

/**
 * Advance by N seasons from a given season (returns next season in cycle).
 */
function nextSeason(s: Season, offset: number): Season {
  const defIndex = SEASON_DEFS.findIndex((d) => d.name === s.name);
  let idx = defIndex;
  let startYear = s.startYear;

  for (let i = 0; i < offset; i++) {
    idx += 1;
    if (idx >= SEASON_DEFS.length) {
      idx = 0;
      startYear += 1;
    }
  }

  return buildSeason(SEASON_DEFS[idx], startYear);
}

/**
 * Core planning-season resolver.
 *
 * Rule:
 * - Find the current season.
 * - If ≥ 70% of it has elapsed, the *planning season* is the NEXT season.
 * - Otherwise the planning season is the current season.
 * - Return the planning season + the two that follow it (3 total).
 */
export function getPlanningSeasons(now: Date = new Date()): {
  planningSeasons: [Season, Season, Season];
  currentSeason: Season | null;
  rolledOver: boolean;
} {
  const currentInfo = getSeasonForDate(now);

  let baseSeason: Season;
  let rolledOver = false;

  if (!currentInfo) {
    // Fallback: use Kharif-II of current year
    const fallbackDef = SEASON_DEFS.find((d) => d.name === 'Kharif-II')!;
    baseSeason = buildSeason(fallbackDef, now.getFullYear());
  } else if (currentInfo.pct >= 0.7) {
    baseSeason = nextSeason(currentInfo.season, 1);
    rolledOver = true;
  } else {
    baseSeason = currentInfo.season;
  }

  const s1 = baseSeason;
  const s2 = nextSeason(s1, 1);
  const s3 = nextSeason(s2, 1);

  return {
    planningSeasons: [s1, s2, s3],
    currentSeason: currentInfo?.season ?? null,
    rolledOver,
  };
}

/** All crops mapped to their valid seasons */
export const CROP_SEASON_MAP: Record<SeasonName, string[]> = {
  Rabi: ['Boro Rice', 'Potato', 'Wheat'],
  'Kharif-I': ['Aus Rice', 'Jute'],
  'Kharif-II': ['Aman Rice'],
};

/** All supported crops */
export const ALL_CROPS = ['Aman Rice', 'Aus Rice', 'Boro Rice', 'Potato', 'Wheat', 'Jute'] as const;
export type CropName = (typeof ALL_CROPS)[number];

/** Return crops valid for a given season */
export function getCropsForSeason(seasonName: SeasonName): CropName[] {
  return CROP_SEASON_MAP[seasonName] as CropName[];
}
