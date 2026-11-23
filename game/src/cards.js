// The card collection: 40 unique cards, 10 per element, each with its cost, its stats
// or its spell effect, and the one-line text the card face shows. Effects are small
// string codes the engine understands (see EFFECTS below); a minion's `onPlay` fires
// when it enters the table, its `onDeath` when it leaves it. Nothing here draws or
// runs: this file is data, and the engine is the only thing that reads it.
//
// Card balance in one paragraph: 1-cost cards are 2/1 or 1/3 bodies and cheap tricks;
// 2-cost cards are 3/2, 2/4 or a draw; 3-cost cards are 4/3 or 3/4 with a small
// battlecry; 4-cost cards are 4/4, 3/5 or a board spell; 5-cost cards are 5/4, 5/5
// or 2/7 taunts; 6-cost cards are 6/6 taunts or 6/5; 7-cost cards are 8/7 and 7/8.
// Spells cost about 1 mana per 2 damage, and a draw or a heal rides on top for +1.

import { KIND_MINION, KIND_SPELL } from './config.js';

/**
 * One card. `atk`/`hp` are for minions; `effect` is a spell's effect code;
 * `onPlay`/`onDeath` are minion triggers; `taunt` marks a guard that must be
 * attacked first. `icon` picks the vector glyph the card face draws.
 */
