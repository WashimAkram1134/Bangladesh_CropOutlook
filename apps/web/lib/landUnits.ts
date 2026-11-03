/**
 * Bangladesh Land Measurement Units & Conversion Utilities
 *
 * Implements official Bangladesh government land measurement standards:
 * - Ministry of Land: Survey and Land Measurement Documentation (bhumipedia.land.gov.bd)
 * - Government Land Information Portals (Dinajpur & Narsingdi District Administrations)
 *
 * Standard Conversions (Full Numerical Precision):
 * - 1 Hectare = 10,000 m²
 * - 1 Acre = 0.40468564224 hectare (4046.8564224 m²)
 * - 1 Decimal / Shotok = 1/100 acre = 0.0040468564224 hectare
 * - 1 Square Foot = 0.09290304 m² = 0.000009290304 hectare
 * - 1 Standard Katha = 720 sq ft = 0.00668901888 hectare
 * - 1 Standard Bigha = 20 katha = 14,400 sq ft = 0.1337803776 hectare
 * - 1 Square Metre = 0.0001 hectare
 *
 * Note: Katha and Bigha can vary regionally across Bangladesh. The standard convention
 * of 720 sq ft per Katha and 20 Katha per Bigha (14,400 sq ft) is explicitly used here.
 */

export type LandUnitKey =
  | 'hectare'
  | 'acre'
  | 'decimal'
  | 'katha'
  | 'bigha'
  | 'sqft'
  | 'sqm';

export interface LandUnitDef {
  key: LandUnitKey;
  label: string; // Full label with Bengali script
  shortLabel: string;
  bengali: string;
  unitHectares: number; // Conversion factor to hectares with full precision
}

export const LAND_UNITS: LandUnitDef[] = [
  {
    key: 'hectare',
    label: 'Hectare (হেক্টর)',
    shortLabel: 'Hectare',
    bengali: 'হেক্টর',
    unitHectares: 1.0,
  },
  {
    key: 'acre',
    label: 'Acre (একর)',
    shortLabel: 'Acre',
    bengali: 'একর',
    unitHectares: 0.40468564224,
  },
  {
    key: 'decimal',
    label: 'Decimal / Shotok (শতক / শতাংশ)',
    shortLabel: 'Decimal',
    bengali: 'শতক',
    unitHectares: 0.0040468564224, // 1/100 acre
  },
  {
    key: 'katha',
    label: 'Katha (কাঠা)',
    shortLabel: 'Katha',
    bengali: 'কাঠা',
    unitHectares: 0.00668901888, // 720 sq ft
  },
  {
    key: 'bigha',
    label: 'Bigha (বিঘা)',
    shortLabel: 'Bigha',
    bengali: 'বিঘা',
    unitHectares: 0.1337803776, // 20 katha = 14,400 sq ft
  },
  {
    key: 'sqft',
    label: 'Square Feet (বর্গফুট)',
    shortLabel: 'Sq Feet',
    bengali: 'বর্গফুট',
    unitHectares: 0.000009290304, // 0.09290304 m²
  },
  {
    key: 'sqm',
    label: 'Square Metre (বর্গমিটার)',
    shortLabel: 'Sq Metre',
    bengali: 'বর্গমিটার',
    unitHectares: 0.0001, // 1 m²
  },
];

export const LAND_UNITS_MAP: Record<LandUnitKey, LandUnitDef> = LAND_UNITS.reduce(
  (acc, unit) => {
    acc[unit.key] = unit;
    return acc;
  },
  {} as Record<LandUnitKey, LandUnitDef>
);

/**
 * Converts any user-entered land area in a given unit to canonical hectares.
 */
export function convertToHectares(amount: number, unit: LandUnitKey): number {
  if (isNaN(amount) || amount <= 0) return 0;
  const def = LAND_UNITS_MAP[unit];
  if (!def) return amount;
  return amount * def.unitHectares;
}

/**
 * Converts canonical hectares into a target land unit.
 */
export function convertFromHectares(hectares: number, unit: LandUnitKey): number {
  if (isNaN(hectares) || hectares <= 0) return 0;
  const def = LAND_UNITS_MAP[unit];
  if (!def || def.unitHectares === 0) return hectares;
  return hectares / def.unitHectares;
}

/**
 * Converts directly between two land measurement units.
 */
export function convertBetweenUnits(
  amount: number,
  fromUnit: LandUnitKey,
  toUnit: LandUnitKey
): number {
  if (fromUnit === toUnit) return amount;
  const ha = convertToHectares(amount, fromUnit);
  return convertFromHectares(ha, toUnit);
}

/**
 * Formats a converted quantity for clean UI display in an input field.
 * Avoids trailing zeros while preserving high precision when needed.
 */
export function formatUnitValue(val: number): string {
  if (isNaN(val) || !isFinite(val) || val <= 0) return '';
  // Near-integer check (within 1e-5)
  if (Math.abs(val - Math.round(val)) < 1e-5) {
    return Math.round(val).toString();
  }
  // Up to 5 decimal places, trimming trailing zeros
  const rounded = Number(val.toFixed(5));
  return rounded.toString();
}

/**
 * Calculates estimated production in tonnes given predicted yield (t/ha) and input area.
 * The predicted yield (tonnes/ha) remains strictly invariant.
 */
export function calculateEstimatedProduction(
  predictedYieldTPerHa: number,
  areaInUnit: number,
  unit: LandUnitKey
): number | null {
  if (isNaN(areaInUnit) || areaInUnit <= 0 || isNaN(predictedYieldTPerHa) || predictedYieldTPerHa <= 0) {
    return null;
  }
  const areaHa = convertToHectares(areaInUnit, unit);
  return Number((predictedYieldTPerHa * areaHa).toFixed(2));
}
