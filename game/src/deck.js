// Ember Court — decks: build, shuffle (seeded, so screenshots are reproducible)
// and draw. Both players share the same 30-card list; each gets its own shuffled copy.
import { CARD_DEFS } from './cards.js';

// Two copies of most cards, one of the finishers: a 30-card deck with a real curve.
const DECKLIST = [
  'ember-imp', 'ember-imp',
  'pebble-sprite', 'pebble-sprite',
  'cinder-hound', 'cinder-hound',
  'tidecaller', 'tidecaller',
  'thorn-sprout', 'thorn-sprout',
  'briar-wolf', 'briar-wolf',
  'reef-guardian', 'reef-guardian',
  'stone-golem', 'stone-golem',
  'ash-phoenix',
  'storm-drake',
  'ancient-treant',
  'mountain-titan',
  'fireball', 'fireball',
  'ember-surge', 'ember-surge',
  'healing-spring', 'healing-spring',
  'whispering-current', 'whispering-current',
  'thorn-volley',
  'quake',
];

export const DECK_SIZE = DECKLIST.length; // 30

// mulberry32 — small deterministic PRNG so `?seed=` replays the same duel.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDeck(seed) {
  const rng = makeRng(seed);
  const cards = DECKLIST.map((id, i) => ({ uid: `c${i}-${id}`, defId: id }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function drawCards(deck, hand, n, maxHand = 7) {
  const drawn = [];
  while (n > 0 && deck.length > 0 && hand.length < maxHand) {
    const card = deck.pop();
    hand.push(card);
    drawn.push(card);
    n--;
  }
  return drawn;
}

export function deckCountLabel(deck) {
  return deck.length;
}