export const CARDS = [
  // ---- Ember: burn it down. Fast, fragile, and it hits the hero. ----
  { id: 'ember-spark', name: 'Cinder Imp', element: 'ember', cost: 1, kind: KIND_MINION, atk: 2, hp: 1, icon: 'imp', text: 'A spark with teeth.' },
  { id: 'ember-flame', name: 'Flame Pup', element: 'ember', cost: 2, kind: KIND_MINION, atk: 3, hp: 2, icon: 'pup', text: 'It fetches. It also bites.' },
  { id: 'ember-blaze', name: 'Blaze Hound', element: 'ember', cost: 3, kind: KIND_MINION, atk: 4, hp: 3, icon: 'hound', text: 'Leaves pawprints of ash.' },
  { id: 'ember-salamander', name: 'Salamander', element: 'ember', cost: 4, kind: KIND_MINION, atk: 3, hp: 5, icon: 'salamander', text: 'Draw a card.', onPlay: 'draw1' },
  { id: 'ember-phoenix', name: 'Ash Phoenix', element: 'ember', cost: 5, kind: KIND_MINION, atk: 5, hp: 4, icon: 'phoenix', text: 'Death: deal 2 to the enemy hero.', onDeath: 'death_dmg2_hero' },
  { id: 'ember-golem', name: 'Magma Golem', element: 'ember', cost: 6, kind: KIND_MINION, atk: 6, hp: 6, icon: 'golem', text: 'Taunt.', taunt: true },
  { id: 'ember-dragon', name: 'Ember Dragon', element: 'ember', cost: 7, kind: KIND_MINION, atk: 8, hp: 7, icon: 'dragon', text: 'The court holds its breath.' },
  { id: 'ember-kindle', name: 'Kindle', element: 'ember', cost: 1, kind: KIND_SPELL, icon: 'kindle', text: 'A friendly minion gains +2 attack.', effect: 'buff_friendly_atk2' },
  { id: 'ember-fireball', name: 'Fireball', element: 'ember', cost: 2, kind: KIND_SPELL, icon: 'fireball', text: 'Deal 3 damage to any target.', effect: 'dmg3_any' },
  { id: 'ember-immolate', name: 'Immolate', element: 'ember', cost: 3, kind: KIND_SPELL, icon: 'immolate', text: 'Deal 2 damage to all enemy minions.', effect: 'dmg2_all_enemy_minions' },

  // ---- Tide: outlast them. Big health, taunts, healing, and card flow. ----
  { id: 'tide-droplet', name: 'Droplet', element: 'tide', cost: 1, kind: KIND_MINION, atk: 1, hp: 3, icon: 'droplet', text: 'Small. Patient. Everywhere.' },
  { id: 'tide-crab', name: 'Tide Crab', element: 'tide', cost: 2, kind: KIND_MINION, atk: 2, hp: 4, icon: 'crab', text: 'Taunt.', taunt: true },
  { id: 'tide-otter', name: 'Current Otter', element: 'tide', cost: 2, kind: KIND_MINION, atk: 3, hp: 1, icon: 'otter', text: 'Draw a card.', onPlay: 'draw1' },
  { id: 'tide-serpent', name: 'River Serpent', element: 'tide', cost: 3, kind: KIND_MINION, atk: 4, hp: 3, icon: 'serpent', text: 'Slips past every guard.' },
  { id: 'tide-siren', name: 'Siren', element: 'tide', cost: 4, kind: KIND_MINION, atk: 3, hp: 4, icon: 'siren', text: 'Restore 4 life to your hero.', onPlay: 'heal4_hero' },
  { id: 'tide-turtle', name: 'Shell Turtle', element: 'tide', cost: 5, kind: KIND_MINION, atk: 2, hp: 7, icon: 'turtle', text: 'Taunt.', taunt: true },
  { id: 'tide-leviathan', name: 'Leviathan', element: 'tide', cost: 7, kind: KIND_MINION, atk: 7, hp: 8, icon: 'leviathan', text: 'The tide itself, wearing a crown.' },
  { id: 'tide-surge', name: 'Surge', element: 'tide', cost: 2, kind: KIND_SPELL, icon: 'surge', text: 'Deal 2 damage. Draw a card.', effect: 'dmg2_any_draw1' },
  { id: 'tide-mend', name: 'Mend', element: 'tide', cost: 2, kind: KIND_SPELL, icon: 'mend', text: 'Restore 6 life to your hero.', effect: 'heal6_hero' },
  { id: 'tide-frost', name: 'Frostbite', element: 'tide', cost: 3, kind: KIND_SPELL, icon: 'frost', text: 'Deal 1 damage and Freeze an enemy minion.', effect: 'dmg1_freeze_minion' },

  // ---- Thorn: grow wide. Tokens, buffs, and walls of bark. ----
  { id: 'thorn-sprout', name: 'Sproutling', element: 'thorn', cost: 1, kind: KIND_MINION, atk: 2, hp: 1, icon: 'sprout', text: 'It will be a forest one day.' },
  { id: 'thorn-wisp', name: 'Wisp', element: 'thorn', cost: 1, kind: KIND_MINION, atk: 2, hp: 2, icon: 'wisp', text: 'A light that bites back.' },
  { id: 'thorn-wolf', name: 'Thorn Wolf', element: 'thorn', cost: 2, kind: KIND_MINION, atk: 3, hp: 2, icon: 'wolf', text: 'Runs with the whole pack.' },
  { id: 'thorn-dryad', name: 'Dryad', element: 'thorn', cost: 3, kind: KIND_MINION, atk: 2, hp: 4, icon: 'dryad', text: 'Restore 3 life to your hero.', onPlay: 'heal3_hero' },
  { id: 'thorn-bear', name: 'Briar Bear', element: 'thorn', cost: 4, kind: KIND_MINION, atk: 4, hp: 5, icon: 'bear', text: 'Taunt.', taunt: true },
  { id: 'thorn-vine', name: 'Strangle Vine', element: 'thorn', cost: 5, kind: KIND_MINION, atk: 6, hp: 4, icon: 'vine', text: 'It does not let go.' },
  { id: 'thorn-ancient', name: 'Ancient Oak', element: 'thorn', cost: 6, kind: KIND_MINION, atk: 5, hp: 8, icon: 'oak', text: 'Taunt.', taunt: true },
  { id: 'thorn-bloom', name: 'Bloom', element: 'thorn', cost: 1, kind: KIND_SPELL, icon: 'bloom', text: 'Summon a 1/1 Sprout.', effect: 'summon_sprout' },
  { id: 'thorn-thorns', name: 'Thorn Volley', element: 'thorn', cost: 2, kind: KIND_SPELL, icon: 'thorns', text: 'Deal 2 damage to a minion. Restore 2 life.', effect: 'dmg2_minion_heal2' },
  { id: 'thorn-regrowth', name: 'Regrowth', element: 'thorn', cost: 3, kind: KIND_SPELL, icon: 'regrowth', text: 'Restore 5 life. Draw a card.', effect: 'heal5_draw1' },

  // ---- Gale: strike first. Cheap tricks, card flow, and board wipes. ----
  { id: 'gale-sparrow', name: 'Gale Sparrow', element: 'gale', cost: 1, kind: KIND_MINION, atk: 2, hp: 1, icon: 'sparrow', text: 'First to the feast.' },
  { id: 'gale-zephyr', name: 'Zephyr', element: 'gale', cost: 2, kind: KIND_MINION, atk: 1, hp: 3, icon: 'zephyr', text: 'Draw a card.', onPlay: 'draw1' },
  { id: 'gale-wisp', name: 'Cloud Wisp', element: 'gale', cost: 2, kind: KIND_MINION, atk: 3, hp: 3, icon: 'cloud', text: 'Soft as weather. Sharp as weather.' },
  { id: 'gale-hawk', name: 'Storm Hawk', element: 'gale', cost: 3, kind: KIND_MINION, atk: 4, hp: 2, icon: 'hawk', text: 'It hunts from above the clouds.' },
  { id: 'gale-griffin', name: 'Griffin', element: 'gale', cost: 4, kind: KIND_MINION, atk: 4, hp: 4, icon: 'griffin', text: 'Half eagle. All attitude.' },
  { id: 'gale-djinn', name: 'Djinn', element: 'gale', cost: 5, kind: KIND_MINION, atk: 5, hp: 5, icon: 'djinn', text: 'Deal 2 damage to the enemy hero.', onPlay: 'dmg2_hero' },
  { id: 'gale-storm', name: 'Storm Elemental', element: 'gale', cost: 6, kind: KIND_MINION, atk: 6, hp: 5, icon: 'storm', text: 'Thunder, given legs.' },
  { id: 'gale-gust', name: 'Gust', element: 'gale', cost: 1, kind: KIND_SPELL, icon: 'gust', text: 'Deal 1 damage. Draw a card.', effect: 'dmg1_any_draw1' },
  { id: 'gale-swift', name: 'Swift Strike', element: 'gale', cost: 2, kind: KIND_SPELL, icon: 'swift', text: 'Deal 4 damage to a minion.', effect: 'dmg4_minion' },
  { id: 'gale-cyclone', name: 'Cyclone', element: 'gale', cost: 4, kind: KIND_SPELL, icon: 'cyclone', text: 'Deal 3 damage to all enemy minions.', effect: 'dmg3_all_enemy_minions' },
];

