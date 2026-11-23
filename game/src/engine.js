// The duel engine: rules and state, no drawing and no browser in it. A duel is two
// heroes, two decks, two hands and two tables; turns alternate, mana grows, cards
// are drawn, minions fight, spells resolve, and the first hero at 0 life loses.
//
// The engine speaks in events: every method returns an array of small event objects
// ({type:'log'|'float'|'sound'|'banner'|'combo'|'shake'|'turn'|'gameover', ...}) and
// the main loop turns them into sounds, floating numbers, log lines and shakes. That
// keeps the rules testable and the renderer dumb: it paints whatever the state says.
//
// Screens live outside the duel: the engine owns `phase` ('title', 'map', 'duel',
// 'roundwin', 'win', 'lose', 'howto', 'paused') and the campaign progress, and the
// renderer paints each one. The duel itself is `state.duel`, null outside a duel.

import {
  CAMPAIGN_ROUNDS, DECK_SIZE, DRAW, ELEMENT_BEATS, ELEMENT_BONUS, ELEMENT_PENALTY,
  HERO_HP, KIND_MINION, KIND_SPELL, MANA, TABLE_MAX,
} from './config.js';
import {
  ALL_COMBOS, ELEMENT_COMBOS, EFFECTS, OPPONENTS, PAIR_COMBOS, PLAYER_DECK,
  PLAYER_HERO, RIVAL_DECKS, TOKEN_SPROUT, cardById, quickDuelOpponent,
} from './cards.js';
import { shuffle } from './random.js';

let nextUid = 1;
function uid() {
  return nextUid += 1;
}

/** A minion on the table, built from a card. */
function makeMinion(card, side) {
  return {
    uid: uid(), cardId: card.id, side, atk: card.atk, hp: card.hp, maxHp: card.hp,
    taunt: card.taunt === true, frozenTurns: 0, canAttack: false,
    tempAtk: 0, // +attack that lasts until the end of the turn
    justPlayed: true,
  };
}

/** A card in a hand or a deck slot. */
function makeHandCard(cardId) {
  return { uid: uid(), cardId };
}

function makeSide(hero, deckIds, random) {
  const deck = shuffle(deckIds.map((id) => makeHandCard(id)), random);
  return {
    name: hero.name, title: hero.title, element: hero.element,
    hp: hero.hp ?? HERO_HP, maxHp: hero.hp ?? HERO_HP, armor: 0,
    mana: 0, maxMana: 0, deck, hand: [], table: [],
    fatigue: 0, // damage of the next fatigue draw
  };
}

