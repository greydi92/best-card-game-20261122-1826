// Boot and the one loop: input is read every frame, engine events are drained
// into sounds, banners, floating numbers and log lines, the AI steps on a timer
// so its turn reads as a turn, and the renderer paints what is there. The game
// moves between eight screens: title, campaign map, duel, paused, how to play,
// round win, crown win and loss.
//
// ?seed=N fixes the shuffle. ?shot=start|play|win|lose (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
//
// The loop also keeps a test hook, window.__emberCourt, with the live state and a
// few helpers the playtest uses; it changes nothing about the game.

import { AI_PACE_MS, BEST_KEY, FIELD, STEP, TELL_SECONDS } from './config.js';
import { ACHIEVEMENTS, OPPONENTS } from './cards.js';
import { createAudio } from './audio.js';
import { createEngine } from './engine.js';
import { createInput, ACTION_CANCEL, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import { createRandom } from './random.js';
import { createRenderer } from './render.js';
import { autopilotTurn, stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const engine = createEngine(createRandom(seed), audio);
const renderer = createRenderer(canvas);

// Transient overlays the renderer reads each frame. Floats resolve their target
// to pixels through the last layout the renderer returned; anims are the combat
// lunges and summon rings, each with a birth time the renderer ages out.
const ui = {
  floats: [], // {x, y, text, color, born}
  anims: [], // {kind:'attack'|'summon', attackerUid|minionUid, side, target, born}
  tell: '', tellUntil: 0,
  banner: null, bannerUntil: 0,
  shakeUntil: 0, shakeMag: 0,
  opponents: OPPONENTS,
  titleButtons: null, mapButtons: null, howtoButtons: null, endButtons: null, pausedButtons: null,
  collectionButtons: null, collectionCards: null,
};

/** Court records: the last 10 duel results, kept in this browser. */
const HISTORY_KEY = 'ember-court.history';

function readHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-10) : [];
  } catch {
    return [];
  }
}

function recordHistory(result, opponent, round) {
  const history = readHistory();
  history.push({ result, opponent, round, at: Date.now() });
  const kept = history.slice(-10);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(kept));
  } catch {
    // Storage can be off: the records then last this visit only.
  }
  engine.state.history = kept;
}

/** Lifetime totals: every duel this browser has ever played. */
const LIFETIME_KEY = 'ember-court.lifetime';

function readLifetime() {
  try {
    const raw = window.localStorage.getItem(LIFETIME_KEY);
    if (!raw) return { duels: 0, wins: 0, combos: 0 };
    const parsed = JSON.parse(raw);
    return { duels: parsed.duels ?? 0, wins: parsed.wins ?? 0, combos: parsed.combos ?? 0 };
  } catch {
    return { duels: 0, wins: 0, combos: 0 };
  }
}

function recordLifetime(winner, combos) {
  const lifetime = readLifetime();
  lifetime.duels += 1;
  if (winner === 'player') lifetime.wins += 1;
  lifetime.combos += combos;
  try {
    window.localStorage.setItem(LIFETIME_KEY, JSON.stringify(lifetime));
  } catch {
    // Storage can be off.
  }
  engine.state.lifetime = lifetime;
}

/** Music on/off, kept in this browser. */
const MUSIC_KEY = 'ember-court.music';

function readMusicOn() {
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== '0';
  } catch {
    return true;
  }
}

function toggleMusic() {
  const on = !readMusicOn();
  try {
    window.localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  } catch {
    // Storage can be off.
  }
  engine.state.musicOn = on;
  audio.setMusicEnabled(on);
  if (on) audio.startMusic();
  return on;
}
const ACHIEVEMENT_KEY = 'ember-court.achievements';

