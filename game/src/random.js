// A small seeded random number generator (mulberry32): the same seed gives the same
// shuffle and the same AI draws, which is what makes the screenshot scenes repeatable
// and what lets a campaign be replayed exactly.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle of `array` in place, using the seeded `random`. */
export function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
  return array;
}

/** Pick one element of `array` with the seeded `random`. */
export function pick(array, random) {
  return array[Math.floor(random() * array.length)];
}
