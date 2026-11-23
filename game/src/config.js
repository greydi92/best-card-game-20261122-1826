// Every tuning number, colour and layout constant in one place. The table is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. A duel is won by taking the rival hero from 30 life to 0.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Life each hero starts a duel with. */
export const HERO_HP = 30;

/** Mana crystals: what a side starts with, what it gains each of its turns, the cap. */
export const MANA = { start: 3, perTurn: 1, max: 10 };

/** Cards drawn at the start of a duel, drawn at the start of each of your turns, hand cap. */
export const DRAW = { opening: 4, perTurn: 1, handMax: 7 };

/** Cards in a deck, minions allowed on one side of the table at once. */
export const DECK_SIZE = 30;
export const TABLE_MAX = 5;

/** How many campaign rounds stand between the player and the Crown. */
export const CAMPAIGN_ROUNDS = 5;

/** The four elements, their wheel, and the damage swing when one strikes another. */
// Ember burns Thorn, Thorn chokes Gale, Gale scatters Tide, Tide drowns Ember.
export const ELEMENTS = ['ember', 'tide', 'thorn', 'gale'];
export const ELEMENT_BEATS = { ember: 'thorn', thorn: 'gale', gale: 'tide', tide: 'ember' };
export const ELEMENT_BONUS = 2; // extra damage when the attacker's element beats the defender's
export const ELEMENT_PENALTY = 1; // damage lost when the attacker's element is beaten by the defender's

export const ELEMENT_INFO = {
  ember: { name: 'Ember', color: '#e5534b', light: '#ff8a70', dark: '#7a1f1a', glyph: 'flame' },
  tide: { name: 'Tide', color: '#4fa8e0', light: '#8fd0ff', dark: '#173f63', glyph: 'drop' },
  thorn: { name: 'Thorn', color: '#5fbf5a', light: '#9be08a', dark: '#1e4d1a', glyph: 'leaf' },
  gale: { name: 'Gale', color: '#c9a6f5', light: '#e3d0ff', dark: '#4a2d7a', glyph: 'swirl' },
};

/** Card kinds. */
export const KIND_MINION = 'minion';
export const KIND_SPELL = 'spell';

/** Minion keywords. */
export const KEY_TAUNT = 'taunt';

/** The 12 combos: 4 element pairs (two cards of one element in a turn) and 8 named pairs. */
export const COMBO_COUNT = 12;

/** Layout of the table, in logical pixels. */
export const LAYOUT = {
  // Rival hero block, top left.
  heroW: 250, heroH: 96,
  // Rival hand: face-down mini cards, top right.
  rivalHandY: 18, rivalCardW: 34, rivalCardH: 50, rivalCardGap: 8,
  // Table rows.
  rivalRowY: 132, rivalRowH: 132,
  playerRowY: 402, playerRowH: 132,
  // Middle band: turn banner, combo calls, event log, End Turn button.
  midY: 276, midH: 116,
  endTurn: { x: 1130, y: 296, w: 132, h: 52 },
  logX: 16, logY: 288, logW: 420, logLines: 5,
  // Player hero block, bottom left.
  playerHero: { x: 16, y: 556, w: 238, h: 148 },
  // Player hand: fanned across the bottom, right of the hero block.
  handY: 556, handW: 104, handH: 148, handGap: 10, handX0: 268,
  // Campaign map nodes.
  mapNodes: [
    { x: 190, y: 470 }, { x: 430, y: 330 }, { x: 670, y: 470 },
    { x: 910, y: 330 }, { x: 1120, y: 470 },
  ],
};

/** Card art: the size of the art band on a card face. */
export const CARD_ART_H = 62;

export const PALETTE = {
  backdrop: '#14101c',
  felt: '#1d1830',
  feltEdge: '#2c2447',
  tableLine: '#3a2f5e',
  panel: '#241d38',
  panelEdge: '#4a3d75',
  text: '#f2ecff',
  muted: '#a99ec7',
  dim: '#6f6590',
  gold: '#f2c94c',
  goldDark: '#8a6d1f',
  mana: '#5aa9e6',
  hp: '#e5534b',
  armor: '#9aa7b8',
  button: '#3d2f6e',
  buttonEdge: '#7a63c9',
  buttonText: '#ffffff',
  danger: '#ff5d5d',
  good: '#7ddb8a',
  shadow: 'rgba(0,0,0,0.45)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best campaign result is kept between visits (this browser only). */
export const BEST_KEY = 'ember-court.best';
export const MUTE_KEY = 'ember-court.muted';

/** Milliseconds the AI waits between its plays, so its turn reads as a turn. */
export const AI_PACE_MS = 750;

/** How long a floating damage number lives, in seconds. */
export const FLOAT_LIFE = 1.1;

/** How long the AI's tell banner shows before its turn resolves, in seconds. */
export const TELL_SECONDS = 1.4;