/** The token Bloom summons and the Overgrowth combo summons. Not in the 40. */
export const TOKEN_SPROUT = {
  id: 'token-sprout', name: 'Sprout', element: 'thorn', cost: 1,
  kind: KIND_MINION, atk: 1, hp: 1, icon: 'sprout', text: 'A 1/1 Sprout token.',
};

/** Look a card up by id; tokens included. */
export const CARD_BY_ID = new Map();
for (const card of CARDS) CARD_BY_ID.set(card.id, card);
CARD_BY_ID.set(TOKEN_SPROUT.id, TOKEN_SPROUT);

export function cardById(id) {
  return CARD_BY_ID.get(id) ?? null;
}

/** Every spell effect code and whether it needs a target, and what kind. */
export const EFFECTS = {
  buff_friendly_atk2: { target: 'friendly-minion', text: 'Give +2 attack' },
  dmg3_any: { target: 'any', text: 'Deal 3' },
  dmg2_all_enemy_minions: { target: 'none', text: 'Deal 2 to all enemy minions' },
  dmg2_any_draw1: { target: 'any', text: 'Deal 2, draw 1' },
  heal6_hero: { target: 'none', text: 'Restore 6' },
  dmg1_freeze_minion: { target: 'enemy-minion', text: 'Deal 1, Freeze' },
  summon_sprout: { target: 'none', text: 'Summon a Sprout' },
  dmg2_minion_heal2: { target: 'enemy-minion', text: 'Deal 2, restore 2' },
  heal5_draw1: { target: 'none', text: 'Restore 5, draw 1' },
  dmg1_any_draw1: { target: 'any', text: 'Deal 1, draw 1' },
  dmg4_minion: { target: 'enemy-minion', text: 'Deal 4 to a minion' },
  dmg3_all_enemy_minions: { target: 'none', text: 'Deal 3 to all enemy minions' },
};

