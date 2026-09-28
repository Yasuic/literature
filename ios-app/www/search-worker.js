// Runs the Expert search off the page's main thread, so the table stays responsive while bots think.
importScripts('engine.js');

onmessage = e => {
  const d = e.data;
  let out;
  try {
    if (d.kind === 'expert') {
      out = { move: Lit.expertMove(d.st, d.seat, d.ms, undefined, d.steer) };
    } else {
      const s = new Lit.Search(d.st, d.seat, { full: d.full, moves: d.moves, baseline: d.baseline });
      s.run(d.ms);
      out = s.result();
    }
  } catch (err) {
    out = { error: String(err && err.message || err) };
  }
  postMessage({ id: d.id, out });
};
