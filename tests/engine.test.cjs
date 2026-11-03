const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../engine.js');

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function position(hands, opts = {}) {
  const st = L.newGame({ players: hands.length, first: 0, ...opts });
  st.players.forEach((p, i) => { p.hand = hands[i].slice(); });
  return st;
}

function assertConserved(st) {
  const live = st.players.flatMap(p => p.hand);
  assert.equal(new Set(live).size, live.length, 'a card cannot appear twice');
  assert.equal(live.length + Object.keys(st.claimed).length * 6, 54);
  for (const card of live) assert.equal(st.claimed[L.bookOf(card)], undefined);
  for (const team of [0, 1]) {
    assert.equal(st.score[team], Object.values(st.claimed).filter(t => t === team).length);
  }
  if (!st.over) assert.ok(st.players[st.turn].hand.length > 0);
}

test('54 cards form nine separate books of six', () => {
  assert.equal(L.ALL.length, 54);
  assert.equal(new Set(L.ALL).size, 54);
  assert.equal(L.BOOKS.length, 9);
  for (const book of L.BOOKS) assert.equal(L.BOOK_CARDS[book].length, 6);
  assert.deepEqual(new Set(L.BOOK_CARDS.E), new Set(['S8', 'H8', 'D8', 'C8', 'X1', 'X2']));
});

test('four player deals give each team 27 cards and six player deals give everyone nine', () => {
  for (const players of [4, 6]) for (let seed = 1; seed <= 40; seed++) {
    const st = L.newGame({ players, rng: rng(seed) });
    assertConserved(st);
    for (const team of [0, 1]) {
      assert.equal(st.players.reduce((n, p, i) => n + (L.teamOf(i) === team ? p.hand.length : 0), 0), 27);
    }
    assert.deepEqual(st.players.map(p => p.hand.length).sort(), players === 4 ? [13, 13, 14, 14] : [9, 9, 9, 9, 9, 9]);
  }
});

test('a hit transfers a card and keeps the turn; a miss gives the target the turn', () => {
  const st = position([['S2'], ['S3', 'H2'], ['D2'], ['C2']]);
  assert.equal(L.ask(st, 0, 1, 'S3').hit, true);
  assert.ok(st.players[0].hand.includes('S3'));
  assert.ok(!st.players[1].hand.includes('S3'));
  assert.equal(st.turn, 0);
  assert.equal(st.pub.known.S3, 0);
  assert.equal(L.ask(st, 0, 3, 'S4').hit, false);
  assert.equal(st.turn, 3);
  assert.equal(st.pub.not.S4[3], true);
});

test('asks reject teammates, absent books, invalid cards and the wrong turn', () => {
  const st = position([['S2'], ['H2'], ['D2'], ['C2']]);
  assert.throws(() => L.ask(st, 0, 2, 'S3'), /opponent/);
  assert.throws(() => L.ask(st, 0, 1, 'H3'), /need a card/);
  assert.throws(() => L.ask(st, 0, 1, 'S99'), /Unknown card/);
  assert.throws(() => L.ask(st, 1, 0, 'H3'), /not your turn/);
  st.rules.strict = false;
  assert.equal(L.askError(st, 0, 1, 'H3'), null);
});

test('losing the final card in a book removes permission to ask in that book', () => {
  const st = position([['S2', 'H2'], ['S3'], ['D2'], ['C2']]);
  st.turn = 1;
  L.ask(st, 1, 0, 'S2');
  st.turn = 0;
  assert.ok(!L.askableBooks(st, 0).includes('LS'));
  assert.throws(() => L.ask(st, 0, 1, 'S2'), /need a card/);
});

test('a bluff is allowed only when enabled and does not make false hard evidence', () => {
  const st = position([['S2'], ['H2'], ['D2'], ['C2']]);
  L.ask(st, 0, 1, 'S2');
  assert.equal(st.turn, 1);
  assert.equal(st.pub.softNot.S2[0], true);
  assert.ok(!st.pub.not.S2[0]);
  assert.ok(L.possibleHolders(st, 2, true).S2.includes(0));
  st.turn = 0;
  st.rules.bluffing = false;
  assert.throws(() => L.ask(st, 0, 1, 'S2'), /Bluffing is off/);
});

