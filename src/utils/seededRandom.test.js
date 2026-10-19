import { describe, expect, it } from 'vitest';
import { newSeed, seededRandom, shuffleWith } from './seededRandom';

describe('reproducible randomization for field layouts', () => {
  it('gives the same sequence for the same seed and a different one otherwise', () => {
    const a = seededRandom(482913);
    const b = seededRandom(482913);
    const c = seededRandom(482914);
    const first = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(first);
    expect(Array.from({ length: 5 }, () => c())).not.toEqual(first);
    first.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  it('shuffles reproducibly without losing or changing the input', () => {
    const plots = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    const once = shuffleWith(seededRandom(7), plots);
    expect(shuffleWith(seededRandom(7), plots)).toEqual(once);
    expect([...once].sort()).toEqual(plots);
    expect(plots).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
  });

  it('spreads treatments evenly over positions', () => {
    // over many seeds every treatment lands in the first position about equally often
    const counts = { T1: 0, T2: 0, T3: 0, T4: 0 };
    for (let seed = 1; seed <= 4000; seed++) {
      counts[shuffleWith(seededRandom(seed), Object.keys(counts))[0]] += 1;
    }
    Object.values(counts).forEach(count => expect(Math.abs(count - 1000)).toBeLessThan(120));
  });

  it('makes six-digit seeds', () => {
    for (let i = 0; i < 50; i++) {
      const seed = newSeed();
      expect(seed).toBeGreaterThanOrEqual(100000);
      expect(seed).toBeLessThan(1000000);
    }
  });
});
