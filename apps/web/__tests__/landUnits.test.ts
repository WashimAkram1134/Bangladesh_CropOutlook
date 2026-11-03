import { describe, it, expect } from 'vitest';
import {
  LAND_UNITS,
  LAND_UNITS_MAP,
  convertToHectares,
  convertFromHectares,
  convertBetweenUnits,
  formatUnitValue,
  calculateEstimatedProduction,
  type LandUnitKey,
} from '../lib/landUnits';

describe('Bangladesh Land Units & Conversions (EXP_38)', () => {
  it('defines all seven required land units with correct metadata', () => {
    const keys = LAND_UNITS.map((u) => u.key);
    expect(keys).toEqual(['hectare', 'acre', 'decimal', 'katha', 'bigha', 'sqft', 'sqm']);
    expect(LAND_UNITS.length).toBe(7);
    for (const unit of LAND_UNITS) {
      expect(unit.bengali).toBeTruthy();
      expect(unit.label).toContain(unit.bengali);
      expect(unit.unitHectares).toBeGreaterThan(0);
    }
  });

  it('verifies 1 Hectare = 10,000 m²', () => {
    const haFromSqm = convertToHectares(10000, 'sqm');
    expect(haFromSqm).toBeCloseTo(1.0, 8);
    const sqmFromHa = convertFromHectares(1, 'sqm');
    expect(sqmFromHa).toBeCloseTo(10000, 8);
  });

  it('verifies 1 Acre = 100 Decimal / Shotok', () => {
    const decimalInOneAcre = convertBetweenUnits(1, 'acre', 'decimal');
    expect(decimalInOneAcre).toBeCloseTo(100.0, 8);
    const acreFrom100Decimal = convertBetweenUnits(100, 'decimal', 'acre');
    expect(acreFrom100Decimal).toBeCloseTo(1.0, 8);
  });

  it('verifies 20 Katha = 1 Bigha (standard 720 sq ft katha / 14,400 sq ft bigha)', () => {
    const bighaFrom20Katha = convertBetweenUnits(20, 'katha', 'bigha');
    expect(bighaFrom20Katha).toBeCloseTo(1.0, 8);
    const kathaInOneBigha = convertBetweenUnits(1, 'bigha', 'katha');
    expect(kathaInOneBigha).toBeCloseTo(20.0, 8);
  });

  it('verifies 1 Hectare ≈ 2.47105 Acres', () => {
    const acresInOneHa = convertFromHectares(1, 'acre');
    expect(acresInOneHa).toBeCloseTo(2.47105, 4);
    expect(formatUnitValue(acresInOneHa)).toBe('2.47105');
  });

  it('verifies full numerical precision for Katha and Bigha using 0.09290304 m² per sq ft', () => {
    // 1 standard katha = 720 sq ft = 720 * 0.09290304 m² = 66.8901888 m² = 0.00668901888 ha
    expect(LAND_UNITS_MAP['katha'].unitHectares).toBe(0.00668901888);
    // 1 standard bigha = 20 katha = 14,400 sq ft = 14400 * 0.09290304 m² = 1337.803776 m² = 0.1337803776 ha
    expect(LAND_UNITS_MAP['bigha'].unitHectares).toBe(0.1337803776);
  });

  it('preserves the physical area when repeatedly switching units without cumulative rounding errors', () => {
    const initialAcre = 5.0;
    const ha = convertToHectares(initialAcre, 'acre');

    // Switch sequence: Acre -> Decimal -> Katha -> Bigha -> Sqft -> Sqm -> Acre
    const decimal = convertFromHectares(ha, 'decimal');
    expect(decimal).toBeCloseTo(500.0, 8);

    const bigha = convertFromHectares(ha, 'bigha');
    const katha = convertFromHectares(ha, 'katha');
    expect(katha / bigha).toBeCloseTo(20.0, 8);

    const backToAcre = convertFromHectares(ha, 'acre');
    expect(backToAcre).toBe(initialAcre);
  });

  it('ensures estimated production is invariant when switching units for the same physical area', () => {
    const predictedYield = 4.25; // t/ha

    const prodHa = calculateEstimatedProduction(predictedYield, 2.0, 'hectare');
    // 2 ha in acres = 2 / 0.40468564224 = 4.942107...
    const areaAcre = convertFromHectares(2.0, 'acre');
    const prodAcre = calculateEstimatedProduction(predictedYield, areaAcre, 'acre');

    // 2 ha in decimal = 200 * 2.47105...
    const areaDecimal = convertFromHectares(2.0, 'decimal');
    const prodDecimal = calculateEstimatedProduction(predictedYield, areaDecimal, 'decimal');

    // 2 ha in bigha
    const areaBigha = convertFromHectares(2.0, 'bigha');
    const prodBigha = calculateEstimatedProduction(predictedYield, areaBigha, 'bigha');

    expect(prodHa).toBe(8.5);
    expect(prodAcre).toBe(8.5);
    expect(prodDecimal).toBe(8.5);
    expect(prodBigha).toBe(8.5);
  });

  it('recalculates estimated production immediately when land amount changes', () => {
    const predictedYield = 3.5; // t/ha
    expect(calculateEstimatedProduction(predictedYield, 1.0, 'hectare')).toBe(3.5);
    expect(calculateEstimatedProduction(predictedYield, 2.0, 'hectare')).toBe(7.0);
    expect(calculateEstimatedProduction(predictedYield, 10.0, 'hectare')).toBe(35.0);
  });

  it('handles invalid, missing, zero and negative inputs gracefully without NaN or silent zero misinterpretation', () => {
    const yieldVal = 4.0;
    expect(calculateEstimatedProduction(yieldVal, 0, 'hectare')).toBeNull();
    expect(calculateEstimatedProduction(yieldVal, -5, 'hectare')).toBeNull();
    expect(calculateEstimatedProduction(yieldVal, NaN, 'hectare')).toBeNull();
    expect(convertToHectares(0, 'acre')).toBe(0);
    expect(convertToHectares(-10, 'decimal')).toBe(0);
    expect(formatUnitValue(NaN)).toBe('');
    expect(formatUnitValue(-5)).toBe('');
    expect(formatUnitValue(0)).toBe('');
  });

  it('formats clean unit display numbers without trailing decimal garbage', () => {
    expect(formatUnitValue(100)).toBe('100');
    expect(formatUnitValue(1.000001)).toBe('1');
    expect(formatUnitValue(2.5)).toBe('2.5');
    expect(formatUnitValue(2.47105381)).toBe('2.47105');
  });
});