export function createEngine(random, audio) {
  const state = {
    phase: 'title',
    mode: 'campaign',
    round: 1, // campaign round, 1-based
    opponent: OPPONENTS[0],
    campaignWins: 0,
    duel: null,
    // Match totals across the whole campaign, shown on the Crown screen.
    totals: { cardsPlayed: 0, combos: 0, damageDealt: 0, minions: 0, turns: 0, roundsWon: 0 },
    // Best campaign result (rounds won) in this browser.
    best: 0,
    // The AI's tell for its current turn; shown as a banner before it acts.
    aiTell: '',
    // Which combo names fired this duel, in order, for the end screens.
    duelCombos: [],
    // The Collection browser: which element is filtered, which card is selected.
    collectionFilter: 'all',
    collectionCard: null,
    collectionReturn: 'title',
    // Match history, kept by main.js in localStorage and read back here.
    history: [],
  };

  // ---- Small helpers -------------------------------------------------------

  function log(events, text) {
    events.push({ type: 'log', text });
  }

  function floatAt(events, target, text, color) {
    events.push({ type: 'float', target, text, color });
  }

  function heroTarget(side) {
    return { kind: 'hero', side };
  }

  function minionTarget(side, minionUid) {
    return { kind: 'minion', side, uid: minionUid };
  }

  function sideOf(duel, side) {
    return side === 'player' ? duel.player : duel.ai;
  }

  function enemyOf(duel, side) {
    return side === 'player' ? duel.ai : duel.player;
  }

  function findMinion(duel, side, minionUid) {
    return sideOf(duel, side).table.find((m) => m.uid === minionUid) ?? null;
  }

  function elementModifier(attackerElement, defenderElement) {
    if (ELEMENT_BEATS[attackerElement] === defenderElement) return ELEMENT_BONUS;
    if (ELEMENT_BEATS[defenderElement] === attackerElement) return -ELEMENT_PENALTY;
    return 0;
  }

  // ---- Damage, healing, death ----------------------------------------------

  function damageHero(events, duel, side, amount, sourceElement) {
    const hero = sideOf(duel, side);
    if (amount <= 0 || hero.hp <= 0) return 0;
    let left = amount;
    if (hero.armor > 0) {
      const absorbed = Math.min(hero.armor, left);
      hero.armor -= absorbed;
      left -= absorbed;
      if (absorbed > 0) log(events, `${hero.name}'s armor absorbs ${absorbed}.`);
    }
    hero.hp = Math.max(0, hero.hp - left);
    floatAt(events, heroTarget(side), `-${left}`, '#ff6b6b');
    events.push({ type: 'sound', name: 'heroHit' });
    events.push({ type: 'shake', mag: 7 });
    if (side === 'ai') {
      state.totals.damageDealt += left;
      duel.stats.damageDealt += left;
      if (left > (duel.stats.biggestHit ?? 0)) duel.stats.biggestHit = left;
    }
    if (hero.hp === 0) endDuel(events, duel, side === 'ai' ? 'player' : 'ai');
    // A rival on the ropes says something, once per duel.
    if (side === 'ai' && hero.hp > 0 && hero.hp <= 10 && !duel.quippedLow) {
      duel.quippedLow = true;
      events.push({ type: 'banner', text: `${hero.name}: “${state.opponent.quips[Math.floor(random() * state.opponent.quips.length)]}”`, sub: '' });
    }
    return left;
  }

  function damageMinion(events, duel, side, minion, amount, sourceElement) {
    if (amount <= 0 || minion.hp <= 0) return;
    let dealt = amount;
    if (sourceElement) {
      const card = cardById(minion.cardId);
      dealt = Math.max(0, amount + elementModifier(sourceElement, card.element));
    }
    minion.hp -= dealt;
    floatAt(events, minionTarget(side, minion.uid), `-${dealt}`, '#ffb347');
    events.push({ type: 'sound', name: 'hit' });
    if (minion.hp <= 0) killMinion(events, duel, side, minion);
  }

  function killMinion(events, duel, side, minion) {
    const table = sideOf(duel, side).table;
    const index = table.indexOf(minion);
    if (index !== -1) table.splice(index, 1);
    const card = cardById(minion.cardId);
    log(events, `${card.name} is destroyed.`);
    if (card.onDeath === 'death_dmg2_hero') {
      const other = side === 'player' ? 'ai' : 'player';
      log(events, `${card.name}'s dying ember burns the enemy hero for 2.`);
      damageHero(events, duel, other, 2, 'ember');
    }
  }

  function healHero(events, duel, side, amount) {
    const hero = sideOf(duel, side);
    if (hero.hp <= 0 || amount <= 0) return;
    const healed = Math.min(amount, hero.maxHp - hero.hp);
    hero.hp += healed;
    if (healed > 0) {
      floatAt(events, heroTarget(side), `+${healed}`, '#7ddb8a');
      events.push({ type: 'sound', name: 'heal' });
    }
  }

  function drawCards(events, duel, side, count) {
    const hero = sideOf(duel, side);
    for (let i = 0; i < count; i += 1) {
      if (hero.hand.length >= DRAW.handMax) {
        if (hero.deck.length > 0) hero.deck.shift();
        log(events, `${hero.name}'s hand is full — a card is burned.`);
        continue;
      }
      if (hero.deck.length === 0) {
        hero.fatigue += 1;
        log(events, `${hero.name} draws from an empty deck and takes ${hero.fatigue} fatigue.`);
        damageHero(events, duel, side, hero.fatigue, null);
        if (duel.over) return;
        continue;
      }
      hero.hand.push(hero.deck.shift());
      if (side === 'player') events.push({ type: 'sound', name: 'draw' });
    }
  }

  function summonMinion(events, duel, side, cardId, canAttackNow) {
    const hero = sideOf(duel, side);
    if (hero.table.length >= TABLE_MAX) {
      log(events, `${hero.name}'s table is full — the minion fizzles.`);
      return null;
    }
    const card = cardById(cardId);
    const minion = makeMinion(card, side);
    minion.canAttack = canAttackNow === true;
    hero.table.push(minion);
    duel.stats.minions += 1;
    state.totals.minions += 1;
    events.push({ type: 'sound', name: 'summon' });
    return minion;
  }

  // ---- Triggers and combos ---------------------------------------------------

  function fireTrigger(events, duel, side, code) {
    const hero = sideOf(duel, side);
    const other = side === 'player' ? 'ai' : 'player';
    if (code === 'draw1') {
      drawCards(events, duel, side, 1);
    } else if (code === 'heal4_hero') {
      healHero(events, duel, side, 4);
    } else if (code === 'heal3_hero') {
      healHero(events, duel, side, 3);
    } else if (code === 'dmg2_hero') {
      damageHero(events, duel, other, 2, 'gale');
    }
  }

  function fireCombo(events, duel, side, combo) {
    const hero = sideOf(duel, side);
    const other = side === 'player' ? 'ai' : 'player';
    duel.stats.combos += 1;
    state.totals.combos += 1;
    state.duelCombos.push(combo.name);
    events.push({ type: 'combo', name: combo.name, text: combo.text });
    events.push({ type: 'sound', name: 'combo' });
    log(events, `COMBO — ${combo.name}! ${combo.text}`);
    const effect = combo.effect;
    if (effect === 'combo_dmg2_hero') damageHero(events, duel, other, 2, null);
    else if (effect === 'combo_heal5') healHero(events, duel, side, 5);
    else if (effect === 'combo_sprout') summonMinion(events, duel, side, TOKEN_SPROUT.id, false);
    else if (effect === 'combo_draw2') drawCards(events, duel, side, 2);
    else if (effect === 'pair_buff_all_atk1') {
      for (const m of hero.table) m.tempAtk += 1;
    } else if (effect === 'pair_dmg4_hero') damageHero(events, duel, other, 4, null);
    else if (effect === 'pair_armor6') {
      hero.armor += 6;
      floatAt(events, heroTarget(side), '+6 armor', '#9aa7b8');
    } else if (effect === 'pair_draw2_heal3') {
      drawCards(events, duel, side, 2);
      healHero(events, duel, side, 3);
    } else if (effect === 'pair_buff_all_1_1') {
      for (const m of hero.table) { m.atk += 1; m.hp += 1; m.maxHp += 1; }
    } else if (effect === 'pair_dmg3_random_minion') {
      const foes = enemyOf(duel, side).table;
      if (foes.length > 0) {
        const target = foes[Math.floor(random() * foes.length)];
        damageMinion(events, duel, other, target, 3, 'thorn');
      }
    } else if (effect === 'pair_dmg2_all_enemy_minions') {
      for (const m of [...enemyOf(duel, side).table]) damageMinion(events, duel, other, m, 2, 'gale');
    } else if (effect === 'pair_draw1_mana2') {
      drawCards(events, duel, side, 1);
      hero.mana = Math.min(hero.maxMana, hero.mana + 2);
    }
  }

  /** After a side plays a card: check element combos and named pairs for this turn. */
  function checkCombos(events, duel, side, card) {
    const turn = duel.turnState;
    turn.playedElements[card.element] = (turn.playedElements[card.element] ?? 0) + 1;
    turn.playedIds.add(card.id);
    const elementCount = turn.playedElements[card.element];
    const elementCombo = ELEMENT_COMBOS[card.element];
    if (elementCount === 2 && !turn.firedElements.has(card.element)) {
      turn.firedElements.add(card.element);
      fireCombo(events, duel, side, elementCombo);
    }
    for (const pair of PAIR_COMBOS) {
      if (turn.firedPairs.has(pair.name)) continue;
      if (pair.cards.every((id) => turn.playedIds.has(id))) {
        turn.firedPairs.add(pair.name);
        fireCombo(events, duel, side, pair);
      }
    }
    if (duel.over) return;
  }

  function newTurnState() {
    return {
      playedElements: {}, playedIds: new Set(), firedElements: new Set(), firedPairs: new Set(),
    };
  }

  // ---- Playing cards ---------------------------------------------------------

  /** What a card in hand needs before it can be played, as a human sentence or ''. */
  function playBlockReason(duel, side, handCard) {
    const card = cardById(handCard.cardId);
    const hero = sideOf(duel, side);
    if (hero.mana < card.cost) return `Need ${card.cost} mana — you have ${hero.mana}.`;
    if (card.kind === KIND_MINION && hero.table.length >= TABLE_MAX) return 'Your table is full.';
    return '';
  }

  function castSpell(events, duel, side, card, target) {
    const hero = sideOf(duel, side);
    const other = side === 'player' ? 'ai' : 'player';
    const foe = enemyOf(duel, side);
    const effect = card.effect;
    events.push({ type: 'sound', name: 'playCard' });
    log(events, `${hero.name} ${hero.name === 'You' ? 'cast' : 'casts'} ${card.name}.`);
    if (effect === 'buff_friendly_atk2') {
      const minion = findMinion(duel, side, target.uid);
      if (minion) {
        minion.tempAtk += 2;
        floatAt(events, minionTarget(side, minion.uid), '+2 attack', '#f2c94c');
      }
    } else if (effect === 'dmg3_any') {
      if (target.kind === 'hero') damageHero(events, duel, target.side, 3, card.element);
      else damageMinion(events, duel, target.side, findMinion(duel, target.side, target.uid), 3, card.element);
    } else if (effect === 'dmg2_all_enemy_minions') {
      for (const m of [...foe.table]) damageMinion(events, duel, other, m, 2, card.element);
    } else if (effect === 'dmg2_any_draw1') {
      if (target.kind === 'hero') damageHero(events, duel, target.side, 2, card.element);
      else damageMinion(events, duel, target.side, findMinion(duel, target.side, target.uid), 2, card.element);
      drawCards(events, duel, side, 1);
    } else if (effect === 'heal6_hero') {
      healHero(events, duel, side, 6);
    } else if (effect === 'dmg1_freeze_minion') {
      const minion = findMinion(duel, target.side, target.uid);
      if (minion) {
        damageMinion(events, duel, target.side, minion, 1, card.element);
        if (minion.hp > 0) {
          minion.frozenTurns = 1;
          minion.canAttack = false;
          floatAt(events, minionTarget(target.side, minion.uid), 'Frozen', '#8fd0ff');
          events.push({ type: 'sound', name: 'freeze' });
          log(events, `${cardById(minion.cardId).name} is Frozen.`);
        }
      }
    } else if (effect === 'summon_sprout') {
      summonMinion(events, duel, side, TOKEN_SPROUT.id, false);
    } else if (effect === 'dmg2_minion_heal2') {
      const minion = findMinion(duel, target.side, target.uid);
      if (minion) damageMinion(events, duel, target.side, minion, 2, card.element);
      healHero(events, duel, side, 2);
    } else if (effect === 'heal5_draw1') {
      healHero(events, duel, side, 5);
      drawCards(events, duel, side, 1);
    } else if (effect === 'dmg1_any_draw1') {
      if (target.kind === 'hero') damageHero(events, duel, target.side, 1, card.element);
      else damageMinion(events, duel, target.side, findMinion(duel, target.side, target.uid), 1, card.element);
      drawCards(events, duel, side, 1);
    } else if (effect === 'dmg4_minion') {
      const minion = findMinion(duel, target.side, target.uid);
      if (minion) damageMinion(events, duel, target.side, minion, 4, card.element);
    } else if (effect === 'dmg3_all_enemy_minions') {
      for (const m of [...foe.table]) damageMinion(events, duel, other, m, 3, card.element);
    }
  }

  /**
   * Play a card from a hand. `target` is required for targeted spells (see
   * EFFECTS) and ignored otherwise. Returns events; `played` is false when the
   * play was refused (not enough mana, full table, bad target).
   */
  function playCard(events, duel, side, handUid, target) {
    const hero = sideOf(duel, side);
    const index = hero.hand.findIndex((c) => c.uid === handUid);
    if (index === -1) return { played: false, reason: 'That card is not in your hand.' };
    const handCard = hero.hand[index];
    const card = cardById(handCard.cardId);
    const blocked = playBlockReason(duel, side, handCard);
    if (blocked) return { played: false, reason: blocked };
    if (card.kind === KIND_SPELL) {
      const need = EFFECTS[card.effect]?.target ?? 'none';
      if (need !== 'none' && !target) return { played: false, reason: 'needs-target', targetKind: need };
      if (need === 'friendly-minion' && (!target || target.kind !== 'minion' || target.side !== side)) {
        return { played: false, reason: 'Choose one of your minions.' };
      }
      if (need === 'enemy-minion' && (!target || target.kind !== 'minion' || target.side === side)) {
        return { played: false, reason: 'Choose an enemy minion.' };
      }
      if (need === 'any' && !target) return { played: false, reason: 'needs-target', targetKind: 'any' };
    }
    hero.hand.splice(index, 1);
    hero.mana -= card.cost;
    duel.stats.cardsPlayed += 1;
    duel.stats.manaSpent += card.cost;
    state.totals.cardsPlayed += 1;
    // A rival playing something heavy says something about it, half the time.
    if (side === 'ai' && card.cost >= 6 && random() < 0.5) {
      events.push({ type: 'banner', text: `${hero.name}: “${state.opponent.quips[Math.floor(random() * state.opponent.quips.length)]}”`, sub: '' });
    }
    if (card.kind === KIND_MINION) {
      const minion = summonMinion(events, duel, side, card.id, false);
      if (minion) events.push({ type: 'summonAnim', minionUid: minion.uid, side });
      log(events, `${hero.name} ${hero.name === 'You' ? 'play' : 'plays'} ${card.name} (${card.atk}/${card.hp}).`);
      if (minion && card.onPlay) fireTrigger(events, duel, side, card.onPlay);
    } else {
      castSpell(events, duel, side, card, target);
    }
    if (!duel.over) checkCombos(events, duel, side, card);
    return { played: true };
  }

  // ---- Attacks ---------------------------------------------------------------

  /** Why a minion cannot attack a target, as a human sentence or ''. */
  function attackBlockReason(duel, side, attackerUid, target) {
    const attacker = findMinion(duel, side, attackerUid);
    if (!attacker) return 'That minion is gone.';
    if (!attacker.canAttack) return attacker.frozenTurns > 0 ? 'That minion is Frozen.' : 'That minion cannot attack yet.';
    if (target.kind === 'hero' && target.side === side) return 'You cannot attack yourself.';
    if (target.kind === 'minion' && target.side === side) return 'You cannot attack your own minion.';
    const foeTable = enemyOf(duel, side).table;
    if (target.kind === 'hero' && foeTable.some((m) => m.taunt)) {
      return 'A Taunt minion guards the hero — attack it first.';
    }
    if (target.kind === 'minion') {
      const victim = findMinion(duel, target.side, target.uid);
      if (!victim) return 'That minion is gone.';
      if (foeTable.some((m) => m.taunt) && !victim.taunt) {
        return 'A Taunt minion must be attacked first.';
      }
    }
    return '';
  }

  function attack(events, duel, side, attackerUid, target) {
    const blocked = attackBlockReason(duel, side, attackerUid, target);
    if (blocked) return { done: false, reason: blocked };
    const attacker = findMinion(duel, side, attackerUid);
    const attackerCard = cardById(attacker.cardId);
    const power = attacker.atk + attacker.tempAtk;
    attacker.canAttack = false;
    events.push({ type: 'attackAnim', attackerUid, side, target });
    if (target.kind === 'hero') {
      log(events, `${attackerCard.name} strikes ${sideOf(duel, target.side).name} for ${power}.`);
      damageHero(events, duel, target.side, power, attackerCard.element);
    } else {
      const victim = findMinion(duel, target.side, target.uid);
      const victimCard = cardById(victim.cardId);
      const victimPower = victim.atk + victim.tempAtk;
      log(events, `${attackerCard.name} (${power}) attacks ${victimCard.name} (${victimPower}).`);
      // The attacker hits first; the victim strikes back only if it survives.
      damageMinion(events, duel, target.side, victim, power, attackerCard.element);
      if (!duel.over && victim.hp > 0 && attacker.hp > 0) {
        damageMinion(events, duel, side, attacker, victimPower, victimCard.element);
      }
    }
    return { done: true };
  }

  // ---- Turns -----------------------------------------------------------------

  function startTurn(events, duel, side) {
    const hero = sideOf(duel, side);
    duel.turn = side;
    if (side === 'player') duel.turnNumber += 1;
    duel.turnState = newTurnState();
    hero.maxMana = Math.min(MANA.max, hero.maxMana + MANA.perTurn);
    hero.mana = hero.maxMana;
    for (const m of hero.table) {
      m.tempAtk = 0;
      if (m.frozenTurns > 0) {
        m.frozenTurns -= 1;
        m.canAttack = m.frozenTurns === 0;
      } else {
        m.canAttack = true;
      }
      m.justPlayed = false;
    }
    duel.selection = { handUid: null, attackerUid: null, pendingTarget: null };
    events.push({ type: 'turn', side });
    if (side === 'player') events.push({ type: 'sound', name: 'turn' });
    drawCards(events, duel, side, DRAW.perTurn);
    if (!duel.over) log(events, `${hero.name}'s turn — ${hero.mana} mana, ${hero.hand.length} cards in hand.`);
  }

  function endTurn(events, duel) {
    if (duel.over || duel.turn !== 'player') return events;
    duel.turn = 'ai';
    duel.turnState = newTurnState();
    state.totals.turns += 1;
    duel.stats.turns += 1;
    log(events, 'You end your turn.');
    // The rival's turn begins properly: fresh mana, a drawn card, rested minions.
    startTurn(events, duel, 'ai');
    if (!duel.over) planAiTurn(events, duel);
    return events;
  }

  // ---- The AI ----------------------------------------------------------------
  //
  // The rival plays one action per tick (the main loop calls aiStep on a timer),
  // so its turn reads as a turn instead of a flash. Before the first action, the
  // engine writes a tell: what the rival is about to do, in plain words, so the
  // player can read the threat and answer it. The AI is greedy but honest: it
  // plays what it can afford, trades when its profile says to, and goes for the
  // hero when its aggression roll says so. It never sees the player's hand.

  function planAiTurn(events, duel) {
    const ai = duel.ai;
    const player = duel.player;
    const queue = [];
    const mana = { value: ai.mana };
    const table = [...ai.table];
    const hand = [...ai.hand];
    const profile = state.opponent;

    // Play cards: big minions first, then spells, then cheap fillers — but only
    // while the mana lasts, and only while the table has room for minions.
    const playable = hand
      .map((c) => ({ handCard: c, card: cardById(c.cardId) }))
      .filter(({ card }) => card.cost <= mana.value)
      .sort((a, b) => b.card.cost - a.card.cost);
    for (const { handCard, card } of playable) {
      if (mana.value < card.cost) continue;
      if (card.kind === KIND_MINION) {
        if (table.length >= TABLE_MAX) continue;
        queue.push({ kind: 'play', handUid: handCard.uid, target: null });
        table.push(card);
        mana.value -= card.cost;
      } else {
        const spell = planSpellTarget(duel, card, profile);
        if (!spell) continue;
        queue.push({ kind: 'play', handUid: handCard.uid, target: spell });
        mana.value -= card.cost;
      }
    }

    // Attacks: each ready minion picks a target. Taunts must be answered first.
    const taunts = player.table.filter((m) => m.taunt);
    for (const minion of [...ai.table]) {
      if (!minion.canAttack) continue;
      if (minion.frozenTurns > 0) continue;
      const card = cardById(minion.cardId);
      const power = minion.atk + minion.tempAtk;
      let target = null;
      if (taunts.length > 0) {
        target = minionTarget('player', taunts[0].uid);
      } else if (random() < profile.aggression || player.hp <= power) {
        target = heroTarget('player');
      } else if (player.table.length > 0) {
        // Trade into the weakest enemy minion we can kill, else the weakest one.
        const sorted = [...player.table].sort((a, b) => (a.hp - b.hp) || (a.atk - b.atk));
        const killable = sorted.find((m) => m.hp <= power);
        target = minionTarget('player', (killable ?? sorted[0]).uid);
      } else {
        target = heroTarget('player');
      }
      if (target) queue.push({ kind: 'attack', attackerUid: minion.uid, target });
    }

    duel.aiQueue = queue;
    duel.aiStepIndex = 0;
    state.aiTell = makeTell(duel, queue);
    events.push({ type: 'tell', text: state.aiTell, seconds: 1.4 });
    log(events, `${ai.name} is thinking… ${state.aiTell}`);
  }

  function makeTell(duel, queue) {
    const plays = queue.filter((a) => a.kind === 'play');
    const bigPlay = plays.find((a) => {
      const card = cardById(duel.ai.hand.find((c) => c.uid === a.handUid)?.cardId ?? '');
      return card && card.cost >= 5;
    });
    if (bigPlay) {
      const card = cardById(duel.ai.hand.find((c) => c.uid === bigPlay.handUid).cardId);
      return `${duel.ai.name} hefts a heavy card — ${card.name} (${card.cost} mana) is coming.`;
    }
    const spell = plays.find((a) => cardById(duel.ai.hand.find((c) => c.uid === a.handUid)?.cardId ?? '')?.kind === KIND_SPELL);
    if (spell) return `${duel.ai.name} is lining up a spell. Watch your minions.`;
    if (queue.some((a) => a.kind === 'attack' && a.target.kind === 'hero')) {
      return `${duel.ai.name} leans forward — an attack on your hero is coming.`;
    }
    return state.opponent.tell;
  }

  /** Pick a target for an AI spell, or null when the spell is not worth casting. */
  function planSpellTarget(duel, card, profile) {
    const player = duel.player;
    const effect = EFFECTS[card.effect];
    if (!effect) return null;
    const need = effect.target;
    if (need === 'none') {
      if (card.effect === 'heal6_hero' || card.effect === 'heal5_draw1') {
        if (duel.ai.hp >= duel.ai.maxHp - 1) return null;
        return { kind: 'none' };
      }
      if (card.effect === 'summon_sprout') {
        return duel.ai.table.length < TABLE_MAX ? { kind: 'none' } : null;
      }
      if (card.effect === 'dmg2_all_enemy_minions' || card.effect === 'dmg3_all_enemy_minions') {
        return player.table.length > 0 ? { kind: 'none' } : null;
      }
      return { kind: 'none' };
    }
    if (need === 'friendly-minion') {
      const best = [...duel.ai.table].sort((a, b) => (b.atk - a.atk))[0];
      return best ? minionTarget('ai', best.uid) : null;
    }
    if (need === 'enemy-minion') {
      if (player.table.length === 0) return null;
      // Hold removal for a big threat when the profile says so; otherwise take the
      // biggest minion on the table.
      const sorted = [...player.table].sort((a, b) => (b.atk + b.hp) - (a.atk + a.hp));
      const biggest = sorted[0];
      if (profile.holdsRemoval && biggest.atk + biggest.hp < 7 && card.effect === 'dmg4_minion') return null;
      return minionTarget('player', biggest.uid);
    }
    if (need === 'any') {
      // Burn goes to the hero when it is lethal or late; otherwise to the biggest minion.
      if (card.effect === 'dmg3_any' || card.effect === 'dmg2_any_draw1') {
        const burn = card.effect === 'dmg3_any' ? 3 : 2;
        if (player.hp <= burn) return heroTarget('player');
        if (player.table.length > 0 && random() < 0.6) {
          const biggest = [...player.table].sort((a, b) => (b.atk + b.hp) - (a.atk + a.hp))[0];
          return minionTarget('player', biggest.uid);
        }
        return heroTarget('player');
      }
      return heroTarget('player');
    }
    return null;
  }

  /** Run the AI's next queued action. Returns true while actions remain. */
  function aiStep(events, duel) {
    if (duel.over) return false;
    if (duel.aiStepIndex >= duel.aiQueue.length) {
      // The AI is done: the player's next turn begins.
      startTurn(events, duel, 'player');
      return false;
    }
    const action = duel.aiQueue[duel.aiStepIndex];
    duel.aiStepIndex += 1;
    if (action.kind === 'play') {
      const result = playCard(events, duel, 'ai', action.handUid, action.target);
      if (!result.played && result.reason === 'needs-target') {
        // The planned target vanished; play it untargeted where the spell allows.
        playCard(events, duel, 'ai', action.handUid, null);
      }
    } else if (action.kind === 'attack') {
      attack(events, duel, 'ai', action.attackerUid, action.target);
    }
    return duel.aiStepIndex < duel.aiQueue.length;
  }

  // ---- Duel lifecycle ----------------------------------------------------------

  function startDuel(events, opponent, mode, round) {
    const hero = { name: PLAYER_HERO.name, title: PLAYER_HERO.title, element: PLAYER_HERO.element, hp: HERO_HP };
    const rival = {
      name: opponent.name, title: opponent.title, element: opponent.element,
      hp: HERO_HP + opponent.hpBonus,
    };
    const duel = {
      mode, round, opponent,
      turn: 'player', turnNumber: 1, over: false, winner: null,
      player: makeSide(hero, PLAYER_DECK, random),
      ai: makeSide(rival, RIVAL_DECKS[opponent.deck], random),
      turnState: newTurnState(),
      selection: { handUid: null, attackerUid: null, pendingTarget: null },
      aiQueue: [], aiStepIndex: 0,
      log: [],
      stats: { cardsPlayed: 0, combos: 0, damageDealt: 0, minions: 0, turns: 1, manaSpent: 0, biggestHit: 0 },
    };
    state.duel = duel;
    state.duelCombos = [];
    state.aiTell = '';
    drawCards(events, duel, 'player', DRAW.opening);
    drawCards(events, duel, 'ai', DRAW.opening + 1);
    duel.player.maxMana = MANA.start;
    duel.player.mana = MANA.start;
    duel.ai.maxMana = MANA.start;
    duel.ai.mana = MANA.start;
    // The mulligan: before the first turn, the player may send back any of the
    // opening hand and draw replacements. The rival does the same, quietly,
    // sending back anything that costs 5 or more.
    duel.mulligan = { active: true, selected: new Set() };
    const aiRedraw = duel.ai.hand.filter((c) => cardById(c.cardId).cost >= 5).slice(0, 2);
    for (const card of aiRedraw) {
      const index = duel.ai.hand.indexOf(card);
      duel.ai.hand.splice(index, 1);
      duel.ai.deck.push(card);
    }
    if (aiRedraw.length > 0) {
      duel.ai.deck = shuffle(duel.ai.deck, random);
      drawCards(events, duel, 'ai', aiRedraw.length);
      log(events, `${opponent.name} sends back ${aiRedraw.length} heavy card${aiRedraw.length > 1 ? 's' : ''} and draws again.`);
    }
    state.phase = 'duel';
    log(events, `${opponent.name} ${opponent.title} sits across the table. "${opponent.taunt}"`);
    log(events, `Round ${round} — first to 0 life loses. Your turn: ${MANA.start} mana.`);
    events.push({ type: 'banner', text: `Round ${round}: ${opponent.name}`, sub: opponent.taunt });
    return events;
  }

  function endDuel(events, duel, winner) {
    if (duel.over) return;
    duel.over = true;
    duel.winner = winner;
    duel.turn = 'done';
    if (winner === 'player') {
      events.push({ type: 'sound', name: state.mode === 'campaign' && state.round >= CAMPAIGN_ROUNDS ? 'crown' : state.mode === 'campaign' ? 'roundWin' : 'win' });
      if (state.mode === 'campaign') {
        state.campaignWins += 1;
        state.totals.roundsWon += 1;
        if (state.campaignWins > state.best) state.best = state.campaignWins;
      }
      log(events, `You win the duel against ${duel.opponent.name}!`);
    } else {
      events.push({ type: 'sound', name: 'lose' });
      log(events, `${duel.opponent.name} wins the duel.`);
    }
    events.push({ type: 'gameover', winner });
  }

  // ---- Public API --------------------------------------------------------------

  return {
    state,
    get duel() { return state.duel; },

    /** The twelve combos, for the How to Play screen. */
    combos: ALL_COMBOS,

    newCampaign() {
      const events = [];
      state.mode = 'campaign';
      state.round = 1;
      state.campaignWins = 0;
      state.totals = { cardsPlayed: 0, combos: 0, damageDealt: 0, minions: 0, turns: 0, roundsWon: 0 };
      state.opponent = OPPONENTS[0];
      state.phase = 'map';
      return events;
    },

    /** A demo duel: the engine plays both sides while the player watches. */
    startDemo() {
      const events = [];
      state.mode = 'demo';
      state.opponent = quickDuelOpponent(random);
      state.round = 1;
      startDuel(events, state.opponent, 'demo', 1);
      return events;
    },

    newQuickDuel() {
      const events = [];
      state.mode = 'quick';
      state.opponent = quickDuelOpponent(random);
      state.round = 1;
      return startDuel(events, state.opponent, 'quick', 1);
    },

    startRound(round) {
      const events = [];
      state.mode = 'campaign';
      state.round = round;
      state.opponent = OPPONENTS[round - 1];
      return startDuel(events, state.opponent, 'campaign', round);
    },

    toTitle() {
      state.phase = 'title';
      state.duel = null;
      return [];
    },

    toMap() {
      state.phase = 'map';
      state.duel = null;
      return [];
    },

    showHowto() { state.phase = 'howto'; return []; },
    hideHowto() { state.phase = state.duel ? 'duel' : 'title'; return []; },

    /** The Collection: every card and combo, browsable from the title screen. */
    showCollection() {
      state.collectionReturn = state.phase === 'duel' ? 'duel' : 'title';
      state.phase = 'collection';
      return [];
    },

    hideCollection() {
      state.phase = state.collectionReturn === 'duel' && state.duel ? 'duel' : 'title';
      return [];
    },

    setCollectionFilter(element) {
      state.collectionFilter = element;
      state.collectionCard = null;
      return [];
    },

    selectCollectionCard(cardId) {
      state.collectionCard = state.collectionCard === cardId ? null : cardId;
      return [];
    },

    pause() {
      if (state.phase === 'duel') state.phase = 'paused';
      return [];
    },

    resume() {
      if (state.phase === 'paused') state.phase = 'duel';
      return [];
    },

    /** Click a card in the player's hand. */
    selectHandCard(handUid) {
      const events = [];
      const duel = state.duel;
      if (!duel || duel.over || duel.turn !== 'player') return events;
      if (duel.mulligan && duel.mulligan.active) {
        log(events, 'Finish the mulligan first — click CONFIRM when your hand is set.');
        return events;
      }
      const handCard = duel.player.hand.find((c) => c.uid === handUid);
      if (!handCard) return events;
      const card = cardById(handCard.cardId);
      const blocked = playBlockReason(duel, 'player', handCard);
      if (blocked) {
        events.push({ type: 'sound', name: 'error' });
        log(events, blocked);
        return events;
      }
      if (card.kind === KIND_MINION) {
        const result = playCard(events, duel, 'player', handUid, null);
        if (!result.played) {
          events.push({ type: 'sound', name: 'error' });
          log(events, result.reason);
        }
        duel.selection = { handUid: null, attackerUid: null, pendingTarget: null };
        return events;
      }
      // A spell: no-target spells cast at once; targeted ones wait for a target.
      const need = EFFECTS[card.effect]?.target ?? 'none';
      if (need === 'none') {
        const result = playCard(events, duel, 'player', handUid, null);
        if (!result.played) {
          events.push({ type: 'sound', name: 'error' });
          log(events, result.reason);
        }
        duel.selection = { handUid: null, attackerUid: null, pendingTarget: null };
        return events;
      }
      duel.selection = { handUid, attackerUid: null, pendingTarget: need };
      log(events, `${card.name}: choose ${need === 'friendly-minion' ? 'one of your minions' : need === 'enemy-minion' ? 'an enemy minion' : 'a target'}. Right-click to cancel.`);
      return events;
    },

    /** Click one of the player's minions on the table: select it to attack. */
    selectAttacker(minionUid) {
      const events = [];
      const duel = state.duel;
      if (!duel || duel.over || duel.turn !== 'player') return events;
      const minion = findMinion(duel, 'player', minionUid);
      if (!minion) return events;
      if (duel.selection.pendingTarget) {
        // A spell is waiting for a friendly minion: this click is its target.
        return this.chooseTarget({ kind: 'minion', side: 'player', uid: minionUid });
      }
      if (!minion.canAttack) {
        events.push({ type: 'sound', name: 'error' });
        log(events, minion.frozenTurns > 0 ? 'That minion is Frozen.' : 'That minion cannot attack yet — it just arrived.');
        return events;
      }
      duel.selection = { handUid: null, attackerUid: minionUid, pendingTarget: null };
      return events;
    },

    /** Click a target while a spell or an attack is waiting for one. */
    chooseTarget(target) {
      const events = [];
      const duel = state.duel;
      if (!duel || duel.over || duel.turn !== 'player') return events;
      const sel = duel.selection;
      if (sel.pendingTarget) {
        const handUid = sel.handUid;
        duel.selection = { handUid: null, attackerUid: null, pendingTarget: null };
        const result = playCard(events, duel, 'player', handUid, target);
        if (!result.played) {
          events.push({ type: 'sound', name: 'error' });
          log(events, result.reason);
        }
        return events;
      }
      if (sel.attackerUid !== null) {
        const attackerUid = sel.attackerUid;
        duel.selection = { handUid: null, attackerUid: null, pendingTarget: null };
        const result = attack(events, duel, 'player', attackerUid, target);
        if (!result.done) {
          events.push({ type: 'sound', name: 'error' });
          log(events, result.reason);
        }
        return events;
      }
      return events;
    },

    /** Click the rival hero: a target for a waiting spell or attack. */
    clickRivalHero() {
      return this.chooseTarget(heroTarget('ai'));
    },

    /** Click an enemy minion: a target for a waiting spell or attack. */
    clickRivalMinion(minionUid) {
      return this.chooseTarget(minionTarget('ai', minionUid));
    },

    cancelSelection() {
      const duel = state.duel;
      if (duel) duel.selection = { handUid: null, attackerUid: null, pendingTarget: null };
      return [];
    },

    endTurn() {
      const events = [];
      const duel = state.duel;
      if (!duel || duel.over || duel.turn !== 'player') return events;
      if (duel.mulligan && duel.mulligan.active) {
        log(events, 'Finish the mulligan first — click CONFIRM when your hand is set.');
        return events;
      }
      duel.selection = { handUid: null, attackerUid: null, pendingTarget: null };
      return endTurn(events, duel);
    },

    /** The mulligan: mark an opening-hand card to send back, or unmark it. */
    mulliganToggle(handUid) {
      const events = [];
      const duel = state.duel;
      if (!duel || !duel.mulligan || !duel.mulligan.active) return events;
      const selected = duel.mulligan.selected;
      if (selected.has(handUid)) selected.delete(handUid);
      else selected.add(handUid);
      events.push({ type: 'sound', name: 'click' });
      return events;
    },

    /** The mulligan: send the marked cards back, draw replacements, begin. */
    mulliganConfirm() {
      const events = [];
      const duel = state.duel;
      if (!duel || !duel.mulligan || !duel.mulligan.active) return events;
      const selected = duel.mulligan.selected;
      const count = selected.size;
      if (count > 0) {
        const kept = [];
        for (const card of duel.player.hand) {
          if (selected.has(card.uid)) duel.player.deck.push(card);
          else kept.push(card);
        }
        duel.player.hand = kept;
        duel.player.deck = shuffle(duel.player.deck, random);
        drawCards(events, duel, 'player', count);
        log(events, `You send back ${count} card${count > 1 ? 's' : ''} and draw ${count} again.`);
      } else {
        log(events, 'You keep your opening hand.');
      }
      duel.mulligan.active = false;
      duel.mulligan.selected = new Set();
      if (count > 0) events.push({ type: 'sound', name: 'shuffle' });
      events.push({ type: 'banner', text: `Round ${duel.round}: ${duel.opponent.name}`, sub: duel.opponent.taunt });
      return events;
    },

    /** Advance the AI's turn by one action; true while it still has actions. */
    aiStep() {
      const events = [];
      const duel = state.duel;
      if (!duel || duel.over) return { events, more: false };
      const more = aiStep(events, duel);
      return { events, more };
    },

    /** Is the AI mid-turn and ready for its next action? */
    get aiWaiting() {
      const duel = state.duel;
      return !!duel && !duel.over && duel.turn === 'ai' && duel.aiStepIndex < duel.aiQueue.length;
    },

    /** The duel is over: move to the right end screen. */
    finishDuel() {
      const duel = state.duel;
      if (!duel || !duel.over) return [];
      if (duel.winner === 'player') {
        if (state.mode === 'campaign' && state.round >= CAMPAIGN_ROUNDS) state.phase = 'win';
        else if (state.mode === 'campaign') state.phase = 'roundwin';
        else state.phase = 'win';
      } else {
        state.phase = 'lose';
      }
      return [];
    },

    /** After a round win: on to the next rival. */
    nextRound() {
      if (state.round >= CAMPAIGN_ROUNDS) return this.toTitle();
      return this.startRound(state.round + 1);
    },

    /** After a loss: retry the same round. */
    retryRound() {
      return this.startRound(state.round);
    },

    /** Give up the duel: the rival takes the round. */
    concede() {
      const events = [];
      const duel = state.duel;
      if (!duel || duel.over) return events;
      log(events, 'You concede the duel.');
      endDuel(events, duel, 'ai');
      return events;
    },

    // Exposed for the screenshot stager and the playtest, nothing else.
    _test: { playCard, attack, startTurn, endDuel, damageHero },
  };
}