/** Minion trigger codes the engine understands. */
export const TRIGGERS = {
  draw1: 'Draw a card',
  heal4_hero: 'Restore 4 life to your hero',
  heal3_hero: 'Restore 3 life to your hero',
  dmg2_hero: 'Deal 2 damage to the enemy hero',
  death_dmg2_hero: 'Death: deal 2 to the enemy hero',
};

// ---- Combos: 12 of them. ----
//
// An element combo fires the moment a side plays its second card of one element
// in a single turn. A named pair fires when both of its cards are played in the
// same turn, in any order. A combo fires once per turn per combo; the log and the
// banner call it out, and the match stats count it.

/** The four element combos, keyed by element. */
export const ELEMENT_COMBOS = {
  ember: { name: 'Wildfire', text: 'Two Ember cards in one turn: deal 2 to the enemy hero.', effect: 'combo_dmg2_hero' },
  tide: { name: 'High Tide', text: 'Two Tide cards in one turn: restore 5 life.', effect: 'combo_heal5' },
  thorn: { name: 'Overgrowth', text: 'Two Thorn cards in one turn: summon a 1/1 Sprout.', effect: 'combo_sprout' },
  gale: { name: 'Tailwind', text: 'Two Gale cards in one turn: draw 2 cards.', effect: 'combo_draw2' },
};

/** The eight named pair combos. `cards` are the two ids that must both be played. */
export const PAIR_COMBOS = [
  { name: 'Pack Fire', cards: ['ember-spark', 'ember-blaze'], text: 'Cinder Imp + Blaze Hound: your minions gain +1 attack this turn.', effect: 'pair_buff_all_atk1' },
  { name: 'Sky Burn', cards: ['ember-phoenix', 'ember-dragon'], text: 'Ash Phoenix + Ember Dragon: deal 4 to the enemy hero.', effect: 'pair_dmg4_hero' },
  { name: 'Shell Wall', cards: ['tide-crab', 'tide-turtle'], text: 'Tide Crab + Shell Turtle: gain 6 armor.', effect: 'pair_armor6' },
  { name: 'Deep Song', cards: ['tide-serpent', 'tide-siren'], text: 'River Serpent + Siren: draw 2 cards and restore 3 life.', effect: 'pair_draw2_heal3' },
  { name: 'Ironwood', cards: ['thorn-bear', 'thorn-ancient'], text: 'Briar Bear + Ancient Oak: your minions gain +1/+1.', effect: 'pair_buff_all_1_1' },
  { name: 'Ambush', cards: ['thorn-wolf', 'thorn-vine'], text: 'Thorn Wolf + Strangle Vine: deal 3 to a random enemy minion.', effect: 'pair_dmg3_random_minion' },
  { name: 'Tempest', cards: ['gale-hawk', 'gale-djinn'], text: 'Storm Hawk + Djinn: deal 2 to all enemy minions.', effect: 'pair_dmg2_all_enemy_minions' },
  { name: 'Sky Patrol', cards: ['gale-sparrow', 'gale-griffin'], text: 'Gale Sparrow + Griffin: draw 1 card and gain 2 mana this turn.', effect: 'pair_draw1_mana2' },
];

/** All twelve combos in one list, for the How to Play screen and the stats. */
export const ALL_COMBOS = [
  ...Object.entries(ELEMENT_COMBOS).map(([element, combo]) => ({ ...combo, kind: 'element', element })),
  ...PAIR_COMBOS.map((combo) => ({ ...combo, kind: 'pair' })),
];

// ---- Decks: 30 cards each, built from the 40. ----
//
// The player's deck is balanced across all four elements so every combo is
// reachable; each rival's deck leans hard into one element, which is both their
// strength (their element combo fires often) and their tell (you know what is
// coming). Duplicates are allowed: a deck may hold two copies of a card.

