import type { Money } from './model';

export const MONEY_UNIT_LABEL = '10万元';

export function roundMoney(value: number): Money {
  return Math.round(value);
}

export function formatInternalMoney(value: Money): string {
  return `${value * 10}万元`;
}

export function getUpgradeCost(
  purchasePrice: Money,
  nextLevel: 1 | 2 | 3
): Money {
  const ratios: Record<1 | 2 | 3, number> = {
    1: 0.6,
    2: 0.8,
    3: 1
  };
  return roundMoney(purchasePrice * ratios[nextLevel]);
}

export function getRent(
  purchasePrice: Money,
  level: 0 | 1 | 2 | 3
): Money {
  const ratios: Record<0 | 1 | 2 | 3, number> = {
    0: 0.1,
    1: 0.3,
    2: 0.7,
    3: 1.5
  };
  return roundMoney(purchasePrice * ratios[level]);
}
