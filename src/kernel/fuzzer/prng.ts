// Deterministic Pseudo-Random Number Generator

/**
 * Generates a 32-bit hash from a string to use as a PRNG seed.
 * Implements a simple FNV-1a hash algorithm.
 */
function hash_string_to_seed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A seeded PRNG using the Mulberry32 algorithm.
 * Provides completely deterministic, reproducible pseudo-random numbers.
 */
export class DeterministicPRNG {
  private state: number;

  constructor(seed_phrase: string) {
    this.state = hash_string_to_seed(seed_phrase);
  }

  /**
   * Returns a float between 0 (inclusive) and 1 (exclusive).
   */
  public next_float(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns an integer between min (inclusive) and max (exclusive).
   */
  public next_int(min: number, max: number): number {
    return Math.floor(this.next_float() * (max - min) + min);
  }

  /**
   * Randomly shuffles an array in place using the deterministic sequence.
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.next_int(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Returns true with the given probability (0.0 to 1.0).
   */
  public chance(probability: number): boolean {
    return this.next_float() < probability;
  }
}