export const PLAYER_DECK = [
  'ember-spark', 'ember-spark', 'ember-flame', 'ember-blaze', 'ember-fireball',
  'ember-fireball', 'ember-kindle', 'ember-salamander',
  'tide-droplet', 'tide-crab', 'tide-otter', 'tide-serpent', 'tide-surge',
  'tide-mend', 'tide-siren',
  'thorn-sprout', 'thorn-wisp', 'thorn-wolf', 'thorn-dryad', 'thorn-bloom',
  'thorn-bloom', 'thorn-bear', 'thorn-thorns',
  'gale-sparrow', 'gale-zephyr', 'gale-wisp', 'gale-hawk', 'gale-gust',
  'gale-swift', 'gale-griffin',
];

function deckOf(cards) {
  return cards.slice();
}

export const RIVAL_DECKS = {
  ember: deckOf([
    'ember-spark', 'ember-spark', 'ember-flame', 'ember-flame', 'ember-blaze',
    'ember-blaze', 'ember-salamander', 'ember-phoenix', 'ember-phoenix',
    'ember-golem', 'ember-dragon', 'ember-kindle', 'ember-kindle',
    'ember-fireball', 'ember-fireball', 'ember-fireball', 'ember-immolate',
    'ember-immolate', 'tide-otter', 'tide-droplet', 'thorn-wolf', 'thorn-sprout',
    'gale-sparrow', 'gale-gust', 'gale-zephyr', 'ember-spark', 'ember-flame',
    'ember-blaze', 'ember-fireball', 'ember-phoenix',
  ]),
  tide: deckOf([
    'tide-droplet', 'tide-droplet', 'tide-crab', 'tide-crab', 'tide-otter',
    'tide-otter', 'tide-serpent', 'tide-serpent', 'tide-siren', 'tide-siren',
    'tide-turtle', 'tide-turtle', 'tide-leviathan', 'tide-surge', 'tide-surge',
    'tide-mend', 'tide-mend', 'tide-frost', 'tide-frost', 'tide-frost',
    'ember-flame', 'ember-fireball', 'thorn-dryad', 'thorn-wolf', 'gale-zephyr',
    'gale-wisp', 'tide-droplet', 'tide-crab', 'tide-serpent', 'tide-mend',
  ]),
  thorn: deckOf([
    'thorn-sprout', 'thorn-sprout', 'thorn-wisp', 'thorn-wisp', 'thorn-wolf',
    'thorn-wolf', 'thorn-dryad', 'thorn-dryad', 'thorn-bear', 'thorn-bear',
    'thorn-vine', 'thorn-ancient', 'thorn-bloom', 'thorn-bloom', 'thorn-bloom',
    'thorn-thorns', 'thorn-thorns', 'thorn-regrowth', 'thorn-regrowth',
    'ember-spark', 'ember-flame', 'tide-droplet', 'tide-crab', 'gale-sparrow',
    'gale-zephyr', 'thorn-sprout', 'thorn-wolf', 'thorn-bear', 'thorn-bloom',
    'thorn-vine',
  ]),
  gale: deckOf([
    'gale-sparrow', 'gale-sparrow', 'gale-zephyr', 'gale-zephyr', 'gale-wisp',
    'gale-wisp', 'gale-hawk', 'gale-hawk', 'gale-griffin', 'gale-griffin',
    'gale-djinn', 'gale-storm', 'gale-gust', 'gale-gust', 'gale-swift',
    'gale-swift', 'gale-cyclone', 'gale-cyclone', 'ember-flame', 'ember-fireball',
    'tide-otter', 'tide-droplet', 'thorn-wolf', 'thorn-sprout', 'gale-sparrow',
    'gale-hawk', 'gale-griffin', 'gale-djinn', 'gale-cyclone', 'gale-swift',
  ]),
  mixed: deckOf([
    'ember-spark', 'ember-blaze', 'ember-phoenix', 'ember-dragon', 'ember-fireball',
    'tide-crab', 'tide-serpent', 'tide-siren', 'tide-leviathan', 'tide-frost',
    'thorn-bear', 'thorn-vine', 'thorn-ancient', 'thorn-bloom', 'thorn-regrowth',
    'gale-hawk', 'gale-djinn', 'gale-storm', 'gale-cyclone', 'gale-swift',
    'ember-golem', 'tide-turtle', 'thorn-dryad', 'gale-griffin', 'ember-salamander',
    'tide-otter', 'thorn-wolf', 'gale-zephyr', 'ember-immolate', 'tide-mend',
  ]),
};

