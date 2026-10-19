// Reproducible randomization: the same seed always gives the same sequence, so a field layout can be regenerated
// exactly from the seed printed on it.

// mulberry32: a small, well-mixed 32-bit generator (uniform numbers in [0, 1))
export const seededRandom = (seed) => {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Fisher-Yates shuffle driven by a seeded generator; the input is left untouched
export const shuffleWith = (random, array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// A fresh six-digit seed, short enough to write in a field notebook
export const newSeed = () => 100000 + Math.floor(Math.random() * 900000);