test('a correct call removes six cards and awards one book', () => {
  const st = position([['S2', 'S3', 'H2'], ['C2'], ['S4', 'S5', 'S6', 'S7', 'D2'], ['C3']]);
  assert.equal(L.call(st, 0, 'LS').correct, true);
  assert.equal(st.claimed.LS, 0);
  assert.deepEqual(st.score, [1, 0]);
  assert.equal(st.turn, 0);
  assert.ok(st.players.every(p => p.hand.every(c => L.bookOf(c) !== 'LS')));
});

test('a wrong call awards the opponents and chooses the first eligible opponent clockwise', () => {
  const st = position([['S2', 'H2'], ['S3', 'C2'], ['S4', 'S5', 'D2'], ['S6', 'S7', 'C3']]);
  assert.equal(L.call(st, 0, 'LS').correct, false);
  assert.equal(st.claimed.LS, 1);
  assert.equal(st.turn, 1);
  assert.deepEqual(st.score, [0, 1]);
});

test('a caller with no cards after a correct call is skipped clockwise', () => {
  const st = position([['S2', 'S3'], ['H2'], ['S4', 'S5', 'S6', 'S7', 'D2'], ['C2']]);
  L.call(st, 0, 'LS');
  assert.equal(st.turn, 1);
  assert.ok(st.log.some(e => e.type === 'pass' && e.reason === 'out'));
});

test('six player naming requires every card and penalizes an incorrect allocation', () => {
  const hands = [['S2', 'H2'], ['C2'], ['S3', 'S4', 'D2'], ['C3'], ['S5', 'S6', 'S7', 'H3'], ['C4']];
  const assign = { S2: 0, S3: 2, S4: 2, S5: 4, S6: 4, S7: 4 };
  const correct = position(hands, { naming: true });
  assert.throws(() => L.call(correct, 0, 'LS'), /Say which teammate/);
  assert.equal(L.call(correct, 0, 'LS', assign).correct, true);
  const wrong = position(hands, { naming: true });
  assert.equal(L.call(wrong, 0, 'LS', { ...assign, S3: 4 }).correct, false);
  assert.equal(wrong.claimed.LS, 1);
});

test('running out as a team awards all remaining books to the opponents', () => {
  const st = position([['S2', 'S3'], ['H2'], ['S4', 'S5', 'S6', 'S7'], ['C2']]);
  L.call(st, 0, 'LS');
  assert.ok(st.over);
  assert.equal(st.winner, 1);
  assert.deepEqual(st.score, [1, 8]);
  assert.equal(st.players.flatMap(p => p.hand).length, 0);
});

test('the fifth book finishes a game', () => {
  const st = position([['S2', 'S3', 'H2'], ['C2'], ['S4', 'S5', 'S6', 'S7', 'D2'], ['C3']]);
  st.claimed = { HS: 0, HH: 0, HD: 0, HC: 0 };
  st.score = [4, 0];
  L.call(st, 0, 'LS');
  assert.ok(st.over);
  assert.equal(st.winner, 0);
  assert.throws(() => L.ask(st, 0, 1, 'H3'), /game is over/);
});

test('seeded bot games conserve cards and public deductions never exclude a true holder', { timeout: 30000 }, () => {
  for (const players of [4, 6]) for (const bluffing of [true, false]) {
    const random = rng(players * 19 + Number(bluffing));
    const st = L.newGame({ players, rng: random, bluffing, naming: players === 6 });
    for (let move = 0; move < 1000 && !st.over; move++) {
      const action = L.botMove(st, st.turn, 'sharp', random, true, true);
      L.applyMove(st, st.turn, action);
      assertConserved(st);
      for (const viewer of [0, 1]) {
        const possible = L.possibleHolders(st, viewer, true, true);
        st.players.forEach((p, seat) => p.hand.forEach(c => assert.ok(possible[c].includes(seat), `excluded ${c} from seat ${seat}`)));
      }
    }
    assert.ok(st.over, `${players} player game must finish`);
  }
});
