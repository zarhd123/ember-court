// Ember Court — the card catalogue: every creature and spell in the game.
// Elements double as suits: Flame, Tide, Thorn, Stone — told apart by colour AND shape.
export const ELEMENTS = {
  flame: { name: 'Flame', icon: 'ico-flame', color: '#e4572e' },
  tide: { name: 'Tide', icon: 'ico-tide', color: '#2e86de' },
  thorn: { name: 'Thorn', icon: 'ico-thorn', color: '#4caf50' },
  stone: { name: 'Stone', icon: 'ico-stone', color: '#8d7d6b' },
};

// id, name, element, kind, cost, attack, health, keyword, rules text
export const CARD_DEFS = [
  { id: 'ember-imp',     name: 'Ember Imp',      elem: 'flame', kind: 'creature', cost: 1, atk: 2, hp: 1, kw: null,    text: 'A spark with teeth.' },
  { id: 'pebble-sprite', name: 'Pebble Sprite',  elem: 'stone', kind: 'creature', cost: 1, atk: 1, hp: 1, kw: null,    text: 'Draw a card when played.', draw: 1 },
  { id: 'cinder-hound',  name: 'Cinder Hound',   elem: 'flame', kind: 'creature', cost: 2, atk: 3, hp: 2, kw: 'Rush',  text: 'Rush: attacks at once.' },
  { id: 'tidecaller',    name: 'Tidecaller',     elem: 'tide',  kind: 'creature', cost: 2, atk: 2, hp: 3, kw: null,    text: 'Calls the tide to war.' },
  { id: 'thorn-sprout',  name: 'Thorn Sprout',   elem: 'thorn', kind: 'creature', cost: 2, atk: 1, hp: 4, kw: 'Taunt', text: 'Taunt: foes must hit it first.' },
  { id: 'briar-wolf',    name: 'Briar Wolf',     elem: 'thorn', kind: 'creature', cost: 3, atk: 3, hp: 3, kw: null,    text: 'Runs with the thorns.' },
  { id: 'reef-guardian', name: 'Reef Guardian',  elem: 'tide',  kind: 'creature', cost: 3, atk: 2, hp: 5, kw: 'Taunt', text: 'Taunt: foes must hit it first.' },
  { id: 'ash-phoenix',   name: 'Ash Phoenix',    elem: 'flame', kind: 'creature', cost: 5, atk: 5, hp: 4, kw: 'Rush',  text: 'Rush: attacks at once.' },
  { id: 'stone-golem',   name: 'Stone Golem',    elem: 'stone', kind: 'creature', cost: 4, atk: 4, hp: 6, kw: 'Taunt', text: 'Taunt: foes must hit it first.' },
  { id: 'storm-drake',   name: 'Storm Drake',    elem: 'tide',  kind: 'creature', cost: 6, atk: 6, hp: 5, kw: null,    text: 'The storm, given wings.' },
  { id: 'ancient-treant',name: 'Ancient Treant', elem: 'thorn', kind: 'creature', cost: 5, atk: 4, hp: 7, kw: 'Taunt', text: 'Taunt: foes must hit it first.' },
  { id: 'mountain-titan',name: 'Mountain Titan', elem: 'stone', kind: 'creature', cost: 7, atk: 7, hp: 7, kw: null,    text: 'The mountain stands up.' },
  // Spells: damage / heal / draw / board clear. `dmg`/`heal`/`draw` are spell effects.
  { id: 'fireball',      name: 'Fireball',       elem: 'flame', kind: 'spell', cost: 3, dmg: 4, target: 'any',   text: 'Deal 4 damage to any target.' },
  { id: 'ember-surge',   name: 'Ember Surge',    elem: 'flame', kind: 'spell', cost: 1, dmg: 2, target: 'any',   text: 'Deal 2 damage to any target.' },
  { id: 'healing-spring',name: 'Healing Spring', elem: 'tide',  kind: 'spell', cost: 2, heal: 6, target: 'self', text: 'Restore 6 life to yourself.' },
  { id: 'whispering-current', name: 'Whispering Current', elem: 'tide', kind: 'spell', cost: 2, draw: 2, target: 'self', text: 'Draw 2 cards.' },
  { id: 'thorn-volley',  name: 'Thorn Volley',   elem: 'thorn', kind: 'spell', cost: 2, dmg: 2, target: 'all-foe', text: 'Deal 2 damage to every enemy creature.' },
  { id: 'quake',         name: 'Quake',          elem: 'stone', kind: 'spell', cost: 4, dmg: 3, target: 'all-foe', text: 'Deal 3 damage to every enemy creature.' },
];

export const CARD_BY_ID = Object.fromEntries(CARD_DEFS.map((c) => [c.id, c]));

export function describeCard(def) {
  return `${def.name} (${ELEMENTS[def.elem].name} ${def.cost})`;
}
