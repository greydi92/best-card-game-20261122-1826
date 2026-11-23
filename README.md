[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/greydi92/best-card-game-20261122-1826/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/greydi92/best-card-game-20261122-1826/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

# EMBER COURT — 40 Cards, 12 Combos, 5-Round Campaign, 1 Crown

Built for the [make.fun "Make the best card game" bounty](https://make.fun/bounty/best-card-game-20261122-1826) — a duel card battler where you sit across the table from five rival courts and play for the Crown. Join make.fun with referral code `qgn48q27`: https://make.fun/r/qgn48q27

Four elements, one wheel: Ember burns Thorn, Thorn chokes Gale, Gale scatters Tide, Tide drowns Ember. Play two cards of one element in a turn to fire its combo, or both cards of a named pair for a bigger one. The rival telegraphs its turn before it plays, so you can read the threat and answer it.

## Play

```sh
node serve.ts
```

Open http://localhost:8080 in desktop Chrome. No build step, no network — the game is plain static files, no libraries.

## Controls

- **Mouse** — click a card to play it, click a minion then a target to attack
- **1–7** — play a card from your hand
- **Space** — end your turn
- **Right-click / Esc** — cancel a target · **P** — pause · **M** — mute · **R** — restart the duel

## Strategy

- **Mulligan for curve.** Send back anything that costs 5 or more — your opening hand should have plays for turns 1, 2 and 3. The rival does the same, so a heavy opening hand is a slow start for both of you.
- **Spend your mana every turn.** An unspent crystal is a card you never played. If nothing in hand fits, that is what the 1-cost cards are for.
- **Plan the combo, not the card.** Two Ember cards in one turn is a Wildfire for 2 to the hero; two Tide is a heal; two Thorn is a free Sprout; two Gale draws 2. Hold the second card of an element until you can fire both.
- **Read the tell.** Before the rival's turn, the banner says what is coming — a heavy card, a spell, an attack on your hero. A Taunt in front of a big swing, or a heal before a burn turn, answers most of them.
- **Respect the wheel.** Ember burns Thorn, Thorn chokes Gale, Gale scatters Tide, Tide drowns Ember. An attack with the winning element deals +2; with the losing element, −1. A 4-attack minion hits for 6 against the element it beats.
- **Trade up, not down.** When you are ahead on the table, trade minions and protect your life total. When you are behind, ignore the table and burn the hero — the game ends at 0 life, not at 0 minions.
- **Know the five courts.** Rook burns fast and runs out of cards; Mira heals through your damage; Bramble walls up behind taunts; Zephyr wipes your table; the Queen does all of it with 6 extra life. Beat them in order and the Crown is yours.

## What is in the game

- **40 unique cards** — 10 per element: minions from 1-cost sparks to 7-cost dragons and leviathans, plus burn, healing, freeze, board wipes and card draw.
- **12 combos** — 4 element combos (Wildfire, High Tide, Overgrowth, Tailwind) and 8 named pairs (Pack Fire, Sky Burn, Shell Wall, Deep Song, Ironwood, Ambush, Tempest, Sky Patrol).
- **Element wheel** — the winning element deals +2 damage, the losing element −1, on every minion attack and targeted spell.
- **A telegraphed AI rival** — before its turn it tells you what it is about to do (a heavy card, a spell, an attack on your hero), and its five opponents each have their own deck theme, aggression and tells.
- **5-round campaign** — Rook, Mira, Bramble, Zephyr, then the Ember Queen herself; each with more life and a sharper AI. Win all five to take the Crown. A Quick Duel mode plays one match against any rival.
- **Full duel rules** — mana that grows to 10, drawing, fatigue, taunt guards, freeze, armor, tokens, battlecries and deathrattles, a battle log, and end screens with match stats.
- **Sound, synthesized** — every effect is WebAudio, no audio files: draws, hits, heals, combos and a win fanfare.
- **Screenshots are real renders** — the title, a mid-duel table, the Crown win and a loss, all staged by playing the real engine forward (`?shot=start|play|win|lose&seed=1`).

## Files

- `game/` — the game: `index.html` plus `src/` (config, cards, engine, AI, renderer, input, audio, shots)
- `main.ts` — copies `game/` + `screenshots/` to the output and writes `dossier.json`
- `serve.ts` — serves `game/` on http://localhost:8080
- `shots.json` — the four screenshot scenes
