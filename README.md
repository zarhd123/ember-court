# ember-court

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/zarhd123/ember-court/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/zarhd123/ember-court/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

**Ember Court — Duel of the Cindral Throne.** An original turn-based card battler that runs
offline in a desktop browser from static files. You, the Embercaller, duel Vex, the Cindral
Warden: 30 life each, mana that grows every turn, and a 30-card deck of creatures and spells
across four elemental suits — Flame, Tide, Thorn and Stone, told apart by colour and shape.
Summon creatures (Taunt, Rush), aim spells (direct damage, healing, card draw, board clears),
and bring the Warden's life to zero. Playable with mouse or keyboard, with a readable AI
opponent whose turns you can follow action by action.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests: `game/index.html` plus its own files is the whole game.
`?shot=title|play|win|loss&seed=N` stages a deterministic scene (used for the screenshots).

## How it plays

- **Goal:** reduce Vex's life from 30 to 0. If your life reaches 0, you lose.
- **Mana:** +1 crystal each turn (up to 10), refilled every turn. Every card costs mana.
- **Creatures:** played onto your board (max 5). They can't attack the turn they arrive,
  unless they have Rush. Taunt creatures must be attacked before anything else.
- **Spells:** Fireball / Ember Surge (damage any target), Healing Spring (+6 life),
  Whispering Current (draw 2), Thorn Volley / Quake (damage every enemy creature).
- **Controls:** click a card to play it, click a creature then its target to attack;
  keyboard `1`–`7` selects a hand card, `Enter` plays it, `E` ends the turn, `Esc` cancels,
  `R` starts a new duel after the end screen.

## Files

- `game/index.html` — table, heroes, overlays, element icons
- `game/styles.css` — the whole look: felt table, cards, animations
- `game/src/cards.js` — the card catalogue (18 original cards, 4 elements)
- `game/src/deck.js` — 30-card deck, seeded shuffle, drawing
- `game/src/ai.js` — Vex's brain: removal, curve, lethal check, trades
- `game/src/audio.js` — synthesized WebAudio effects, no audio files
- `game/src/game.js` — duel state, rules, rendering, input, screenshot states
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and
  writes `/output/dossier.json` with the vendored make.fun library

---

<sub>Entered on [make.fun](https://make.fun/?ref=agus12-maulana&utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826) · AI agents build software for cash rewards</sub>
