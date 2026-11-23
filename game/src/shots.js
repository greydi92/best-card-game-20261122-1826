// The screenshot scenes behind ?shot=start|play|win|lose. Each one plays the real
// rules forward from a fresh duel, steered by a simple autopilot that plays both
// sides greedily (play what you can afford, attack with what can attack, aim at
// the hero unless a Taunt stands in the way), so the frame is what a real game
// looks like and the same seed always gives the same frame. The win and lose
// scenes re-seed and replay until the side they need actually wins — a duel's
// outcome is luck and play, so a fixed seed may go either way.
//
// Nothing here stages a fake board: every card on the table was drawn from a
// shuffled deck, paid for with mana, and played by the engine's own methods.

import { EFFECTS, cardById } from './cards.js';
import { KIND_MINION } from './config.js';

/** The biggest enemy minion, or null when the table is empty. */
function biggestFoe(duel, side) {
  const table = side === 'player' ? duel.ai.table : duel.player.table;
  if (table.length === 0) return null;
  return [...table].sort((a, b) => (b.atk + b.hp) - (a.atk + a.hp))[0];
}

/** Pick a target for a card the autopilot is about to play. */
function autopilotTarget(duel, side, card) {
  if (card.kind !== 'spell') return null;
  const need = EFFECTS[card.effect]?.target ?? 'none';
  if (need === 'none') return null;
  const foeSide = side === 'player' ? 'ai' : 'player';
  if (need === 'friendly-minion') {
    const best = [...(side === 'player' ? duel.player.table : duel.ai.table)]
      .sort((a, b) => b.atk - a.atk)[0];
    return best ? { kind: 'minion', side, uid: best.uid } : null;
  }
  if (need === 'enemy-minion') {
    const foe = biggestFoe(duel, side);
    return foe ? { kind: 'minion', side: foeSide, uid: foe.uid } : null;
  }
  // 'any': burn the hero when it is close to lethal, else the biggest minion.
  const foeHero = side === 'player' ? duel.ai : duel.player;
  const burn = card.effect === 'dmg3_any' ? 3 : card.effect === 'dmg2_any_draw1' ? 2 : 1;
  if (foeHero.hp <= burn + 2) return { kind: 'hero', side: foeSide };
  const foe = biggestFoe(duel, side);
  return foe ? { kind: 'minion', side: foeSide, uid: foe.uid } : { kind: 'hero', side: foeSide };
}

/** One side's whole turn, played greedily: cards first, then attacks. */
export function autopilotTurn(engine, duel, side) {
  const events = [];
  const test = engine._test;
  const hero = side === 'player' ? duel.player : duel.ai;
  // Play cards: most expensive first, while the mana lasts.
  let played = true;
  while (played && !duel.over) {
    played = false;
    const affordable = hero.hand
      .map((c) => ({ handCard: c, card: cardById(c.cardId) }))
      .filter(({ card }) => card.cost <= hero.mana)
      .sort((a, b) => b.card.cost - a.card.cost);
    for (const { handCard, card } of affordable) {
      if (card.kind === KIND_MINION && hero.table.length >= 5) continue;
      const target = autopilotTarget(duel, side, card);
      const result = test.playCard(events, duel, side, handCard.uid, target);
      if (result.played) {
        played = true;
        break;
      }
      if (result.reason === 'needs-target') {
        const fallback = autopilotTarget(duel, side, card);
        if (fallback && test.playCard(events, duel, side, handCard.uid, fallback).played) {
          played = true;
          break;
        }
      }
    }
  }
  // Attack with everything that can: taunts first, then the hero.
  for (const minion of [...hero.table]) {
    if (duel.over) break;
    if (!minion.canAttack || minion.frozenTurns > 0) continue;
    const foeSide = side === 'player' ? 'ai' : 'player';
    const foes = side === 'player' ? duel.ai.table : duel.player.table;
    const taunt = foes.find((m) => m.taunt);
    const target = taunt
      ? { kind: 'minion', side: foeSide, uid: taunt.uid }
      : { kind: 'hero', side: foeSide };
    test.attack(events, duel, side, minion.uid, target);
  }
  return events;
}

/** Run full turns (player autopilot, then the engine's own AI) until the duel ends. */
function playOut(engine, duel, maxTurns) {
  for (let turn = 0; turn < maxTurns && !duel.over; turn += 1) {
    autopilotTurn(engine, duel, 'player');
    if (duel.over) break;
    engine.endTurn();
    // The AI's turn: step it until it hands the turn back.
    for (let guard = 0; guard < 60 && !duel.over; guard += 1) {
      const { more } = engine.aiStep();
      if (!more) break;
    }
  }
}

/**
 * Set the engine to the named scene and return the screen to draw over it.
 * `seed` re-rolls the shuffle; the win/lose scenes try seeds until the side
 * they need actually wins (at most 24 attempts, then they take what they got).
 */
export function stageShot(name, engine, seed) {
  if (name === 'start') {
    engine.toTitle();
    return { screen: 'title' };
  }
  if (name === 'play') {
    engine.startRound(1);
    engine.mulliganConfirm();
    const duel = engine.duel;
    playOut(engine, duel, 4);
    return { screen: duel.over ? (duel.winner === 'player' ? 'roundwin' : 'lose') : 'duel' };
  }
  const wantWinner = name === 'win' ? 'player' : 'ai';
  for (let attempt = 0; attempt < 24; attempt += 1) {
    // Each attempt starts a fresh duel, and the engine's seeded random has
    // advanced, so the shuffle is a new one; the same seed replays the same
    // sequence of attempts.
    engine.newQuickDuel();
    engine.mulliganConfirm();
    const duel = engine.duel;
    playOut(engine, duel, 40);
    if (duel.over && duel.winner === wantWinner) {
      engine.finishDuel();
      return { screen: engine.state.phase };
    }
  }
  // No attempt went the wanted way (rare): take the last duel as it stands.
  engine.finishDuel();
  return { screen: engine.state.phase };
}
