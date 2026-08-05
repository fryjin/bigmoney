import type { RandomProvider } from '@town-board/game-random';

export class FixedRandom implements RandomProvider {
  private index = 0;
  constructor(private readonly values: number[]) {}

  nextInt(minInclusive: number, maxInclusive: number): number {
    const value = this.values[this.index++] ?? minInclusive;
    if (value < minInclusive || value > maxInclusive) {
      throw new Error(`Fixed random value ${value} is outside ${minInclusive}...${maxInclusive}`);
    }
    return value;
  }
}
