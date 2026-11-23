// Ember Court — the duel itself: state, rules, rendering, mouse + keyboard input,
// the AI turn, and the `?shot=` states the screenshots are taken from.
import { CARD_BY_ID, CARD_DEFS, ELEMENTS, describeCard } from './cards.js';
import { buildDeck, drawCards, makeRng } from './deck.js';
import { planAiTurn } from './ai.js';
import { sfx, isMuted, toggleMute } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || '20261123');
const SHOT = params.get('shot') || '';

const MAX_BOARD = 5;
const MAX_HAND = 7;
const START_LIFE = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- state ----------
let state = null; // { myLife, foeLife, myMana, foeMana, maxMana, turn, phase, ... }
let selection = { handIndex: -1, attackerUid: null, spellUid: null };
let aiBusy = false;
let stats = { turns: 0, damageDealt: 0, cardsPlayed: 0, creaturesSummoned: 0 };

function freshState(seed) {
  const rng = makeRng(seed);
  const myDeck = buildDeck(seed);
  const foeDeck = buildDeck(seed + 7919);
  const s = {
    rng, myLife: START_LIFE, foeLife: START_LIFE,
    myMana: 1, foeMana: 1, maxMana: 1, turn: 1,
    phase: 'title', // title | play | over
    turnOwner: 'me',
    myDeck, foeDeck, myHand: [], foeHand: [], myBoard: [], foeBoard: [],
  };
  drawCards(s.myDeck, s.myHand, 3);
  drawCards(s.foeDeck, s.foeHand, 3);
  return s;
}

function boardCard(card, owner) {
  const def = CARD_BY_ID[card.defId];
  return { uid: card.uid, defId: card.defId, atk: def.atk, hp: def.hp, owner, canAttack: def.kw === 'Rush' };
}

// ---------- logging & floaters ----------
function log(html) {
  const el = $('log');
  const line = document.createElement('div');
  line.innerHTML = html;
  el.prepend(line);
  while (el.children.length > 3) el.lastChild.remove();
}

