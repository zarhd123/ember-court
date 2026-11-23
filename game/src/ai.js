// Ember Court — Vex, the Cindral Warden: the rival brain.
// Reads the board, plans a whole turn, and hands game.js an ordered action list.
// The plan is readable on purpose: removal first, then the best creature it can
// afford, then attacks — taunt first, lethal when it sees it, trades only when ahead.
import { CARD_BY_ID } from './cards.js';

function valueOf(def) {
  // Rough mana-worth of a card, used to pick what to play first.
  if (def.kind === 'spell') return def.cost + (def.dmg ?? 0) * 0.6 + (def.heal ?? 0) * 0.25 + (def.draw ?? 0) * 1.2;
  return def.cost + def.atk * 0.9 + def.hp * 0.7 + (def.kw === 'Taunt' ? 0.8 : 0) + (def.kw === 'Rush' ? 0.6 : 0);
}

// Plan one full AI turn. `s` is a read-only view of the duel state:
// { aiHand, aiBoard, myBoard, myLife, aiLife, aiMana, rng }
export function planAiTurn(s) {
  const actions = [];
  let mana = s.aiMana;
  const board = s.aiBoard.map((c) => ({ ...c }));
  const hand = [...s.aiHand];
  const foes = [...s.myBoard];

  const removeFromHand = (uid) => {
    const i = hand.findIndex((c) => c.uid === uid);
    if (i >= 0) hand.splice(i, 1);
  };

  // 1) Board clears when the player has a wide board and we have the spell.
  const foeCount = foes.length;
  for (const card of [...hand]) {
    const def = CARD_BY_ID[card.defId];
    if (def.kind === 'spell' && def.target === 'all-foe' && foeCount >= 2 && def.cost <= mana) {
      const wouldKill = foes.filter((f) => f.hp <= def.dmg).length;
      if (wouldKill >= 1 || foeCount >= 3) {
        actions.push({ type: 'spell', uid: card.uid, target: 'all' });
        mana -= def.cost;
        removeFromHand(card.uid);
        for (let i = foes.length - 1; i >= 0; i--) {
          foes[i].hp -= def.dmg;
          if (foes[i].hp <= 0) foes.splice(i, 1);
        }
      }
    }
  }

  // 2) Heal when hurt, draw when the hand is thin.
  for (const card of [...hand]) {
    const def = CARD_BY_ID[card.defId];
    if (def.kind !== 'spell' || def.cost > mana) continue;
    if (def.heal && s.aiLife <= 14) {
      actions.push({ type: 'spell', uid: card.uid, target: 'self' });
      mana -= def.cost; removeFromHand(card.uid);
    } else if (def.draw && hand.length <= 2) {
      actions.push({ type: 'spell', uid: card.uid, target: 'self' });
      mana -= def.cost; removeFromHand(card.uid);
    }
  }

  // 3) Play creatures, best value first, while the board has room.
  const creatures = hand
    .map((c) => ({ card: c, def: CARD_BY_ID[c.defId] }))
    .filter((x) => x.def.kind === 'creature')
    .sort((a, b) => valueOf(b.def) - valueOf(a.def));
  for (const { card, def } of creatures) {
    if (board.length >= 5) break;
    if (def.cost > mana) continue;
    // Save a Fireball for lethal; creatures are always worth playing.
    actions.push({ type: 'play', uid: card.uid });
    mana -= def.cost;
    removeFromHand(card.uid);
    board.push({ uid: card.uid, defId: card.defId, atk: def.atk, hp: def.hp, canAttack: def.kw === 'Rush' });
  }

  // 4) Direct damage: lethal first, else soften the biggest taunt, else face.
  for (const card of [...hand]) {
    const def = CARD_BY_ID[card.defId];
    if (def.kind !== 'spell' || !def.dmg || def.target !== 'any' || def.cost > mana) continue;
    if (def.dmg >= s.myLife) {
      actions.push({ type: 'spell', uid: card.uid, target: 'hero' });
      mana -= def.cost; removeFromHand(card.uid);
      return actions; // lethal — the duel ends here.
    }
    const taunt = foes.filter((f) => CARD_BY_ID[f.defId].kw === 'Taunt')
      .sort((a, b) => b.hp - a.hp)[0];
    if (taunt && def.dmg >= taunt.hp) {
      actions.push({ type: 'spell', uid: card.uid, target: taunt.uid });
      mana -= def.cost; removeFromHand(card.uid);
      foes.splice(foes.indexOf(taunt), 1);
    } else if (foes.length === 0 && s.myLife <= 12) {
      actions.push({ type: 'spell', uid: card.uid, target: 'hero' });
      mana -= def.cost; removeFromHand(card.uid);
    }
  }

  // 5) Attacks: taunt must be hit first; go face when lethal or the board is clear;
  // otherwise trade up (kill something bigger) or push face when ahead on board.
  const taunts = foes.filter((f) => CARD_BY_ID[f.defId].kw === 'Taunt');
  const attackers = board.filter((c) => c.canAttack);
  let faceDamage = attackers.reduce((sum, a) => sum + a.atk, 0);
  const lethal = faceDamage >= s.myLife && taunts.length === 0;
  for (const atk of attackers) {
    if (taunts.length > 0) {
      const t = taunts.sort((a, b) => a.hp - b.hp)[0];
      actions.push({ type: 'attack', uid: atk.uid, target: t.uid });
      t.hp -= atk.atk;
      atk.hp -= t.atk;
      if (t.hp <= 0) taunts.splice(taunts.indexOf(t), 1);
      if (atk.hp <= 0) faceDamage -= atk.atk;
      continue;
    }
    if (lethal || foes.length === 0) {
      actions.push({ type: 'attack', uid: atk.uid, target: 'hero' });
      continue;
    }
    // Best trade: kill a foe worth more than we lose, else go face.
    const prey = foes
      .filter((f) => f.hp <= atk.atk && CARD_BY_ID[f.defId].cost >= CARD_BY_ID[atk.defId].cost)
      .sort((a, b) => CARD_BY_ID[b.defId].cost - CARD_BY_ID[a.defId].cost)[0];
    if (prey) {
      actions.push({ type: 'attack', uid: atk.uid, target: prey.uid });
      foes.splice(foes.indexOf(prey), 1);
    } else {
      actions.push({ type: 'attack', uid: atk.uid, target: 'hero' });
    }
  }
  return actions;
}
