// Shows that the parity test can fail: breaks cyberai-triage.js in a number of places, one at a time, and
// checks that run_parity.js notices each change. usage: node check_mutations.js (after python gen_cases.py)
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const code = fs.readFileSync(path.join(__dirname, '..', '..', 'cyberai-triage.js'), 'utf8');
const M = [
  ['Malware starts at 6 points, not 5', "score >= 5 ? 'Malware'", "score >= 6 ? 'Malware'"],
  ['Suspicious starts at 2 points, not 1', "score >= 1 ? 'Suspicious'", "score >= 2 ? 'Suspicious'"],
  ['heuristics can add 3 points, not 2', 'Math.min(2, result.heuristics.length)', 'Math.min(3, result.heuristics.length)'],
  ['many-hyphens needs 5 hyphens, not 4', "count(domain, '-') > 3) h.push", "count(domain, '-') > 4) h.push"],
  ['long-subdomain-chain needs 5 parts, not 4', "domain.split('.').length > 3) h.push", "domain.split('.').length > 4) h.push"],
  ['very-long-domain needs 42 characters, not 41', 'cpLen(domain) > 40) h.push', 'cpLen(domain) > 41) h.push'],
  ['the keyword "promo" is dropped', "'free', 'promo']", "'free']"],
  ['look-alike limit 0.8, not 0.75', 'ratio(base, safe) > 0.75', 'ratio(base, safe) > 0.8'],
  ['extra-subdomain alert fires without a trusted base', "trusted.indexOf(base) !== -1 && ext.subdomain", "trusted.indexOf(base) !== -1 || ext.subdomain"],
  ['"click here" is dropped from the wording check', '|suspend|click here)', '|suspend)'],
  ['Reply-To alert text changed', 'Reply-To differs from From (spoofing risk)', 'Reply-To differs from From (spoof risk)'],
  ['links are not de-duplicated', 'if (!seen.has(u)) { seen.add(u); out.push(u); }', 'out.push(u);'],
  ['string similarity uses the longer string as divisor', 'return 2.0 * matched / (la + lb);', 'return matched / Math.max(la, lb);'],
  ['exception rules (such as city.kobe.jp) are ignored', "return n.m['!' + d] ? j : j - 1;", 'return j - 1;'],
  ['host names are not lower-cased', 'host.toLowerCase()', 'host'],
];
let caught = 0;
M.forEach(([name, from, to]) => {
  const at = code.indexOf(from);
  if (at < 0 || code.indexOf(from, at + 1) >= 0) { console.log('SKIPPED (pattern not unique):', name); return; }
  const f = path.join(os.tmpdir(), 'triage-mutant.js');
  fs.writeFileSync(f, code.slice(0, at) + to + code.slice(at + from.length));
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'run_parity.js')], { env: Object.assign({}, process.env, { TRIAGE_JS: f }), encoding: 'utf8' });
  const hit = r.status === 1;
  if (hit) caught++;
  console.log((hit ? 'caught      ' : 'NOT CAUGHT  ') + name);
});
console.log(caught + ' of ' + M.length + ' changes caught');
process.exit(caught === M.length ? 0 : 1);