function floater(text, x, y, kind = '') {
  const el = document.createElement('div');
  el.className = `floater ${kind}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('floaterLayer').appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

function floaterAt(targetEl, text, kind = '') {
  const r = targetEl.getBoundingClientRect();
  const app = $('app').getBoundingClientRect();
  floater(text, r.left - app.left + r.width / 2 - 14, r.top - app.top + 6, kind);
}

// ---------- card DOM ----------
function cardEl(card, owner, opts = {}) {
  const def = CARD_BY_ID[card.defId];
  const el = document.createElement('div');
  el.className = `card elem-${def.elem} ${def.kind === 'spell' ? 'spell' : ''}`;
  el.dataset.uid = card.uid;
  el.dataset.defId = card.defId;
  const kw = def.kw ? `<span class="kw">${def.kw.toUpperCase()}</span>` : '';
  // Hand cards carry only defId; board cards carry live atk/hp. Fall back to the
  // catalogue values so a hand card never renders "undefined".
  const atk = card.atk ?? def.atk;
  const hp = card.hp ?? def.hp;
  const statsHtml = def.kind === 'creature'
    ? `<div class="stats"><span class="atk">${atk}</span><span class="hp">${hp}</span></div>` : '';
  el.innerHTML = `
    <span class="cost">${def.cost}</span>${kw}
    <div class="art"><svg><use href="#${ELEMENTS[def.elem].icon}"></use></svg></div>
    <div class="name">${def.name}</div>
    <div class="rules">${def.text}</div>${statsHtml}`;
  if (opts.onClick) el.addEventListener('click', (e) => { e.stopPropagation(); opts.onClick(card, el); });
  return el;
}

function backEl() {
  const el = document.createElement('div');
  el.className = 'card back';
  return el;
}

// ---------- render ----------
function render() {
  const s = state;
  $('myLifeNum').textContent = s.myLife;
  $('foeLifeNum').textContent = s.foeLife;
  $('myLife').classList.toggle('low', s.myLife <= 10);
  $('foeLife').classList.toggle('low', s.foeLife <= 10);
  $('myDeckCount').textContent = s.myDeck.length;
  $('foeDeckCount').textContent = s.foeDeck.length;
  $('manaNum').textContent = `${s.myMana}/${s.maxMana}`;
  $('manaCrystals').innerHTML = Array.from({ length: 10 }, (_, i) =>
    `<span class="mana-dot ${i < s.myMana ? 'full' : ''}"></span>`).join('');
  $('endTurn').disabled = s.phase !== 'play' || s.turnOwner !== 'me' || aiBusy;

  // Opponent hand: face-down backs.
  const foeHand = $('foeHand');
  foeHand.innerHTML = '';
  s.foeHand.forEach(() => foeHand.appendChild(backEl()));

  // Boards.
  renderBoard($('foeBoard'), s.foeBoard, 'foe');
  renderBoard($('myBoard'), s.myBoard, 'me');

  // Player hand.
  const myHand = $('myHand');
  myHand.innerHTML = '';
  s.myHand.forEach((card, i) => {
    const def = CARD_BY_ID[card.defId];
    const el = cardEl(card, 'me', { onClick: () => onHandCard(card, el) });
    if (s.phase === 'play' && s.turnOwner === 'me' && !aiBusy) {
      el.classList.add(def.cost <= s.myMana ? 'playable' : 'cant');
    }
    if (selection.handIndex === i) el.classList.add('selected');
    if (selection.spellUid === card.uid) el.classList.add('selected');
    myHand.appendChild(el);
  });

  $('turnBanner').classList.toggle('hidden', !(s.phase === 'play' && s.turnOwner === 'me'));
  $('turnBanner').textContent = 'Your turn';
}

function renderBoard(container, board, owner) {
  container.innerHTML = '';
  for (const c of board) {
    const def = CARD_BY_ID[c.defId];
    const el = cardEl(c, owner, { onClick: () => onBoardCard(c, el) });
    if (owner === 'me' && c.canAttack && state.phase === 'play' && state.turnOwner === 'me' && !aiBusy) {
      el.classList.add('can-attack');
    }
    if (selection.attackerUid === c.uid) el.classList.add('attacker');
    if (def.kw === 'Taunt') el.classList.add('taunt-glow');
    if (selection.attackerUid || selection.spellUid) {
      const targetable = owner === 'foe' && legalTarget(c);
      if (targetable) el.classList.add('targetable');
    }
    container.appendChild(el);
  }
}

function legalTarget(creature) {
  if (selection.spellUid) {
    // spellUid is the card's uid, not its defId: look the card up first.
    const card = state.myHand.find((c) => c.uid === selection.spellUid);
    if (!card) return false;
    return CARD_BY_ID[card.defId].target === 'any';
  }
  if (selection.attackerUid) {
    const taunts = state.foeBoard.filter((c) => CARD_BY_ID[c.defId].kw === 'Taunt');
    return taunts.length === 0 || CARD_BY_ID[creature.defId].kw === 'Taunt';
  }
  return false;
}

// ---------- rules ----------
function endDuel(winner) {
  state.phase = 'over';
  const win = winner === 'me';
  $('endScreen').classList.remove('hidden', 'win', 'loss');
  $('endScreen').classList.add(win ? 'win' : 'loss');
  $('endTitle').textContent = win ? 'VICTORY' : 'DEFEAT';
  $('endEmblem').textContent = win ? '♛' : '☠';
  $('endText').textContent = win
    ? 'The Cindral Throne is yours. Vex bows, and the Ember Court cheers your name.'
    : 'Vex keeps the throne — this time. The embers remember every duel. Rematch?';
  $('endStats').innerHTML =
    `<span><b>${stats.turns}</b>turns</span>
     <span><b>${stats.damageDealt}</b>damage dealt</span>
     <span><b>${stats.cardsPlayed}</b>cards played</span>
     <span><b>${stats.creaturesSummoned}</b>creatures summoned</span>`;
  if (win) sfx.win(); else sfx.lose();
  render();
}

function damageHero(who, amount, sourceEl) {
  if (who === 'me') state.myLife -= amount; else state.foeLife -= amount;
  if (who === 'foe') stats.damageDealt += amount;
  const heroEl = who === 'me' ? $('myHero') : $('foeHero');
  floaterAt(heroEl, `-${amount}`);
  heroEl.classList.add('hit');
  setTimeout(() => heroEl.classList.remove('hit'), 320);
  if (state.myLife <= 0) { endDuel('foe'); return true; }
  if (state.foeLife <= 0) { endDuel('me'); return true; }
  return false;
}

function damageCreature(board, creature, amount) {
  creature.hp -= amount;
  const el = document.querySelector(`.card[data-uid="${creature.uid}"]`);
  if (el) { el.classList.add('hit'); floaterAt(el, `-${amount}`); }
  if (creature.hp <= 0) {
    const i = board.indexOf(creature);
    if (i >= 0) board.splice(i, 1);
    log(`<b>${CARD_BY_ID[creature.defId].name}</b> is destroyed.`);
  }
}

function playCardFromHand(card) {
  const s = state;
  const def = CARD_BY_ID[card.defId];
  if (def.cost > s.myMana) { log(`Not enough mana for <b>${def.name}</b>.`); return false; }
  if (def.kind === 'creature' && s.myBoard.length >= MAX_BOARD) {
    log('Your board is full (5 creatures).'); return false;
  }
  s.myHand.splice(s.myHand.indexOf(card), 1);
  s.myMana -= def.cost;
  stats.cardsPlayed++;
  if (def.kind === 'creature') {
    const bc = boardCard(card, 'me');
    s.myBoard.push(bc);
    stats.creaturesSummoned++;
    log(`You summon <b>${def.name}</b> (${bc.atk}/${bc.hp}).`);
    if (def.draw) {
      const drawn = drawCards(s.myDeck, s.myHand, def.draw);
      drawn.forEach((d) => log(`Pebble Sprite draws <b>${CARD_BY_ID[d.defId].name}</b>.`));
    }
    sfx.playCard();
  } else {
    resolveSpell(card, 'me');
  }
  selection = { handIndex: -1, attackerUid: null, spellUid: null };
  render();
  return true;
}

// Target resolution for spells. `caster` is 'me' | 'foe'.
// target: a board creature object, 'hero' (enemy hero), 'all' (enemy board), 'self'.
function resolveSpell(card, caster, target = null) {
  const s = state;
  const def = CARD_BY_ID[card.defId];
  const foeBoard = caster === 'me' ? s.foeBoard : s.myBoard;
  const foeHero = caster === 'me' ? 'foe' : 'me';
  sfx.spell();
  if (def.target === 'self') {
    if (def.heal) {
      const who = caster;
      const before = who === 'me' ? s.myLife : s.foeLife;
      if (who === 'me') s.myLife = Math.min(START_LIFE, s.myLife + def.heal);
      else s.foeLife = Math.min(START_LIFE, s.foeLife + def.heal);
      const healed = (who === 'me' ? s.myLife : s.foeLife) - before;
      floaterAt(caster === 'me' ? $('myHero') : $('foeHero'), `+${healed}`, 'heal');
      log(`${caster === 'me' ? 'You cast' : 'Vex casts'} <b>${def.name}</b>, restoring ${healed} life.`);
    }
    if (def.draw) {
      const deck = caster === 'me' ? s.myDeck : s.foeDeck;
      const hand = caster === 'me' ? s.myHand : s.foeHand;
      const drawn = drawCards(deck, hand, def.draw);
      log(`${caster === 'me' ? 'You draw' : 'Vex draws'} ${drawn.length} card${drawn.length === 1 ? '' : 's'} from <b>${def.name}</b>.`);
    }
    return false;
  }
  if (def.target === 'all-foe') {
    log(`${caster === 'me' ? 'You cast' : 'Vex casts'} <b>${def.name}</b> — ${def.dmg} damage to every enemy creature.`);
    [...foeBoard].forEach((c) => damageCreature(foeBoard, c, def.dmg));
    return checkDeaths();
  }
  // Targeted damage.
  if (target === 'hero') {
    log(`${caster === 'me' ? 'You cast' : 'Vex casts'} <b>${def.name}</b> at the enemy hero for ${def.dmg}.`);
    return damageHero(foeHero, def.dmg);
  }
  if (target && typeof target === 'object') {
    log(`${caster === 'me' ? 'You cast' : 'Vex casts'} <b>${def.name}</b> at <b>${CARD_BY_ID[target.defId].name}</b> for ${def.dmg}.`);
    damageCreature(foeBoard, target, def.dmg);
    return checkDeaths();
  }
  return false;
}

function checkDeaths() {
  if (state.myLife <= 0) { endDuel('foe'); return true; }
  if (state.foeLife <= 0) { endDuel('me'); return true; }
  return false;
}

function attackWith(attacker, target) {
  const s = state;
  const def = CARD_BY_ID[attacker.defId];
  attacker.canAttack = false;
  sfx.attack();
  if (target === 'hero') {
    const foeHero = attacker.owner === 'me' ? 'foe' : 'me';
    log(`<b>${def.name}</b> strikes the enemy hero for ${attacker.atk}.`);
    return damageHero(foeHero, attacker.atk);
  }
  const foeBoard = attacker.owner === 'me' ? s.foeBoard : s.myBoard;
  const tdef = CARD_BY_ID[target.defId];
  log(`<b>${def.name}</b> (${attacker.atk}/${attacker.hp}) attacks <b>${tdef.name}</b> (${target.atk}/${target.hp}).`);
  const atkEl = document.querySelector(`.card[data-uid="${attacker.uid}"]`);
  if (atkEl) atkEl.classList.add('hit');
  target.hp -= attacker.atk;
  attacker.hp -= target.atk;
  sfx.hit();
  if (target.hp <= 0) {
    foeBoard.splice(foeBoard.indexOf(target), 1);
    log(`<b>${tdef.name}</b> is destroyed.`);
  }
  if (attacker.hp <= 0) {
    const ownBoard = attacker.owner === 'me' ? s.myBoard : s.foeBoard;
    ownBoard.splice(ownBoard.indexOf(attacker), 1);
    log(`<b>${def.name}</b> falls in the fight.`);
  }
  return checkDeaths();
}

// ---------- input: mouse ----------
function onHandCard(card, el) {
  const s = state;
  if (s.phase !== 'play' || s.turnOwner !== 'me' || aiBusy) return;
  const def = CARD_BY_ID[card.defId];
  if (selection.spellUid === card.uid) { selection.spellUid = null; selection.handIndex = -1; render(); return; }
  if (def.cost > s.myMana) { log(`Not enough mana for <b>${def.name}</b> (${def.cost}).`); sfx.click(); render(); return; }
  sfx.select();
  if (def.kind === 'spell' && def.target === 'any') {
    selection.spellUid = card.uid;
    selection.handIndex = s.myHand.indexOf(card);
    log(`<b>${def.name}</b> — click a target.`);
  } else if (def.kind === 'spell' && def.target === 'self') {
    playCardFromHand(card);
    return;
  } else if (def.kind === 'spell' && def.target === 'all-foe') {
    playCardFromHand(card);
    return;
  } else {
    selection.handIndex = s.myHand.indexOf(card);
    selection.spellUid = null;
    if (!playCardFromHand(card)) { selection.handIndex = -1; }
    return;
  }
  render();
}

function onBoardCard(creature, el) {
  const s = state;
  if (s.phase !== 'play' || s.turnOwner !== 'me' || aiBusy) return;
  // Targeting with a spell.
  if (selection.spellUid) {
    const card = s.myHand.find((c) => c.uid === selection.spellUid);
    if (!card) { selection.spellUid = null; render(); return; }
    if (creature.owner !== 'foe' || !legalTarget(creature)) { log('That is not a legal target.'); return; }
    s.myHand.splice(s.myHand.indexOf(card), 1);
    s.myMana -= CARD_BY_ID[card.defId].cost;
    stats.cardsPlayed++;
    selection.spellUid = null;
    selection.handIndex = -1;
    if (resolveSpell(card, 'me', creature)) return;
    render();
    return;
  }
  // Attacking with a creature.
  if (creature.owner === 'me') {
    if (!creature.canAttack) { log(`<b>${CARD_BY_ID[creature.defId].name}</b> cannot attack yet.`); return; }
    selection.attackerUid = selection.attackerUid === creature.uid ? null : creature.uid;
    sfx.select();
    if (selection.attackerUid) log(`<b>${CARD_BY_ID[creature.defId].name}</b> is ready — click a target.`);
    render();
    return;
  }
  if (selection.attackerUid) {
    const attacker = s.myBoard.find((c) => c.uid === selection.attackerUid);
    if (!attacker) { selection.attackerUid = null; render(); return; }
    if (!legalTarget(creature)) { log('Taunt! You must attack the taunting creature first.'); return; }
    selection.attackerUid = null;
    if (attackWith(attacker, creature)) return;
    render();
  }
}

// Hero portraits are attack / spell targets too.
function heroClick(who) {
  const s = state;
  if (s.phase !== 'play' || s.turnOwner !== 'me' || aiBusy) return;
  if (selection.spellUid) {
    const card = s.myHand.find((c) => c.uid === selection.spellUid);
    if (!card || who !== 'foe') return;
    s.myHand.splice(s.myHand.indexOf(card), 1);
    s.myMana -= CARD_BY_ID[card.defId].cost;
    stats.cardsPlayed++;
    selection.spellUid = null;
    selection.handIndex = -1;
    if (resolveSpell(card, 'me', 'hero')) return;
    render();
    return;
  }
  if (selection.attackerUid) {
    if (who !== 'foe') return;
    const attacker = s.myBoard.find((c) => c.uid === selection.attackerUid);
    if (!attacker) { selection.attackerUid = null; render(); return; }
    const taunts = s.foeBoard.filter((c) => CARD_BY_ID[c.defId].kw === 'Taunt');
    if (taunts.length > 0) { log('Taunt! You must attack the taunting creature first.'); return; }
    selection.attackerUid = null;
    if (attackWith(attacker, 'hero')) return;
    render();
  }
}

// ---------- input: keyboard ----------
document.addEventListener('keydown', (e) => {
  const s = state;
  if (e.key === 'r' || e.key === 'R') {
    if (s.phase === 'over') { startDuel(); }
    return;
  }
  if (s.phase === 'title' && (e.key === 'Enter' || e.key === ' ')) { startDuel(); return; }
  if (s.phase !== 'play' || s.turnOwner !== 'me' || aiBusy) return;
  if (e.key === 'Escape') {
    selection = { handIndex: -1, attackerUid: null, spellUid: null };
    render();
    return;
  }
  if (e.key === 'e' || e.key === 'E') { endTurn(); return; }
  if (/^[1-7]$/.test(e.key)) {
    const i = Number(e.key) - 1;
    const card = s.myHand[i];
    if (!card) return;
    const el = document.querySelector(`#myHand .card:nth-child(${i + 1})`);
    onHandCard(card, el);
    return;
  }
  if (e.key === 'Enter') {
    if (selection.handIndex >= 0) {
      const card = s.myHand[selection.handIndex];
      if (card) {
        const def = CARD_BY_ID[card.defId];
        if (def.kind === 'creature') playCardFromHand(card);
        else if (def.target === 'self' || def.target === 'all-foe') playCardFromHand(card);
        else if (def.target === 'any') {
          // Keyboard-only cast: aim at the enemy hero (always a legal target).
          s.myHand.splice(s.myHand.indexOf(card), 1);
          s.myMana -= def.cost;
          stats.cardsPlayed++;
          selection = { handIndex: -1, attackerUid: null, spellUid: null };
          if (resolveSpell(card, 'me', 'hero')) return;
          render();
        }
      }
    }
  }
});

