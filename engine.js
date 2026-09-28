// Literature rules engine + bots. No DOM; runs in the browser (window.Lit) and in Node (module.exports).
// Supports 4 players (2 teams of 2) and 6 players (2 teams of 3). Seats alternate teams, clockwise by seat number.
(function (root) {
  'use strict';

  const SUITS = ['S', 'H', 'D', 'C'];
  const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANK_LABEL = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const BOOKS = ['LS', 'LH', 'LD', 'LC', 'HS', 'HH', 'HD', 'HC', 'E'];
  const WIN_SCORE = 5;

  // Card ids: suit letter + rank number ("H12" = Q♥), jokers "X1" (black) and "X2" (red).
  const ALL = [];
  SUITS.forEach(s => { for (let r = 2; r <= 14; r++) ALL.push(s + r); });
  ALL.push('X1', 'X2');
  const ORDER = Object.fromEntries(ALL.map((c, i) => [c, i]));

  function rankOf(c) { return c[0] === 'X' ? 0 : Number(c.slice(1)); }
  function bookOf(c) {
    if (c[0] === 'X' || rankOf(c) === 8) return 'E';
    return (rankOf(c) < 8 ? 'L' : 'H') + c[0];
  }
  const BOOK_CARDS = Object.fromEntries(BOOKS.map(b => [b, ALL.filter(c => bookOf(c) === b)]));

  function isRed(c) { return c === 'X2' || c[0] === 'H' || c[0] === 'D'; }
  function cardRank(c) { return c[0] === 'X' ? 'Joker' : RANK_LABEL[rankOf(c)]; }
  function cardSuit(c) { return c[0] === 'X' ? '★' : SUIT_SYMBOL[c[0]]; }
  function cardText(c) {
    if (c === 'X1') return 'black Joker';
    if (c === 'X2') return 'red Joker';
    return cardRank(c) + cardSuit(c);
  }
  function bookName(b) {
    if (b === 'E') return 'Eights & Jokers';
    return (b[0] === 'L' ? 'Low ' : 'High ') + SUIT_SYMBOL[b[1]];
  }

  const teamOf = s => s % 2;
  const seatsOf = st => st.players.map((_, i) => i);
  const teamSeats = (st, t) => seatsOf(st).filter(s => teamOf(s) === t);
  const teammatesOf = (st, s) => seatsOf(st).filter(x => x !== s && teamOf(x) === teamOf(s));
  const opponentsOf = (st, s) => seatsOf(st).filter(x => teamOf(x) !== teamOf(s));
  // Seats after `from`, going clockwise, ending with `from` itself.
  const clockwise = (st, from) => seatsOf(st).map((_, i) => (from + 1 + i) % st.players.length);

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const sortHand = hand => hand.sort((a, b) => ORDER[a] - ORDER[b]);

  // opts: players (4 or 6), names, humanSeats, first, rng,
  //       bluffing (default on), naming (6 players only: calls must say who holds each card), strict (rule checks, default on).
  function newGame(opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const n = opts.players === 6 ? 6 : 4;
    const names = opts.names || (n === 6 ? ['You', 'P1', 'P2', 'P3', 'P4', 'P5'] : ['You', 'West', 'North', 'East']);
    const deck = shuffle(ALL.slice(), rng);
    let sizes;
    if (n === 6) sizes = [9, 9, 9, 9, 9, 9];
    else {
      // 54 cards over 4 players: each team gets one 14-card hand and one 13-card hand.
      sizes = [13, 13, 13, 13];
      sizes[rng() < 0.5 ? 0 : 2] = 14;
      sizes[rng() < 0.5 ? 1 : 3] = 14;
    }
    let k = 0;
    const players = sizes.map((size, s) => {
      const hand = sortHand(deck.slice(k, k + size));
      k += size;
      return { name: names[s], hand, isHuman: !!(opts.humanSeats && opts.humanSeats.includes(s)) };
    });
    return {
      players,
      rules: {
        players: n,
        bluffing: opts.bluffing !== false,
        naming: n === 6 && !!opts.naming,
        strict: opts.strict !== false,
      },
      turn: opts.first != null ? opts.first : Math.floor(rng() * n),
      claimed: {},          // book -> team that won it
      score: [0, 0],
      log: [],
      over: false,
      winner: null,
      seq: 0,
      // Everything below is public: any player at the table could have worked it out.
      pub: {
        known: {},          // card -> seat, once the card has moved in the open
        not: {},            // card -> [bool per seat], seats proven not to hold it (they were asked and missed)
        hint: players.map(() => ({})), // seat -> {book: true} once they have asked for a card in that book
        softNot: {},        // card -> [bool per seat], the asker probably doesn't hold it (unless bluffing)
        lastAsk: {},        // card -> seat that most recently asked for it and missed
      },
    };
  }

  const count = (st, s) => st.players[s].hand.length;
  const holds = (st, s, c) => st.players[s].hand.includes(c);
  const holdsBook = (st, s, b) => st.players[s].hand.some(c => bookOf(c) === b);
  const teamCards = (st, t) => teamSeats(st, t).reduce((a, s) => a + count(st, s), 0);
  const flags = st => st.players.map(() => false);
  function holderOf(st, c) {
    for (const s of seatsOf(st)) if (holds(st, s, c)) return s;
    return -1;
  }
  function nextWithCards(st, from) {
    return clockwise(st, from).find(s => count(st, s) > 0);
  }

  function pushEvent(st, ev) {
    ev.seq = ++st.seq;
    st.log.push(ev);
    return ev;
  }

  // Books a seat may ask in. With rule checks off, any open book.
  function askableBooks(st, s) {
    return BOOKS.filter(b => st.claimed[b] == null && (!st.rules.strict || holdsBook(st, s, b)));
  }

  function askError(st, from, to, card) {
    if (st.over) return 'The game is over.';
    if (st.turn !== from) return 'It is not your turn.';
    if (!Number.isInteger(to) || to < 0 || to >= st.players.length || teamOf(to) === teamOf(from)) return 'You can only ask an opponent.';
    if (!Object.prototype.hasOwnProperty.call(ORDER, card)) return 'Unknown card.';
    if (count(st, to) === 0) return st.players[to].name + ' is out of cards.';
    const b = bookOf(card);
    if (st.claimed[b] != null) return 'That book has already been called.';
    if (st.rules.strict && !holdsBook(st, from, b)) return 'You need a card from ' + bookName(b) + ' to ask for it.';
    if (!st.rules.bluffing && holds(st, from, card)) return 'Bluffing is off, and you already hold the ' + cardText(card) + '.';
    return null;
  }

  function ask(st, from, to, card) {
    const err = askError(st, from, to, card);
    if (err) throw new Error(err);
    const b = bookOf(card);
    const hit = holds(st, to, card);
    st.pub.hint[from][b] = true;
    if (hit) {
      const h = st.players[to].hand;
      h.splice(h.indexOf(card), 1);
      st.players[from].hand.push(card);
      sortHand(st.players[from].hand);
      st.pub.known[card] = from;
      delete st.pub.not[card];
      delete st.pub.softNot[card];
      if (st.pub.lastAsk) delete st.pub.lastAsk[card];
    } else {
      const not = (st.pub.not[card] = st.pub.not[card] || flags(st));
      not[to] = true;
      // Without bluffing, asking proves you don't hold the card. With bluffing it only suggests it.
      if (!st.rules.bluffing) not[from] = true;
      else (st.pub.softNot[card] = st.pub.softNot[card] || flags(st))[from] = true;
      if (st.pub.lastAsk) st.pub.lastAsk[card] = from;
      st.turn = to;
    }
    const ev = pushEvent(st, { type: 'ask', from, to, card, hit });
    if (hit && count(st, to) === 0) pushEvent(st, { type: 'out', seat: to });
    settle(st);
    return ev;
  }

  const namingRequired = st => st.rules.naming && st.players.length === 6;

  function callError(st, seat, book, assign) {
    if (st.over) return 'The game is over.';
    if (st.turn !== seat) return 'It is not your turn.';
    if (!BOOKS.includes(book)) return 'Unknown book.';
    if (st.claimed[book] != null) return 'That book has already been called.';
    if (namingRequired(st)) {
      for (const c of BOOK_CARDS[book]) {
        const s = assign && assign[c];
        if (!Number.isInteger(s) || s < 0 || s >= st.players.length || teamOf(s) !== teamOf(seat)) return 'Say which teammate holds the ' + cardText(c) + '.';
      }
    }
    return null;
  }

  // A call is correct when the caller's team holds all six cards between them
  // (and, with naming on, each card is with the teammate the caller named).
  // After a correct call the caller keeps the turn. After a wrong call the turn goes to the first opponent
  // clockwise from the caller who held a card of that book. Anyone left with no cards passes the turn clockwise.
  function call(st, seat, book, assign) {
    const err = callError(st, seat, book, assign);
    if (err) throw new Error(err);
    const team = teamOf(seat);
    const before = st.players.map((_, s) => count(st, s));
    const holders = BOOK_CARDS[book].map(c => holderOf(st, c));
    const onTeam = holders.every(h => h >= 0 && teamOf(h) === team);
    const named = !namingRequired(st) || BOOK_CARDS[book].every((c, i) => assign[c] === holders[i]);
    const correct = onTeam && named;
    const won = correct ? team : 1 - team;
    st.players.forEach(p => { p.hand = p.hand.filter(c => bookOf(c) !== book); });
    BOOK_CARDS[book].forEach(c => { delete st.pub.known[c]; delete st.pub.not[c]; delete st.pub.softNot[c]; if (st.pub.lastAsk) delete st.pub.lastAsk[c]; });
    st.claimed[book] = won;
    st.score[won]++;
    const ev = pushEvent(st, {
      type: 'call', seat, book, correct, team: won, holders,
      assign: namingRequired(st) ? BOOK_CARDS[book].map(c => assign[c]) : null,
    });
    st.players.forEach((_, s) => { if (before[s] > 0 && count(st, s) === 0) pushEvent(st, { type: 'out', seat: s }); });
    if (!correct) {
      const oppHolders = clockwise(st, seat).filter(s => teamOf(s) !== team && holders.includes(s));
      const next = oppHolders.find(s => count(st, s) > 0);
      const to = next != null ? next : nextWithCards(st, seat);
      if (to != null && to !== seat) {
        st.turn = to;
        pushEvent(st, { type: 'pass', from: seat, to, reason: 'wrong' });
      }
    }
    settle(st);
    return ev;
  }

  function finish(st) {
    st.over = true;
    st.winner = st.score[0] > st.score[1] ? 0 : 1;
    pushEvent(st, { type: 'end', winner: st.winner, score: st.score.slice() });
  }

  // Runs after every action: ends the game, sweeps books when a team runs dry, skips players who are out.
  function settle(st) {
    if (st.over) return;
    if (st.score[0] >= WIN_SCORE || st.score[1] >= WIN_SCORE) return finish(st);
    for (const t of [0, 1]) {
      if (teamCards(st, t) === 0 && teamCards(st, 1 - t) > 0) {
        // The other team holds every remaining card, so every remaining book is theirs.
        const books = BOOKS.filter(b => st.claimed[b] == null);
        books.forEach(b => { st.claimed[b] = 1 - t; st.score[1 - t]++; });
        st.players.forEach(p => { p.hand = []; });
        st.pub.known = {}; st.pub.not = {}; st.pub.softNot = {}; st.pub.lastAsk = {};
        pushEvent(st, { type: 'sweep', team: 1 - t, books });
        return finish(st);
      }
    }
    if (BOOKS.every(b => st.claimed[b] != null)) return finish(st);
    if (count(st, st.turn) === 0) {
      const to = nextWithCards(st, st.turn);
      pushEvent(st, { type: 'pass', from: st.turn, to, reason: 'out' });
      st.turn = to;
    }
  }

  function legalAsks(st, seat) {
    const out = [];
    const books = askableBooks(st, seat);
    for (const to of opponentsOf(st, seat)) {
      if (count(st, to) === 0) continue;
      for (const b of books) for (const c of BOOK_CARDS[b]) {
        if (st.rules.bluffing || !holds(st, seat, c)) out.push({ to, card: c });
      }
    }
    return out;
  }

  // For every card still in play, the seats that could be holding it, as seen by `me`
  // (my own hand + everything said at the table). With memory=false, only my own hand and card counts are used.
  function possibleHolders(st, me, memory, quick) {
    if (memory === undefined) memory = true;
    const seats = seatsOf(st);
    const poss = {};
    const live = seats.filter(s => count(st, s) > 0);
    for (const b of BOOKS) {
      if (st.claimed[b] != null) continue;
      for (const c of BOOK_CARDS[b]) {
        if (me != null && holds(st, me, c)) poss[c] = [me];
        else if (memory && st.pub.known[c] != null) poss[c] = [st.pub.known[c]];
        else poss[c] = live.filter(s => s !== me && !(memory && st.pub.not[c] && st.pub.not[c][s]));
      }
    }
    // Card-count propagation: if a seat's known cards fill its hand it holds nothing else,
    // and if a seat's possible cards exactly fill its hand it holds all of them.
    const cards = Object.keys(poss);
    let changed = !quick;
    while (changed) {
      changed = false;
      for (const s of seats) {
        const n = count(st, s);
        const sure = cards.filter(c => poss[c].length === 1 && poss[c][0] === s);
        if (sure.length === n) {
          for (const c of cards) {
            if (poss[c].length > 1 && poss[c].includes(s)) { poss[c] = poss[c].filter(x => x !== s); changed = true; }
          }
        }
        const maybe = cards.filter(c => poss[c].includes(s));
        if (maybe.length === n) {
          for (const c of maybe) if (poss[c].length > 1) { poss[c] = [s]; changed = true; }
        }
      }
    }
    return poss;
  }

  // How likely seat `s` is to hold card `c`, relative to the other possible holders, from what it has said:
  //   - asking in a book suggests holding a card there (x2);
  //   - asking for a card and missing suggests not holding it (x0.25), since most asks are honest;
  //   - double-bluff reading: when two players on one team have both asked for the same card and missed, one of
  //     them is bluffing. The later asker is taken as the likely holder (x2 instead of x0.25): asking again for a card
  //     a teammate already chased is how a player holding it protects it. Over 8,000 bot games this reading won
  //     50% of 4 player games against bots without it (no difference) and 56% of 6 player games.
  function askWeight(st, s, c) {
    const b = bookOf(c);
    let w = st.pub.hint[s][b] ? 2 : 1;
    const soft = st.pub.softNot[c];
    if (soft && soft[s]) {
      const later = st.pub.lastAsk && st.pub.lastAsk[c] === s && teammatesOf(st, s).some(m => soft[m]);
      w *= later ? 2 : 0.25;
    }
    return w;
  }

  // Best guess at who holds each card of a book, for a call that has to name holders.
  function guessAssign(st, seat, book, poss) {
    const team = teamOf(seat);
    const assign = {};
    for (const c of BOOK_CARDS[book]) {
      const mine = poss[c].filter(s => teamOf(s) === team);
      assign[c] = mine.length ? mine[0] : seat;
    }
    return assign;
  }

  // Bots: 'sharp' tracks every card perfectly from what's been said at the table; 'casual' only pays attention
  // on about half its turns, otherwise it plays from its own hand and asks at random.
  // `quick` skips the card-count deductions; the search uses it for its fast simulated players.
  // `steer` (0 = off) makes the bot think about who gets the turn if its ask misses: a miss hands the turn to the
  // player asked, so it avoids asking an opponent who could use that turn to take a set from its team.
  function botMove(st, seat, level, rng, quick, steer) {
    rng = rng || Math.random;
    const sharp = level !== 'casual' || rng() < 0.5;
    const team = teamOf(seat);
    const naming = namingRequired(st);
    const poss = possibleHolders(st, seat, sharp, quick);
    const open = BOOKS.filter(b => st.claimed[b] == null);
    const callMove = b => ({ type: 'call', book: b, assign: naming ? guessAssign(st, seat, b, poss) : undefined });

    for (const b of open) {
      const sure = BOOK_CARDS[b].every(c => poss[c].length && poss[c].every(s => teamOf(s) === team) && (!naming || poss[c].length === 1));
      if (sure) return callMove(b);
    }

    const mine = open.filter(b => holdsBook(st, seat, b));
    if (!sharp) {
      // A casual bot sometimes gambles on a book it nearly has.
      for (const b of mine) {
        const have = BOOK_CARDS[b].filter(c => holds(st, seat, c)).length;
        if (have >= 5 && rng() < 0.12) return callMove(b);
      }
    }

    const opps = opponentsOf(st, seat).filter(s => count(st, s) > 0);
    const danger = {};
    if (steer && sharp) {
      const pub = possibleHolders(st, null, true);
      opps.forEach(o => { danger[o] = turnDanger(st, seat, o, poss, pub); });
    }
    const options = [];
    for (const b of mine) {
      const teamKnown = BOOK_CARDS[b].filter(c => poss[c].every(s => teamOf(s) === team)).length;
      for (const c of BOOK_CARDS[b]) {
        if (holds(st, seat, c)) continue;
        const weight = s => (sharp ? askWeight(st, s, c) : 1);
        const total = poss[c].reduce((a, s) => a + weight(s), 0);
        for (const o of opps) {
          if (!poss[c].includes(o)) continue;
          const p = weight(o) / total;
          const risk = steer && sharp ? steer * (1 - p) * danger[o] : 0;
          options.push({ to: o, card: c, score: p + (sharp ? 0.08 * teamKnown / 6 : 0) - risk + rng() * 0.01, p });
        }
      }
    }
    if (options.length) {
      if (!sharp) {
        const pick = options[Math.floor(rng() * options.length)];
        return { type: 'ask', to: pick.to, card: pick.card };
      }
      options.sort((a, b) => b.score - a.score);
      const best = options[0];
      // Bluff policy: when the best honest ask is a long shot the turn is probably lost anyway,
      // so sometimes spend it planting a false "I don't have this" on a card we hold in a book opponents are chasing.
      // A double bluff (asking for a card a teammate already asked for and missed) is not a Sharp rule of thumb:
      // a table that reads repeated asks sees through it, and in testing it cost more turns than it saved.
      // The Expert search still tries it as a candidate and plays it only when its play-outs show a gain.
      if (st.rules.bluffing && best.p < 0.4 && rng() < 0.3) {
        const bluff = bluffAsk(st, seat, opps, rng, steer ? danger : null);
        if (bluff) return bluff;
      }
      return { type: 'ask', to: best.to, card: best.card };
    }
    // Nothing useful to ask. With naming on, a book can be all ours but split between teammates we can't tell apart,
    // so make the best-guess call on the book we know most about; otherwise ask anything legal.
    if (naming) {
      const ours = open.filter(b => BOOK_CARDS[b].every(c => poss[c].length && poss[c].every(s => teamOf(s) === team)));
      if (ours.length) return callMove(ours[0]);
    }
    const all = legalAsks(st, seat);
    const honest = all.filter(m => !holds(st, seat, m.card));
    const legal = honest.length ? honest : all;
    if (!legal.length) return callMove(mine[0] || open[0]);
    const pick = legal[Math.floor(rng() * legal.length)];
    return { type: 'ask', to: pick.to, card: pick.card };
  }

  // ---------- Expert search ----------
  // Determinized Monte Carlo search. The searching seat cannot see other hands, so it repeatedly:
  //   1. deals the unseen cards at random in a way that fits everything said at the table,
  //   2. picks one of its candidate moves (UCB1: mostly the promising ones, sometimes the rest),
  //   3. plays that move, then plays on for a fixed number of moves with fast Sharp bots,
  //   4. scores the result for its team and adds it to that move's average.
  // The simulated players react to what they hear (asks in a book, likely misses), so a bluff that misleads them
  // or an honest ask that exposes a book changes the outcomes, and the search learns when each is worth it.

  function cloneLite(st) {
    const copyFlags = o => Object.fromEntries(Object.entries(o).map(([c, a]) => [c, a.slice()]));
    return {
      players: st.players.map(p => ({ name: p.name, hand: p.hand.slice(), isHuman: false })),
      rules: Object.assign({}, st.rules),
      turn: st.turn, claimed: Object.assign({}, st.claimed), score: st.score.slice(),
      log: [], over: st.over, winner: st.winner, seq: st.seq,
      pub: {
        known: Object.assign({}, st.pub.known),
        not: copyFlags(st.pub.not),
        hint: st.pub.hint.map(h => Object.assign({}, h)),
        softNot: copyFlags(st.pub.softNot),
        lastAsk: Object.assign({}, st.pub.lastAsk || {}),
      },
    };
  }

  // A random full deal that fits `poss` (who could hold each card) and every hand size. Uses augmenting paths,
  // so it always finds a deal when one exists; the true deal always fits, because `poss` never rules out a real holder.
  function sampleWorld(st, me, poss, rng) {
    const w = cloneLite(st);
    const seats = seatsOf(st);
    const cap = seats.map(s => (s === me ? 0 : count(st, s)));
    const cards = shuffle(Object.keys(poss).filter(c => !holds(st, me, c)), rng);
    const owner = {}, load = seats.map(() => []);
    const tryPlace = (c, seen) => {
      for (const s of shuffle(poss[c].filter(x => x !== me), rng)) {
        if (seen[s]) continue;
        seen[s] = true;
        if (load[s].length < cap[s]) { load[s].push(c); owner[c] = s; return true; }
        for (const other of shuffle(load[s].slice(), rng)) {
          if (tryPlace(other, seen)) {
            load[s].splice(load[s].indexOf(other), 1);
            load[s].push(c); owner[c] = s;
            return true;
          }
        }
      }
      return false;
    };
    for (const c of cards) if (!tryPlace(c, {})) return null;
    seats.forEach(s => { if (s !== me) w.players[s].hand = sortHand(load[s].slice()); });
    return w;
  }

  // Score for `team` in [0, 1]: 1 or 0 if the game is over, else books won plus a share of each open book
  // according to how many of its cards each team holds.
  function evaluate(w, team) {
    if (w.over) return w.winner === team ? 1 : 0;
    let v = w.score[team] - w.score[1 - team];
    for (const b of BOOKS) {
      if (w.claimed[b] != null) continue;
      let mine = 0;
      for (const c of BOOK_CARDS[b]) { const h = holderOf(w, c); if (h >= 0 && teamOf(h) === team) mine++; }
      v += 0.9 * (mine / 6 * 2 - 1);
    }
    return 1 / (1 + Math.exp(-0.8 * v));
  }

  const moveKey = m => m.type === 'call'
    ? 'c:' + m.book + (m.assign ? ':' + BOOK_CARDS[m.book].map(c => m.assign[c]).join('') : '')
    : 'a:' + m.to + ':' + m.card;

  // Moves worth simulating: certain calls, the most promising honest asks (ranked the way Sharp bots rank them),
  // and a few bluffs, preferring cards in books an opponent is chasing. `wide` (the Coach) keeps more asks.
  function candidateMoves(st, seat, poss, wide, rng) {
    const team = teamOf(seat);
    const naming = namingRequired(st);
    const out = [];
    for (const b of BOOKS) {
      if (st.claimed[b] != null) continue;
      if (BOOK_CARDS[b].every(c => poss[c].length && poss[c].every(s => teamOf(s) === team))) {
        out.push({ type: 'call', book: b, assign: naming ? guessAssign(st, seat, b, poss) : undefined });
      }
    }
    const honest = [], bluffs = [];
    for (const m of legalAsks(st, seat)) {
      const move = { type: 'ask', to: m.to, card: m.card };
      if (holds(st, seat, m.card)) { bluffs.push(move); continue; }
      const p = poss[m.card];
      if (!p.includes(m.to)) continue;
      const b = bookOf(m.card);
      const weight = s => askWeight(st, s, m.card);
      const total = p.reduce((a, s) => a + weight(s), 0);
      const teamKnown = BOOK_CARDS[b].filter(c => poss[c].every(s => teamOf(s) === team)).length;
      honest.push({ move, score: weight(m.to) / total + 0.08 * teamKnown / 6 });
    }
    honest.sort((x, y) => y.score - x.score);
    // Only bluffs the table can't see through: never a card everyone already knows this player holds.
    const known = publiclyKnownCards(st, seat);
    const believable = bluffs.filter(m => !known.has(m.card));
    const chased = believable.filter(m => st.pub.hint[m.to][bookOf(m.card)]);
    // Double bluffs (a card a teammate asked for earlier) are always tried, ahead of the other bluffs.
    const dbl = new Set(doubleBluffCards(st, seat, opponentsOf(st, seat).filter(o => count(st, o) > 0)));
    const doubles = chased.filter(m => dbl.has(m.card));
    const rest = shuffle((chased.length ? chased : believable).filter(m => !dbl.has(m.card)), rng);
    const bluffPool = doubles.concat(rest).slice(0, wide ? 4 : 3);
    return out.concat(honest.slice(0, wide ? 10 : 6).map(h => h.move), bluffPool);
  }

  function Search(st, seat, opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.seat = seat;
    this.team = teamOf(seat);
    this.depth = opts.depth || 14;
    this.baseline = opts.baseline ? moveKey(opts.baseline) : null;
    this.root = cloneLite(st);
    this.poss = possibleHolders(this.root, seat, true);
    const moves = opts.moves || candidateMoves(this.root, seat, this.poss, !!opts.full, this.rng);
    this.stats = [];
    if (opts.baseline) this.add(opts.baseline);
    moves.forEach(m => this.add(m));
    this.iterations = 0;
  }
  Search.prototype.add = function (move) {
    const key = moveKey(move);
    let s = this.stats.find(x => x.key === key);
    if (!s) { s = { move, key, n: 0, total: 0, vals: [] }; this.stats.push(s); }
    return s;
  };
  // One round: imagine one deal that fits the table, then play every candidate move from that same deal,
  // so the candidates are compared on equal terms.
  Search.prototype.round = function () {
    const world = sampleWorld(this.root, this.seat, this.poss, this.rng);
    if (!world) return;
    for (const s of this.stats) {
      const w = cloneLite(world);
      try {
        applyMove(w, this.seat, s.move);
        for (let i = 0; i < this.depth && !w.over; i++) applyMove(w, w.turn, botMove(w, w.turn, 'sharp', this.rng, true));
      } catch (e) { s.vals[this.iterations] = NaN; continue; }
      const v = evaluate(w, this.team);
      s.vals[this.iterations] = v;
      s.n++;
      s.total += v;
    }
    this.iterations++;
  };
  // Runs for about `ms` milliseconds, or exactly `rounds` rounds. Can be called again to keep improving.
  Search.prototype.run = function (ms, rounds) {
    if (!this.stats.length) return this;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const end = now() + (ms || 0);
    let k = 0;
    do { this.round(); k++; } while (rounds ? k < rounds : now() < end);
    return this;
  };
  // How much better `s` did than `base` on the same imagined deals: mean difference and its standard error.
  function pairedGain(s, base) {
    const d = [];
    for (let i = 0; i < s.vals.length; i++) {
      const a = s.vals[i], b = base.vals[i];
      if (a === a && b === b && a != null && b != null) d.push(a - b);
    }
    if (d.length < 2) return { gain: 0, se: Infinity };
    const mean = d.reduce((x, y) => x + y, 0) / d.length;
    const varc = d.reduce((x, y) => x + (y - mean) * (y - mean), 0) / (d.length - 1);
    return { gain: mean, se: Math.sqrt(varc / d.length) };
  }
  // Every simulated move with its estimated chance of winning, best first. With a baseline (the move a Sharp
  // bot would make), `best` only switches away from it when another move is clearly better: its gain on the
  // same deals must be at least twice its standard error. Otherwise noise would pick moves at random.
  Search.prototype.result = function () {
    const ranked = this.stats.filter(s => s.n > 0)
      .map(s => ({ move: s.move, key: s.key, value: s.total / s.n, n: s.n }))
      .sort((a, b) => b.value - a.value);
    let best = ranked[0] || null;
    const base = this.baseline && this.stats.find(s => s.key === this.baseline);
    if (base && base.n > 0) {
      best = ranked.find(r => r.key === base.key);
      let bestGain = 0;
      for (const s of this.stats) {
        if (s === base || s.n === 0) continue;
        const g = pairedGain(s, base);
        if (g.gain > 0.01 && g.gain > 2 * g.se && g.gain > bestGain) { bestGain = g.gain; best = ranked.find(r => r.key === s.key); }
      }
    }
    return { best, ranked, iterations: this.iterations };
  };

  // Expert bot: takes a certain call at once, otherwise searches for `ms` milliseconds.
  function expertMove(st, seat, ms, rng, steer) {
    const quick = botMove(st, seat, 'sharp', rng, false, steer);
    if (quick.type === 'call') {
      const poss = possibleHolders(st, seat, true);
      const naming = namingRequired(st);
      const sure = BOOK_CARDS[quick.book].every(c => poss[c].length && poss[c].every(s => teamOf(s) === teamOf(seat)) && (!naming || poss[c].length === 1));
      if (sure) return quick;
    }
    const search = new Search(st, seat, { rng, baseline: quick });
    if (search.stats.length <= 1) return search.stats.length ? search.stats[0].move : quick;
    const r = search.run(ms || 800).result();
    return r.best ? r.best.move : quick;
  }

  // ---------- Card odds ----------
  // Who holds each card, as a probability, from `me`'s point of view. Samples many full deals that fit everything
  // said at the table and every hand size (a player with 2 cards is far less likely to hold a given card than one
  // with 12), and weights each deal by how well it explains what players asked for:
  //   - a player who asked in a book and holds none of its cards in this deal: x0.5 (their ask is less likely);
  //   - a player holding a card they asked for and missed: x0.25, or x2 for the later of two same-team askers
  //     (the double-bluff reading), the same factors the bots use.
  // Sampling is a Markov chain over deals: swap two cards between players (or rotate three), accepting the swap
  // in proportion to the new deal's weight, so deals come up as often as they deserve. Several chains start from
  // different random deals. Returns { odds: {card: {seat: p}}, samples }.
  function cardOdds(st, me, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const want = opts.samples || 4000;
    const hintNone = opts.hintNone != null ? opts.hintNone : 0.5;
    const perCard = opts.perCard !== false;
    const hintW = opts.hintW || 3;
    const chains = opts.chains || 4;
    const poss = possibleHolders(st, me, true);
    const seats = seatsOf(st);
    const odds = {};
    const cards = Object.keys(poss).filter(c => !(me != null && holds(st, me, c)));
    cards.forEach(c => { odds[c] = {}; });
    const free = cards.filter(c => poss[c].length > 1);
    const fixed = cards.filter(c => poss[c].length === 1);
    if (!free.length) { fixed.forEach(c => { odds[c][poss[c][0]] = 1; }); return { odds, samples: 1 }; }
    const hintPairs = [];
    seats.forEach(s => { if (s === me) return; for (const b of BOOKS) if (st.claimed[b] == null && st.pub.hint[s][b]) hintPairs.push([s, b]); });
    const factorFor = (c, s) => {   // behaviour factor for seat s holding card c
      const soft = st.pub.softNot[c];
      if (!soft || !soft[s]) return 1;
      const later = st.pub.lastAsk && st.pub.lastAsk[c] === s && teammatesOf(st, s).some(m => soft[m]);
      return later ? 2 : 0.25;
    };
    const logW = owner => {
      let lw = 0;
      for (const c of free) lw += Math.log(perCard ? (st.pub.hint[owner[c]][bookOf(c)] ? hintW : 1) * factorFor(c, owner[c]) : factorFor(c, owner[c]));
      if (perCard) return lw;
      for (const [s, b] of hintPairs) {
        const any = BOOK_CARDS[b].some(c => (owner[c] != null ? owner[c] === s : holds(st, s, c) && s === me));
        if (!any) lw += Math.log(hintNone);
      }
      return lw;
    };
    const counts = {};
    free.forEach(c => { counts[c] = {}; });
    let kept = 0;
    const perChain = Math.ceil(want / chains);
    for (let k = 0; k < chains; k++) {
      const w = sampleWorld(st, me, poss, rng);
      if (!w) break;
      const owner = {};
      cards.forEach(c => { owner[c] = holderOf(w, c); });
      let cur = logW(owner);
      const burn = 30 * free.length, thin = Math.max(4, Math.ceil(free.length / 4));
      const steps = burn + perChain * thin;
      for (let i = 0; i < steps; i++) {
        // propose: swap two cards, or rotate three, between different holders, keeping every card with a possible holder
        const n = rng() < 0.7 ? 2 : 3;
        const pick = [];
        for (let j = 0; j < n; j++) pick.push(free[Math.floor(rng() * free.length)]);
        const from = pick.map(c => owner[c]);
        const to = from.map((_, j) => from[(j + 1) % n]);   // card j moves to the next card's holder
        if (new Set(from).size === n && pick.every((c, j) => poss[c].includes(to[j]))) {
          pick.forEach((c, j) => { owner[c] = to[j]; });
          const next = logW(owner);
          if (Math.log(rng()) < next - cur) cur = next;
          else pick.forEach((c, j) => { owner[c] = from[j]; });
        }
        if (i >= burn && (i - burn) % thin === 0) {
          for (const c of free) counts[c][owner[c]] = (counts[c][owner[c]] || 0) + 1;
          kept++;
        }
      }
    }
    fixed.forEach(c => { odds[c][poss[c][0]] = 1; });
    free.forEach(c => { for (const s in counts[c]) odds[c][s] = counts[c][s] / Math.max(1, kept); });
    return { odds, samples: kept };
  }

  // Cards the whole table can already place in `seat`'s hand (it took them in the open, or card counts prove it).
  // Asking for one of these fools nobody, so they are never used for a bluff.
  function publiclyKnownCards(st, seat) {
    const pub = possibleHolders(st, null, true);
    return new Set(st.players[seat].hand.filter(c => pub[c] && pub[c].length === 1 && pub[c][0] === seat));
  }

  // How badly `seat`'s team would be hurt by opponent `o` getting the turn: sets where o's team certainly holds
  // most of the cards, o is in the set, and the few remaining cards are with us (worse if the table can place them).
  function turnDanger(st, seat, o, poss, pub) {
    const team = teamOf(seat);
    let d = 0;
    for (const b of BOOKS) {
      if (st.claimed[b] != null) continue;
      const cards = BOOK_CARDS[b];
      const theirs = cards.filter(c => poss[c].length && poss[c].every(s => teamOf(s) !== team)).length;
      const ours = cards.filter(c => poss[c].length && poss[c].every(s => teamOf(s) === team));
      if (!ours.length || theirs < 2) continue;
      if (!(st.pub.hint[o][b] || cards.some(c => poss[c].length === 1 && poss[c][0] === o))) continue;
      const exposed = ours.filter(c => pub[c] && pub[c].length === 1).length;
      d += (theirs / 6) * (exposed ? 1 : 0.4) * (ours.length <= 2 ? 1 : 0.5);
    }
    return d;
  }

  // Cards this player holds that a teammate asked for earlier and missed (the table still marks that teammate
  // "probably not"), in a book an opponent is chasing. These are the double-bluff candidates.
  function doubleBluffCards(st, seat, opps) {
    const known = publiclyKnownCards(st, seat);
    const mates = teammatesOf(st, seat);
    return st.players[seat].hand.filter(c => !known.has(c) && st.pub.softNot[c] && mates.some(m => st.pub.softNot[c][m])
      && opps.some(o => st.pub.hint[o][bookOf(c)]));
  }

  function bluffAsk(st, seat, opps, rng, danger) {
    const known = publiclyKnownCards(st, seat);
    const targets = st.players[seat].hand.filter(c => !known.has(c) && opps.some(o => st.pub.hint[o][bookOf(c)]));
    if (!targets.length || !opps.length) return null;
    const card = targets[Math.floor(rng() * targets.length)];
    let chasing = opps.filter(o => st.pub.hint[o][bookOf(card)]);
    // A bluff always misses, so a steering bot hands that turn to the least dangerous opponent.
    if (danger && chasing.length > 1) {
      const low = Math.min(...chasing.map(o => danger[o] || 0));
      chasing = chasing.filter(o => (danger[o] || 0) === low);
    }
    return { type: 'ask', to: chasing[Math.floor(rng() * chasing.length)], card };
  }

  function applyMove(st, seat, move) {
    if (!move) throw new Error('No move.');
    if (move.type === 'call') return call(st, seat, move.book, move.assign);
    if (move.type === 'ask') return ask(st, seat, move.to, move.card);
    throw new Error('Unknown move.');
  }

  const Lit = {
    SUITS, SUIT_SYMBOL, BOOKS, BOOK_CARDS, ALL, WIN_SCORE,
    bookOf, rankOf, isRed, cardRank, cardSuit, cardText, bookName,
    teamOf, teammatesOf, opponentsOf, teamSeats, holderOf, holdsBook, askableBooks, namingRequired,
    newGame, ask, call, askError, callError, legalAsks, possibleHolders, botMove, applyMove,
    Search, expertMove, sampleWorld, moveKey, evaluate, doubleBluffCards, askWeight, cardOdds,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Lit;
  else root.Lit = Lit;
})(typeof window !== 'undefined' ? window : this);