// ---- The campaign: five rivals, one crown. ----
//
// Each rival has a name, a title, an element theme (their deck and their colour),
// extra life over the base 30 on the later rounds, and an AI profile: how boldly
// they spend mana, how often they trade minions instead of going for the hero,
// and whether they hold a removal spell for a big threat. The last rival is the
// reigning champion; beating all five wins the Crown.

export const OPPONENTS = [
  {
    id: 'rook', name: 'Rook', title: 'the Ember Acolyte', element: 'ember',
    deck: 'ember', hpBonus: 0, aggression: 0.45, tradeBias: 0.7, holdsRemoval: false,
    tell: 'Rook taps the table twice, then reaches for the top of his deck.',
    taunt: 'Burn bright, little spark. I will blow you out.',
    winLine: 'The spark gutters. The court remembers its name anyway.',
    loseLine: 'Ha! The acolyte becomes the master — for one round, at least.',
    quips: ['Watch and learn, spark.', 'My hounds smell fear. And lunch.', 'Burn, little candle. Burn.'],
  },
  {
    id: 'mira', name: 'Mira', title: 'the Tide Caller', element: 'tide',
    deck: 'tide', hpBonus: 0, aggression: 0.4, tradeBias: 0.8, holdsRemoval: false,
    tell: 'Mira closes her eyes and listens to the cards, as if they were waves.',
    taunt: 'The tide always comes back. So do I.',
    winLine: 'The tide goes out. Even the sea must rest.',
    loseLine: 'The tide takes you, as it takes everything, in time.',
    quips: ['The tide provides.', 'You swim well. The deep is patient.', 'Every wave returns. So will I.'],
  },
  {
    id: 'bramble', name: 'Bramble', title: 'the Thorn Warden', element: 'thorn',
    deck: 'thorn', hpBonus: 2, aggression: 0.5, tradeBias: 0.6, holdsRemoval: true,
    tell: 'Bramble counts your minions on his fingers, one by one, and smiles.',
    taunt: 'My garden grows. Your hopes do not.',
    winLine: 'The garden opens a path. Walk it while it lasts.',
    loseLine: 'The thorns close. The garden keeps what it catches.',
    quips: ['Grow, my lovelies. Grow.', 'The garden provides. The garden also takes.', 'You prune nothing here. Nothing.'],
  },
  {
    id: 'zephyr', name: 'Zephyr', title: 'the Gale Duelist', element: 'gale',
    deck: 'gale', hpBonus: 4, aggression: 0.65, tradeBias: 0.45, holdsRemoval: true,
    tell: 'Zephyr shuffles his hand behind his back, where you cannot see it.',
    taunt: 'You cannot hit what the wind carries away.',
    winLine: 'The wind drops. For once, the sky is still.',
    loseLine: 'The wind keeps your crown. It was never yours to hold.',
    quips: ['Catch me if you can. You cannot.', 'The wind owes you nothing.', 'Too slow. The sky is mine.'],
  },
  {
    id: 'crown', name: 'The Ember Queen', title: 'the Reigning Champion', element: 'mixed',
    deck: 'mixed', hpBonus: 6, aggression: 0.7, tradeBias: 0.4, holdsRemoval: true,
    tell: 'The Queen does not look at her cards. She looks at you.',
    taunt: 'Five courts have fallen to me. Yours will be the sixth.',
    winLine: 'The Queen rises, removes her crown, and sets it on your head.',
    loseLine: 'The Queen keeps her crown. The court applauds, politely.',
    quips: ['Kneel, challenger. Kneel.', 'The Crown does not share its table.', 'Five courts fell. You are a formality.'],
  },
];

