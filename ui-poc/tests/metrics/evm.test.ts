import { describe, it, expect } from 'vitest';
import { calculateEvm, buildBurndownSeries } from '../../../shared/metrics/evm';

describe('calculateEvm', () => {
  it('computes CPI/SPI and variances', () => {
    const result = calculateEvm({ plannedValue: 100, earnedValue: 90, actualCost: 110 });
    expect(result).toEqual({
      plannedValue: 100,
      earnedValue: 90,
      actualCost: 110,
      costVariance: -20,
      scheduleVariance: -10,
      cpi: 0.82,
      spi: 0.9,
    });
  });

  it('handles zero denominators safely', () => {
    const result = calculateEvm({ plannedValue: 0, earnedValue: 50, actualCost: 0 });
    expect(result.cpi).toBe(0);
    expect(result.spi).toBe(0);
  });
});

describe('buildBurndownSeries', () => {
  it('maps points into chart arrays', () => {
    const series = buildBurndownSeries([
      { label: 'Day 1', planned: 100, actual: 110 },
      { label: 'Day 2', planned: 80, actual: 90 },
    ]);
    expect(series.labels).toEqual(['Day 1', 'Day 2']);
    expect(series.planned).toEqual([100, 80]);
    expect(series.actual).toEqual([110, 90]);
  });
});