// ---------- turns ----------
function startDuel(seed) {
  // A fresh shuffle every duel; staged screenshots pass the fixed seed.
  if (seed === undefined) seed = (Date.now() % 2147483647) >>> 0;
  state = freshState(seed);
  stats = { turns: 0, damageDealt: 0, cardsPlayed: 0, creaturesSummoned: 0 };
  selection = { handIndex: -1, attackerUid: null, spellUid: null };
  aiBusy = false;
  $('log').innerHTML = '';
  $('titleScreen').classList.add('hidden');
  $('helpScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  state.phase = 'play';
  log('The duel begins. <b>You</b> hold 30 life; so does <b>Vex</b>.');
  log('Your move: play a card, attack, then press <b>End turn</b>.');
  sfx.turn();
  render();
}

async function endTurn() {
  const s = state;
  if (s.phase !== 'play' || s.turnOwner !== 'me' || aiBusy) return;
  aiBusy = true;
  selection = { handIndex: -1, attackerUid: null, spellUid: null };
  s.turnOwner = 'foe';
  render();
  await sleep(650);
  if (s.phase !== 'play') { aiBusy = false; return; }
  // Vex draws, gains mana, then plans and acts — one action at a time, visibly.
  s.maxMana = Math.min(10, s.maxMana + 1);
  s.foeMana = s.maxMana;
  drawCards(s.foeDeck, s.foeHand, 1);
  s.foeBoard.forEach((c) => { c.canAttack = true; });
  log('<span class="ai">Vex draws, and the court holds its breath…</span>');
  render();
  await sleep(700);
  const view = {
    aiHand: s.foeHand.map((c) => ({ ...c })),
    aiBoard: s.foeBoard.map((c) => ({ ...c })),
    myBoard: s.myBoard.map((c) => ({ ...c })),
    myLife: s.myLife, aiLife: s.foeLife, aiMana: s.foeMana, rng: s.rng,
  };
  const actions = planAiTurn(view);
  for (const a of actions) {
    if (s.phase !== 'play') break;
    await sleep(620);
    if (a.type === 'play') {
      const card = s.foeHand.find((c) => c.uid === a.uid);
      if (!card) continue;
      const def = CARD_BY_ID[card.defId];
      if (def.cost > s.foeMana) continue;
      s.foeHand.splice(s.foeHand.indexOf(card), 1);
      s.foeMana -= def.cost;
      const bc = boardCard(card, 'foe');
      s.foeBoard.push(bc);
      log(`<span class="ai">Vex summons <b>${def.name}</b> (${bc.atk}/${bc.hp}).</span>`);
      if (def.draw) drawCards(s.foeDeck, s.foeHand, def.draw);
      sfx.playCard();
    } else if (a.type === 'spell') {
      const card = s.foeHand.find((c) => c.uid === a.uid);
      if (!card) continue;
      const def = CARD_BY_ID[card.defId];
      if (def.cost > s.foeMana) continue;
      s.foeHand.splice(s.foeHand.indexOf(card), 1);
      s.foeMana -= def.cost;
      let target = null;
      if (a.target === 'hero') target = 'hero';
      else if (a.target === 'all') target = 'all';
      else if (a.target === 'self') target = 'self';
      else target = s.myBoard.find((c) => c.uid === a.target) || null;
      if (resolveSpell(card, 'foe', target)) { aiBusy = false; render(); return; }
    } else if (a.type === 'attack') {
      const atk = s.foeBoard.find((c) => c.uid === a.uid);
      if (!atk || !atk.canAttack) continue;
      if (a.target === 'hero') {
        if (attackWith(atk, 'hero')) { aiBusy = false; render(); return; }
      } else {
        const tgt = s.myBoard.find((c) => c.uid === a.target);
        if (!tgt) continue;
        if (attackWith(atk, tgt)) { aiBusy = false; render(); return; }
      }
    }
    render();
  }
  // Back to the player: draw, refill mana (maxMana rose once, on Vex's turn),
  // creatures ready.
  await sleep(500);
  if (s.phase !== 'play') { aiBusy = false; return; }
  s.turnOwner = 'me';
  s.myMana = s.maxMana;
  s.turn++;
  stats.turns = s.turn;
  s.myBoard.forEach((c) => { c.canAttack = true; });
  const drawn = drawCards(s.myDeck, s.myHand, 1);
  if (drawn.length > 0) log(`You draw <b>${CARD_BY_ID[drawn[0].defId].name}</b>.`);
  log(`<b>Turn ${s.turn}</b> — your mana is now ${s.myMana}.`);
  sfx.turn();
  aiBusy = false;
  render();
}

// ---------- screenshot states ----------
// `?shot=title|play|win|loss` stages a deterministic scene for screenshots.
// These are real renders of the game itself, not composites.
function stageShot(shot) {
  if (shot === 'title') {
    state = freshState(SEED);
    state.phase = 'title';
    $('titleScreen').classList.remove('hidden');
    render();
    return;
  }
  startDuel(SEED);
  if (shot === 'play') {
    // A mid-duel table: both boards populated, hands full, life already dented.
    const s = state;
    s.myLife = 24; s.foeLife = 18; s.maxMana = 6; s.myMana = 4; s.turn = 5; stats.turns = 5;
    s.myBoard = [
      { uid: 'm1', defId: 'stone-golem', atk: 4, hp: 5, owner: 'me', canAttack: true },
      { uid: 'm2', defId: 'cinder-hound', atk: 3, hp: 2, owner: 'me', canAttack: true },
      { uid: 'm3', defId: 'tidecaller', atk: 2, hp: 3, owner: 'me', canAttack: false },
    ];
    s.foeBoard = [
      { uid: 'f1', defId: 'reef-guardian', atk: 2, hp: 4, owner: 'foe', canAttack: false },
      { uid: 'f2', defId: 'ash-phoenix', atk: 5, hp: 4, owner: 'foe', canAttack: false },
    ];
    s.myHand = [
      { uid: 'h1', defId: 'fireball' }, { uid: 'h2', defId: 'briar-wolf' },
      { uid: 'h3', defId: 'healing-spring' }, { uid: 'h4', defId: 'thorn-sprout' },
      { uid: 'h5', defId: 'ember-surge' },
    ];
    s.foeHand = [{ uid: 'x1', defId: 'ember-imp' }, { uid: 'x2', defId: 'tidecaller' }, { uid: 'x3', defId: 'quake' }];
    selection.handIndex = 0; // Fireball selected, ready to aim — shows selection state.
    log('<b>You</b> hold the line with a Stone Golem while Vex’s Ash Phoenix circles.');
    log('Fireball is selected — click a target, or press <b>Esc</b> to cancel.');
    render();
    // Highlight the selected card visually after render.
    const first = document.querySelector('#myHand .card');
    if (first) first.classList.add('selected');
    return;
  }
  if (shot === 'win') {
    const s = state;
    s.foeLife = 0;
    stats.turns = 9; stats.damageDealt = 34; stats.cardsPlayed = 14; stats.creaturesSummoned = 9;
    render();
    endDuel('me');
    return;
  }
  if (shot === 'loss') {
    const s = state;
    s.myLife = 0;
    stats.turns = 8; stats.damageDealt = 19; stats.cardsPlayed = 11; stats.creaturesSummoned = 7;
    render();
    endDuel('foe');
  }
}

// ---------- wire up ----------
$('playBtn').addEventListener('click', () => { sfx.click(); startDuel(); });
$('againBtn').addEventListener('click', () => { sfx.click(); startDuel(); });
$('endTurn').addEventListener('click', () => { sfx.click(); void endTurn(); });
$('foeHero').addEventListener('click', () => heroClick('foe'));
$('myHero').addEventListener('click', () => heroClick('me'));
$('helpBtn').addEventListener('click', () => { sfx.click(); $('helpScreen').classList.remove('hidden'); });
$('closeHelp').addEventListener('click', () => { sfx.click(); $('helpScreen').classList.add('hidden'); });
$('muteBtn').addEventListener('click', (e) => {
  const m = toggleMute();
  e.currentTarget.textContent = m ? '♪ off' : '♪ on';
  if (!m) sfx.click();
});
if (isMuted()) $('muteBtn').textContent = '♪ off';
document.addEventListener('click', (e) => {
  if (e.target === document.body || e.target.id === 'table') {
    selection = { handIndex: -1, attackerUid: null, spellUid: null };
    render();
  }
});

// ---------- boot ----------
state = freshState(SEED);
if (SHOT) stageShot(SHOT);
else render();
window.__emberCourt = { get state() { return state; }, startDuel, endTurn };
