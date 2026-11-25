// Compares cyberai-triage.js with the real CyberAI.py (internet off) on the cases made by gen_cases.py.
// usage: node run_parity.js        (exit code 1 if anything differs; TRIAGE_JS=path tests another copy of the port)
const fs = require('fs');
const path = require('path');
const T = require(process.env.TRIAGE_JS || path.join(__dirname, '..', '..', 'cyberai-triage.js'));
T.loadSuffixes(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'cyberai-suffixes.json'), 'utf8')));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let total = 0, bad = 0;
const show = (name, i, input, exp, got) => { if (bad <= 25) console.log('MISMATCH', name, i, JSON.stringify(input).slice(0, 160), '\n   python:', JSON.stringify(exp).slice(0, 300), '\n   js:    ', JSON.stringify(got).slice(0, 300)); };

function packJs(kind, r) {
  if (r.error) return { error: true };
  const o = { verdict: r.verdict, score: r.score, reasons: r.reasons };
  if (kind === 'url') { o.domain = r.domain; o.heuristics = r.heuristics; }
  if (kind === 'email') { o.sender = r.sender; o.alerts = r.alerts; o.urls = r.urls; }
  if (kind === 'pdf') { o.urls = r.urls; }
  return o;
}
for (const kind of ['url', 'email', 'pdf']) {
  let n = 0, b = 0;
  cases[kind].forEach(([input, trusted, exp], i) => {
    let got;
    try { got = packJs(kind, T.run(kind, input, trusted)); } catch (e) { got = { error: true, js: String(e) }; }
    const e2 = exp.error ? { error: true } : exp;
    n++; total++;
    if (!eq(e2, got)) { b++; bad++; show(kind, i, [input, trusted], exp, got); }
  });
  console.log(kind.padEnd(9), n, 'cases,', b, 'mismatches');
}
{
  let n = 0, b = 0;
  cases.ratio.forEach(([a, bb, exp], i) => { const got = T.ratio(a, bb); n++; total++; if (got !== exp) { b++; bad++; show('ratio', i, [a, bb], exp, got); } });
  console.log('ratio'.padEnd(9), n, 'cases,', b, 'mismatches');
}
{
  let n = 0, b = 0;
  cases.urlparse.forEach(([u, exp], i) => {
    let got;
    try { const p = T.urlparse(u); got = { netloc: p.netloc, hostname: p.hostname }; } catch (e) { got = { error: true }; }
    n++; total++;
    if (!eq(exp, got)) { b++; bad++; show('urlparse', i, u, exp, got); }
  });
  console.log('urlparse'.padEnd(9), n, 'cases,', b, 'mismatches');
}
{
  let n = 0, b = 0;
  cases.extract.forEach(([d, exp], i) => { const r = T.tldExtract(d); const got = [r.subdomain, r.domain, r.suffix]; n++; total++; if (!eq(exp, got)) { b++; bad++; show('extract', i, d, exp, got); } });
  console.log('extract'.padEnd(9), n, 'cases,', b, 'mismatches');
}
console.log('TOTAL', total, 'cases,', bad, 'mismatches');
process.exit(bad ? 1 : 0);