function readAchievements() {
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function unlockAchievement(id) {
  const unlocked = readAchievements();
  if (unlocked.includes(id)) return null;
  unlocked.push(id);
  try {
    window.localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(unlocked));
  } catch {
    // Storage can be off.
  }
  engine.state.achievements = unlocked;
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

/** Which achievements this duel just earned, if any. */
function checkAchievements(duel) {
  const earned = [];
  if (duel.winner === 'player') {
    const first = unlockAchievement('first-win');
    if (first) earned.push(first);
    if (engine.state.mode === 'campaign' && engine.state.round >= 5) {
      const crown = unlockAchievement('crown');
      if (crown) earned.push(crown);
    }
    if (duel.player.hp >= duel.player.maxHp) {
      const clean = unlockAchievement('untouchable');
      if (clean) earned.push(clean);
    }
    if (duel.player.hp <= 5) {
      const comeback = unlockAchievement('comeback');
      if (comeback) earned.push(comeback);
    }
  }
  if (duel.stats.combos >= 3) {
    const combo = unlockAchievement('combo3');
    if (combo) earned.push(combo);
  }
  if (readHistory().length >= 5) {
    const regular = unlockAchievement('regular');
    if (regular) earned.push(regular);
  }
  return earned;
}

let layout = null;
let lastAiStepAt = 0;
let aiTellShownAt = 0;
let gameOverAt = 0;
let announcedPhase = '';
let lastDemoStepAt = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

engine.state.best = readBest();
engine.state.history = readHistory();
engine.state.achievements = readAchievements();
engine.state.lifetime = readLifetime();
engine.state.musicOn = readMusicOn();
engine.state.seed = seed;
audio.setMusicEnabled(engine.state.musicOn);

// Screen readers (and anyone watching the page's text) hear the screen changes.
function announce(message) {
  status.textContent = message;
}

/** Turn one engine event into its sound, banner, float or log line. */
function applyEvent(event) {
  const duel = engine.duel;
  if (event.type === 'log') {
    if (duel) {
      duel.log.push(event.text);
      if (duel.log.length > 200) duel.log.splice(0, duel.log.length - 200);
    }
    return;
  }
  if (event.type === 'sound') {
    if (audio[event.name]) audio[event.name]();
    return;
  }
  if (event.type === 'float') {
    const point = resolveTarget(event.target);
    if (point) ui.floats.push({ x: point.x, y: point.y, text: event.text, color: event.color, born: performance.now() });
    return;
  }
  if (event.type === 'combo') {
    ui.banner = { text: `COMBO — ${event.name}`, sub: event.text };
    ui.bannerUntil = performance.now() + 2400;
    return;
  }
  if (event.type === 'banner') {
    ui.banner = { text: event.text, sub: event.sub ?? '' };
    ui.bannerUntil = performance.now() + 2600;
    return;
  }
  if (event.type === 'tell') {
    ui.tell = event.text;
    ui.tellUntil = performance.now() + (event.seconds ?? TELL_SECONDS) * 1000;
    aiTellShownAt = performance.now();
    return;
  }
  if (event.type === 'shake') {
    ui.shakeMag = event.mag;
    ui.shakeUntil = performance.now() + 320;
    return;
  }
  if (event.type === 'attackAnim') {
    ui.anims.push({ kind: 'attack', attackerUid: event.attackerUid, side: event.side, target: event.target, born: performance.now() });
    return;
  }
  if (event.type === 'summonAnim') {
    ui.anims.push({ kind: 'summon', minionUid: event.minionUid, side: event.side, born: performance.now() });
    return;
  }
  if (event.type === 'turn') {
    if (event.side === 'ai') {
      lastAiStepAt = 0;
      aiTellShownAt = 0;
    }
    return;
  }
  if (event.type === 'gameover') {
    gameOverAt = performance.now();
  }
}

function applyEvents(events) {
  for (const event of events) applyEvent(event);
}

/** Where a float's target lives on the table, in logical pixels. */
function resolveTarget(target) {
  if (!layout) return null;
  if (target.kind === 'hero') {
    const rect = target.side === 'player' ? layout.playerHero : layout.aiHero;
    if (!rect) return null;
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }
  const rects = target.side === 'player' ? layout.playerMinions : layout.aiMinions;
  const rect = rects.find((r) => r.uid === target.uid);
  if (!rect) return null;
  return { x: rect.x + rect.w / 2, y: rect.y + 8 };
}

// ---- Clicks ---------------------------------------------------------------------

function clickTitle(x, y, input) {
  const buttons = ui.titleButtons;
  if (!buttons) return;
  if (input.inside(x, y, buttons.campaign)) {
    audio.unlock();
    audio.click();
    applyEvents(engine.newCampaign());
    announce('Campaign map. Five courts stand between you and the Crown.');
  } else if (input.inside(x, y, buttons.quick)) {
    audio.unlock();
    audio.click();
    applyEvents(engine.newQuickDuel());
    announce(`Quick duel against ${engine.state.opponent.name}. Your turn.`);
  } else if (input.inside(x, y, buttons.howto)) {
    audio.click();
    applyEvents(engine.showHowto());
    announce('How to play.');
  } else if (input.inside(x, y, buttons.collection)) {
    audio.click();
    applyEvents(engine.showCollection());
    announce('The Collection. Forty cards and their lore.');
  } else if (input.inside(x, y, buttons.demo)) {
    audio.unlock();
    audio.click();
    applyEvents(engine.startDemo());
    announce('Demo duel. The engine plays both sides — click anywhere to stop watching.');
  } else if (input.inside(x, y, buttons.music)) {
    const on = toggleMusic();
    announce(on ? 'Music on.' : 'Music off.');
  }
}

function clickCollection(x, y, input) {
  const buttons = ui.collectionButtons;
  if (buttons) {
    if (input.inside(x, y, buttons.back)) {
      audio.click();
      applyEvents(engine.hideCollection());
      return;
    }
    for (const [element, rect] of Object.entries(buttons.filters)) {
      if (input.inside(x, y, rect)) {
        audio.click();
        applyEvents(engine.setCollectionFilter(element));
        return;
      }
    }
  }
  for (const rect of ui.collectionCards ?? []) {
    if (input.inside(x, y, rect)) {
      audio.click();
      applyEvents(engine.selectCollectionCard(rect.cardId));
      return;
    }
  }
}

function clickMap(x, y, input) {
  const buttons = ui.mapButtons;
  if (buttons && input.inside(x, y, buttons.fight)) {
    audio.unlock();
    audio.click();
    applyEvents(engine.startRound(engine.state.round));
    announce(`Round ${engine.state.round} against ${engine.state.opponent.name}. Your turn.`);
  }
}

function clickHowto(x, y, input) {
  const buttons = ui.howtoButtons;
  if (buttons && input.inside(x, y, buttons.back)) {
    audio.click();
    applyEvents(engine.hideHowto());
    announce('Back.');
  }
}

function clickEnd(x, y, input) {
  const buttons = ui.endButtons;
  if (!buttons) return;
  if (input.inside(x, y, buttons.primary)) {
    audio.click();
    const action = buttons.primary.action;
    if (action === 'next') applyEvents(engine.nextRound());
    else if (action === 'again') applyEvents(engine.newCampaign());
    else if (action === 'retry') applyEvents(engine.retryRound());
    else if (action === 'rematch') applyEvents(engine.newQuickDuel());
  } else if (input.inside(x, y, buttons.secondary)) {
    audio.click();
    const action = buttons.secondary.action;
    if (action === 'title') applyEvents(engine.toTitle());
    else if (action === 'quick') applyEvents(engine.newQuickDuel());
  }
}

function clickDuel(x, y, input, button) {
  const duel = engine.duel;
  if (!duel || duel.over) return;
  if (button === 2) {
    applyEvents(engine.cancelSelection());
    return;
  }
  // The mulligan owns every click until it is confirmed.
  if (duel.mulligan && duel.mulligan.active && ui.mulligan) {
    for (const rect of ui.mulligan.cards) {
      if (input.inside(x, y, rect)) {
        applyEvents(engine.mulliganToggle(rect.uid));
        return;
      }
    }
    if (input.inside(x, y, ui.mulligan.redraw) || input.inside(x, y, ui.mulligan.keep)) {
      applyEvents(engine.mulliganConfirm());
      return;
    }
    return;
  }
  // End Turn button.
  if (layout.endTurn && input.inside(x, y, layout.endTurn)) {
    if (duel.turn === 'player') applyEvents(engine.endTurn());
    return;
  }
  // Surrender, under the End Turn button.
  if (layout.surrender && input.inside(x, y, layout.surrender)) {
    applyEvents(engine.concede());
    return;
  }
  // Help, top right of the table: the rules, without leaving the duel.
  if (layout.help && input.inside(x, y, layout.help)) {
    audio.click();
    applyEvents(engine.showHowto());
    announce('How to play. Back returns to the duel.');
    return;
  }
  // The player's hand: a click plays the card (or arms a targeted spell).
  for (const rect of layout.handCards) {
    if (input.inside(x, y, rect)) {
      audio.unlock();
      applyEvents(engine.selectHandCard(rect.uid));
      return;
    }
  }
  // The player's minions: a click selects an attacker (or answers a spell).
  for (const rect of layout.playerMinions) {
    if (input.inside(x, y, rect)) {
      applyEvents(engine.selectAttacker(rect.uid));
      return;
    }
  }
  // The rival hero: a target for a waiting spell or attack.
  if (layout.aiHero && input.inside(x, y, layout.aiHero)) {
    applyEvents(engine.clickRivalHero());
    return;
  }
  // Rival minions: targets for a waiting spell or attack.
  for (const rect of layout.aiMinions) {
    if (input.inside(x, y, rect)) {
      applyEvents(engine.clickRivalMinion(rect.uid));
      return;
    }
  }
}

function clickPaused(x, y, input) {
  const buttons = ui.pausedButtons;
  if (!buttons) return;
  if (input.inside(x, y, buttons.resume)) {
    audio.click();
    applyEvents(engine.resume());
  } else if (input.inside(x, y, buttons.restart)) {
    audio.click();
    applyEvents(engine.retryRound());
    announce('Fresh deck, same rival.');
  } else if (input.inside(x, y, buttons.quit)) {
    audio.click();
    applyEvents(engine.toTitle());
    announce('Back at the title.');
  }
}

function handleClick(x, y, button, input) {
  const phase = engine.state.phase;
  if (phase === 'title') clickTitle(x, y, input);
  else if (phase === 'map') clickMap(x, y, input);
  else if (phase === 'howto') clickHowto(x, y, input);
  else if (phase === 'collection') clickCollection(x, y, input);
  else if (phase === 'duel') clickDuel(x, y, input, button);
  else if (phase === 'paused') clickPaused(x, y, input);
  else if (phase === 'roundwin' || phase === 'win' || phase === 'lose') clickEnd(x, y, input);
}

// ---- The loop ---------------------------------------------------------------------

const input = createInput(canvas, {
  onPointerDown(point, button) {
    audio.unlock();
    // A demo ends the moment the watcher touches the table.
    if (engine.state.mode === 'demo' && engine.state.phase === 'duel') {
      applyEvents(engine.toTitle());
      announce('Back at the title.');
      return;
    }
    handleClick(point.x, point.y, button, input);
  },
});

function handleActions() {
  const actions = input.takeActions();
  const phase = engine.state.phase;
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    announce(muted ? 'Muted.' : 'Sound on.');
    return;
  }
  if (actions & ACTION_RESTART) {
    if (phase === 'duel' && engine.state.mode === 'campaign') {
      applyEvents(engine.retryRound());
      announce('Fresh deck, same rival.');
    } else if (phase === 'duel') {
      applyEvents(engine.newQuickDuel());
      announce('A fresh duel.');
    }
    return;
  }
  if (actions & ACTION_CANCEL) {
    if (phase === 'duel') applyEvents(engine.cancelSelection());
    else if (phase === 'paused') applyEvents(engine.resume());
    return;
  }
  if (actions & ACTION_PAUSE) {
    if (phase === 'duel') {
      applyEvents(engine.pause());
      announce('Paused.');
    } else if (phase === 'paused') {
      applyEvents(engine.resume());
      announce('Playing.');
    }
    return;
  }
  if (actions & ACTION_CONFIRM) {
    const duel = engine.duel;
    if (phase === 'duel' && duel && duel.mulligan && duel.mulligan.active) {
      applyEvents(engine.mulliganConfirm());
    } else if (phase === 'duel' && engine.duel && engine.duel.turn === 'player') {
      applyEvents(engine.endTurn());
    } else if (phase === 'title') {
      applyEvents(engine.newCampaign());
    } else if (phase === 'paused') {
      applyEvents(engine.resume());
    }
  }
  const digit = input.takeDigit();
  if (digit > 0 && phase === 'duel' && engine.duel && engine.duel.turn === 'player') {
    const duel = engine.duel;
    if (duel.mulligan && duel.mulligan.active) {
      const handCard = duel.player.hand[digit - 1];
      if (handCard) applyEvents(engine.mulliganToggle(handCard.uid));
      return;
    }
    const handCard = engine.duel.player.hand[digit - 1];
    if (handCard) {
      audio.unlock();
      applyEvents(engine.selectHandCard(handCard.uid));
    }
  }
}

