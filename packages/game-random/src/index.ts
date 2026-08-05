export interface RandomProvider {
  nextInt(minInclusive: number, maxInclusive: number): number;
}

export class SeededRandom implements RandomProvider {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    const normalized = (this.state >>> 0) / 0x1_0000_0000;
    return Math.floor(normalized * (maxInclusive - minInclusive + 1)) + minInclusive;
  }
}