/** The player's hero, for the hero blocks and the campaign screen. */
export const PLAYER_HERO = {
  name: 'You', title: 'the Challenger', element: 'ember',
};

/** A quick duel is one match against a random rival, no campaign progress. */
export function quickDuelOpponent(random) {
  const index = Math.floor(random() * (OPPONENTS.length - 1));
  return OPPONENTS[index];
}

// ---- Card lore: one line per card, shown in the Collection. ----
export const CARD_LORE = {
  'ember-spark': 'The court lights its candles with imps like this one.',
  'ember-flame': 'It was a puppy once. The fire kept the puppy.',
  'ember-blaze': 'Where it runs, the grass forgets how to be green.',
  'ember-salamander': 'It reads the future in the coals and tells no one.',
  'ember-phoenix': 'It dies the way other birds sing: often, and beautifully.',
  'ember-golem': 'The mountain got tired of standing still.',
  'ember-dragon': 'Its shadow is the only eclipse the court fears.',
  'ember-kindle': 'One spark, offered at the right moment, is a siege.',
  'ember-fireball': 'The oldest argument in the court, settled quickly.',
  'ember-immolate': 'Everything burns. The trick is choosing what burns first.',
  'tide-droplet': 'The ocean, practising.',
  'tide-crab': 'It has never lost a staring contest. It has never blinked.',
  'tide-otter': 'It rides the current the way other minions ride luck.',
  'tide-serpent': 'The river keeps its fastest child for itself.',
  'tide-siren': 'Her song is a lullaby. The drowning is incidental.',
  'tide-turtle': 'It has outlived three courts and two queens.',
  'tide-leviathan': 'Sailors pray to it. The court prays it stays asleep.',
  'tide-surge': 'The wave does not ask permission. Neither do you.',
  'tide-mend': 'Salt water closes wounds. So does patience.',
  'tide-frost': 'Winter, borrowed for exactly one turn.',
  'thorn-sprout': 'Every forest in the court started as a dare.',
  'thorn-wisp': 'A firefly that traded its light for teeth.',
  'thorn-wolf': 'It hunts in a pack of one: itself, and its shadow.',
  'thorn-dryad': 'She remembers when your hero was a seedling.',
  'thorn-bear': 'It hugs. The hugging is the problem.',
  'thorn-vine': 'It does not chase you. It waits where you will step.',
  'thorn-ancient': 'It was old when the first court was built around it.',
  'thorn-bloom': 'Spring, on demand, in a pot, with ambitions.',
  'thorn-thorns': 'A rose, if the rose had a grudge and good aim.',
  'thorn-regrowth': 'What the storm breaks, the garden rebuilds by morning.',
  'gale-sparrow': 'It arrives before the thunder and leaves before the rain.',
  'gale-zephyr': 'A breeze that learned to read the cards.',
  'gale-wisp': 'Clouds are just weather that has not decided yet.',
  'gale-hawk': 'It sees your hand from a mile up. It says nothing.',
  'gale-griffin': 'It guards the sky the way a miser guards gold.',
  'gale-djinn': 'Three wishes, none of them yours.',
  'gale-storm': 'Thunder, given legs and a bad temper.',
  'gale-gust': 'A small wind with large opinions.',
  'gale-swift': 'You will not see it coming. Neither will your minion.',
  'gale-cyclone': 'The sky, briefly, has a point to make.',
};

// ---- Achievements: small milestones, kept in this browser, shown on the title. ----
export const ACHIEVEMENTS = [
  { id: 'first-win', name: 'First Blood', text: 'Win your first duel.' },
  { id: 'crown', name: 'Crowned', text: 'Win the 5-round campaign.' },
  { id: 'combo3', name: 'Combo Master', text: 'Fire 3 combos in one duel.' },
  { id: 'untouchable', name: 'Untouchable', text: 'Win a duel at full life.' },
  { id: 'regular', name: 'Court Regular', text: 'Play 5 duels.' },
  { id: 'comeback', name: 'Comeback', text: 'Win a duel from 5 life or less.' },
];