/** Step the AI once its tell has had its moment, then once per pace interval. */
function stepAi(now) {
  const duel = engine.duel;
  if (!duel || duel.over || duel.turn !== 'ai') return;
  if (!engine.aiWaiting) return;
  if (aiTellShownAt === 0) {
    // No tell arrived yet (the turn just began): wait for it.
    aiTellShownAt = now;
    return;
  }
  const sinceTell = now - aiTellShownAt;
  if (sinceTell < TELL_SECONDS * 1000) return;
  if (lastAiStepAt !== 0 && now - lastAiStepAt < AI_PACE_MS) return;
  lastAiStepAt = now;
  const { events } = engine.aiStep();
  applyEvents(events);
}

function runShot(name) {
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());
  const scene = stageShot(name, engine, seed);
  let painted = 0;
  function paint() {
    layout = renderer.draw(engine.state, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  return scene;
}

function runGame() {
  let last = performance.now();
  let accumulator = 0;
  const MAX_FRAME = 0.25;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    const phase = engine.state.phase;
    // Announce phase changes once.
    if (phase !== announcedPhase) {
      announcedPhase = phase;
      if (phase === 'duel') announce('Duel. Your turn.');
      else if (phase === 'roundwin') announce('Round won.');
      else if (phase === 'win') announce('You won the Crown.');
      else if (phase === 'lose') announce('You lost the duel.');
    }
    if (phase === 'duel') {
      stepAi(now);
      // A demo duel plays itself: the engine takes the player's turn too.
      if (engine.state.mode === 'demo') {
        const duel = engine.duel;
        if (duel && !duel.over && now - lastDemoStepAt > 1100) {
          lastDemoStepAt = now;
          if (duel.mulligan && duel.mulligan.active) {
            applyEvents(engine.mulliganConfirm());
          } else if (duel.turn === 'player') {
            applyEvents(autopilotTurn(engine, duel, 'player'));
            if (!duel.over) applyEvents(engine.endTurn());
          }
        }
      }
      // The duel ended while the AI was playing: move to the end screen.
      const duel = engine.duel;
      if (duel && duel.over && gameOverAt !== 0 && now - gameOverAt > 1200) {
        gameOverAt = 0;
        if (engine.state.best > 0) saveBest(engine.state.best);
        // The duel is on the record now, win or loss — unless it was a demo.
        if (engine.state.mode !== 'demo') {
          recordHistory(duel.winner === 'player' ? 'W' : 'L', duel.opponent.name, engine.state.round);
          recordLifetime(duel.winner, duel.stats.combos);
        }
        const earned = engine.state.mode === 'demo' ? [] : checkAchievements(duel);
        applyEvents(engine.finishDuel());
        // A fresh achievement gets its own banner over the end screen.
        if (earned.length > 0) {
          const first = earned[0];
          ui.banner = { text: `ACHIEVEMENT — ${first.name}`, sub: first.text };
          ui.bannerUntil = performance.now() + 3200;
          audio.win();
        }
      }
    }
    // Prune spent floats and animations.
    if (ui.floats.length > 0) {
      ui.floats = ui.floats.filter((f) => now - f.born < 1100);
    }
    if (ui.anims.length > 0) {
      ui.anims = ui.anims.filter((a) => now - a.born < 500);
    }
    layout = renderer.draw(engine.state, ui);
  }

  // Leaving the tab pauses a running duel rather than letting the AI play unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.state.phase === 'duel') {
      applyEvents(engine.pause());
      announce('Paused.');
    }
  });

  window.addEventListener('resize', () => renderer.resize());
  renderer.resize();
  announce('Ember Court. Press Space or click to start.');
  requestAnimationFrame(frame);
}

// A hook for the playtest (and for anyone debugging in the console): the live
// state, the ui overlays, and the engine itself. It changes nothing about play.
window.__emberCourt = {
  engine, ui, audio,
  get state() { return engine.state; },
  get layout() { return layout; },
  version: 'ember-court-1.0.0',
};

if (shot) runShot(shot);
else runGame();
