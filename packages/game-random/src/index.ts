export interface RandomSnapshot {
  algorithm: 'xorshift32';
  state: number;
}

export interface RandomProvider {
  nextInt(minInclusive: number, maxInclusive: number): number;
}

export class SeededRandom implements RandomProvider {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  static fromSnapshot(snapshot: RandomSnapshot): SeededRandom {
    if (snapshot.algorithm !== 'xorshift32') {
      throw new Error(`Unsupported random algorithm: ${snapshot.algorithm}`);
    }
    const random = new SeededRandom(1);
    random.state = snapshot.state >>> 0 || 1;
    return random;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error('Random range must use integers.');
    }
    if (maxInclusive < minInclusive) {
      throw new Error('Random range is invalid.');
    }

    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;

    const normalized = (this.state >>> 0) / 0x1_0000_0000;
    return Math.floor(normalized * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  getSnapshot(): RandomSnapshot {
    return {
      algorithm: 'xorshift32',
      state: this.state >>> 0
    };
  }
}

export class SequenceRandom implements RandomProvider {
  private cursor = 0;

  constructor(private readonly values: readonly number[]) {
    if (values.length === 0) throw new Error('SequenceRandom requires at least one value.');
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    const value = this.values[this.cursor % this.values.length]!;
    this.cursor += 1;
    if (value < minInclusive || value > maxInclusive) {
      throw new Error(`Sequence value ${value} is outside ${minInclusive}..${maxInclusive}.`);
    }
    return value;
  }

}

export function pickOne<T>(items: readonly T[], random: RandomProvider): T {
  if (items.length === 0) throw new Error('Cannot pick from an empty list.');
  return items[random.nextInt(0, items.length - 1)]!;
}

export function pickUnique<T>(
  items: readonly T[],
  count: number,
  random: RandomProvider
): T[] {
  if (count < 0 || count > items.length) {
    throw new Error('Unique pick count is outside the source list size.');
  }

  const pool = [...items];
  const result: T[] = [];

  while (result.length < count) {
    const index = random.nextInt(0, pool.length - 1);
    result.push(pool.splice(index, 1)[0]!);
  }

  return result;
}
