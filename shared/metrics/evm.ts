export interface EvmInput {
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
}

export interface BurndownPoint {
  label: string;
  planned: number;
  actual: number;
}

export interface EvmResult extends EvmInput {
  costVariance: number;
  scheduleVariance: number;
  cpi: number;
  spi: number;
}

export function calculateEvm({ plannedValue, earnedValue, actualCost }: EvmInput): EvmResult {
  const rounded = (value: number) => Math.round(value * 100) / 100;
  const costVariance = earnedValue - actualCost;
  const scheduleVariance = earnedValue - plannedValue;
  const cpi = actualCost === 0 ? 0 : earnedValue / actualCost;
  const spi = plannedValue === 0 ? 0 : earnedValue / plannedValue;

  return {
    plannedValue: rounded(plannedValue),
    earnedValue: rounded(earnedValue),
    actualCost: rounded(actualCost),
    costVariance: rounded(costVariance),
    scheduleVariance: rounded(scheduleVariance),
    cpi: rounded(cpi),
    spi: rounded(spi),
  };
}

export function buildBurndownSeries(points: BurndownPoint[]) {
  return {
    labels: points.map((p) => p.label),
    planned: points.map((p) => p.planned),
    actual: points.map((p) => p.actual),
  };
}
