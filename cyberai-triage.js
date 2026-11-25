/* CyberAI triage rules in JavaScript.

   A port of the offline part of CyberAI.py, the rule-based triage tool, so the project page can run those
   rules in the browser. Nothing is sent anywhere: the text you type stays on your device.

   Ported rules (same logic, same wording, same point values as the Python code):
     - URL warning signs (url_heuristics)
     - look-alike and extra-subdomain checks against a trusted-domain list (check_typosquatting)
     - non-ASCII domain check (is_homograph)
     - email wording check and Reply-To mismatch (analyze_email)
     - link extraction (extract_urls_from_text)
     - the verdict thresholds (classify_threat)
   Not ported, because they need the internet or a key: VirusTotal, DNS records, RDAP, blocklists, SPF, DMARC, DKIM.

   Three Python library behaviours are reproduced here too, so results match: urllib.parse.urlparse,
   difflib.SequenceMatcher.ratio and tldextract.extract (ICANN section of the Public Suffix List, loaded
   from cyberai-suffixes.json). The scripts in tests/cyberai-parity/ compare this file with the real CyberAI.py. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CyberTriage = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_TRUSTED = ['pittstate.edu', 'paypal.com', 'google.com', 'microsoft.com', 'apple.com'];
  var SUS_KEYWORDS = ['login', 'secure', 'verify', 'update', 'account', 'paypal', 'bank', 'gift', 'free', 'promo'];

  /* ---- Python string behaviour ------------------------------------------------------------------ */
  // Characters Python treats as whitespace (str.isspace, and \s in str patterns).
  var WS = ' \\t\\n\\r\\f\\v\\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
  var STRIP_RE = new RegExp('^[' + WS + ']+|[' + WS + ']+$', 'gu');
  function pyStrip(s) { return s.replace(STRIP_RE, ''); }
  function count(s, ch) { return s.split(ch).length - 1; }
  function cpLen(s) { return Array.from(s).length; }

  /* ---- extract_urls_from_text ------------------------------------------------------------------- */
  var URL_RE = new RegExp('https?://[^' + WS + '\'"<>]+', 'gu');
  function extractUrls(text) {
    var m = (text || '').match(URL_RE) || [], seen = new Set(), out = [];
    m.forEach(function (u) { if (!seen.has(u)) { seen.add(u); out.push(u); } });
    return out;
  }

  /* ---- urllib.parse.urlparse (Python 3.12+ behaviour), enough to get scheme, netloc and hostname -- */
  var SCHEME_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-.';

  function isIPv4(s) {
    var o = s.split('.');
    if (o.length !== 4) return false;
    for (var i = 0; i < 4; i++) {
      if (!/^[0-9]{1,3}$/.test(o[i])) return false;
      if (o[i].length > 1 && o[i].charAt(0) === '0') return false;
      if (parseInt(o[i], 10) > 255) return false;
    }
    return true;
  }
  function isIPv6(s) {
    if (s.indexOf('/') !== -1) return false;
    var pct = s.indexOf('%');
    if (pct !== -1) {
      var scope = s.slice(pct + 1);
      s = s.slice(0, pct);
      if (!scope || scope.indexOf('%') !== -1) return false;
    }
    if (!s) return false;
    var parts = s.split(':');
    if (parts.length < 3) return false;
    if (parts[parts.length - 1].indexOf('.') !== -1) {
      var v4 = parts.pop();
      if (!isIPv4(v4)) return false;
      parts.push('0', '0');
    }
    if (parts.length > 9) return false;
    var skip = -1, i;
    for (i = 1; i < parts.length - 1; i++) {
      if (!parts[i]) { if (skip !== -1) return false; skip = i; }
    }
    var hi, lo;
    if (skip !== -1) {
      hi = skip; lo = parts.length - skip - 1;
      if (!parts[0]) { hi--; if (hi) return false; }
      if (!parts[parts.length - 1]) { lo--; if (lo) return false; }
      if (8 - (hi + lo) < 1) return false;
    } else {
      if (parts.length !== 8 || !parts[0] || !parts[parts.length - 1]) return false;
      hi = parts.length; lo = 0;
    }
    function hextet(h) { return /^[0-9A-Fa-f]{1,4}$/.test(h); }
    for (i = 0; i < hi; i++) if (!hextet(parts[i])) return false;
    for (i = parts.length - lo; i < parts.length; i++) if (!hextet(parts[i])) return false;
    return true;
  }
  function checkBracketedHost(h) {
    if (h.charAt(0) === 'v') {
      if (!/^v[a-fA-F0-9]+\..+$/.test(h)) throw new Error('IPvFuture address is invalid');
    } else if (!isIPv6(h)) {
      throw new Error(isIPv4(h) ? 'An IPv4 address cannot be in brackets' : 'Invalid IPv6 URL');
    }
  }
  function checkNetloc(netloc) {
    if (!netloc || !/[^\x00-\x7f]/.test(netloc)) return;
    var n = netloc.replace(/@/g, '').replace(/:/g, '').replace(/#/g, '').replace(/\?/g, '');
    var n2 = n.normalize('NFKC');
    if (n === n2) return;
    if (/[\/?#@:]/.test(n2)) throw new Error('netloc contains invalid characters under NFKC normalization');
  }
  function urlparse(url) {
    url = url.replace(/^[\x00-\x20]+/, '').replace(/[\t\r\n]/g, '');
    var netloc = '', i = url.indexOf(':');
    if (i > 0 && /^[A-Za-z]/.test(url.charAt(0))) {
      var ok = true;
      for (var k = 0; k < i; k++) if (SCHEME_CHARS.indexOf(url.charAt(k)) === -1) { ok = false; break; }
      if (ok) url = url.slice(i + 1);
    }
    if (url.slice(0, 2) === '//') {
      var delim = url.length, c, w;
      for (c = 0; c < 3; c++) {
        w = url.indexOf('/?#'.charAt(c), 2);
        if (w >= 0 && w < delim) delim = w;
      }
      netloc = url.slice(2, delim);
      var ob = netloc.indexOf('['), cb = netloc.indexOf(']');
      if ((ob !== -1 && cb === -1) || (cb !== -1 && ob === -1)) throw new Error('Invalid IPv6 URL');
      if (ob !== -1 && cb !== -1) checkBracketedHost(netloc.slice(ob + 1).split(']')[0]);
    }
    checkNetloc(netloc);
    // hostname, as urlparse(...).hostname computes it
    var at = netloc.lastIndexOf('@'), info = at === -1 ? netloc : netloc.slice(at + 1), host;
    var b = info.indexOf('[');
    if (b !== -1) {
      var br = info.slice(b + 1), e = br.indexOf(']');
      host = e === -1 ? br : br.slice(0, e);
    } else {
      var col = info.indexOf(':');
      host = col === -1 ? info : info.slice(0, col);
    }
    var hostname = null;
    if (host) {
      var pc = host.indexOf('%');
      hostname = pc === -1 ? host.toLowerCase() : host.slice(0, pc).toLowerCase() + host.slice(pc);
    }
    return { netloc: netloc, hostname: hostname };
  }

  /* ---- url_heuristics, is_homograph ------------------------------------------------------------- */
  function urlHeuristics(domain) {
    if (!domain) return [];
    var h = [], low = domain.toLowerCase();
    if (count(domain, '-') > 3) h.push('many-hyphens');
    if (domain.split('.').length > 3) h.push('long-subdomain-chain');
    if (cpLen(domain) > 40) h.push('very-long-domain');
    if (/[^\x00-\x7f]/.test(domain)) h.push('non-ascii (possible IDN homograph)');
    for (var i = 0; i < SUS_KEYWORDS.length; i++) {
      if (low.indexOf(SUS_KEYWORDS[i]) !== -1) { h.push('suspicious-keyword'); break; }
    }
    return h;
  }
  function isHomograph(domain) { return /[^\x00-\x7f]/.test(domain); }

  // Which warning-sign rules fired and on what, for the explanation under the verdict (not part of the verdict).
  function urlEvidence(domain) {
    var out = [], low = domain.toLowerCase(), k;
    if (count(domain, '-') > 3) out.push('many-hyphens: ' + count(domain, '-') + ' hyphens (more than 3)');
    if (domain.split('.').length > 3) out.push('long-subdomain-chain: ' + domain.split('.').length + ' parts (more than 3)');
    if (cpLen(domain) > 40) out.push('very-long-domain: ' + cpLen(domain) + ' characters (more than 40)');
    if (/[^\x00-\x7f]/.test(domain)) out.push('non-ascii: the name has characters outside plain ASCII');
    var hits = SUS_KEYWORDS.filter(function (w) { return low.indexOf(w) !== -1; });
    if (hits.length) out.push('suspicious-keyword: contains ' + hits.map(function (w) { return '"' + w + '"'; }).join(', '));
    return out;
  }

  /* ---- difflib.SequenceMatcher(None, a, b).ratio() ---------------------------------------------- */
  function ratio(a, b) {
    var A = Array.from(a), B = Array.from(b), la = A.length, lb = B.length;
    if (la + lb === 0) return 1.0;
    var b2j = new Map();
    B.forEach(function (ch, j) { var l = b2j.get(ch); if (l) l.push(j); else b2j.set(ch, [j]); });
    if (lb >= 200) {                       // difflib's autojunk
      var ntest = Math.floor(lb / 100) + 1, popular = [];
      b2j.forEach(function (idx, ch) { if (idx.length > ntest) popular.push(ch); });
      popular.forEach(function (ch) { b2j.delete(ch); });
    }
    function longest(alo, ahi, blo, bhi) {
      var besti = alo, bestj = blo, bestsize = 0, j2len = new Map(), i, q, j, k;
      for (i = alo; i < ahi; i++) {
        var nj = new Map(), idxs = b2j.get(A[i]) || [];
        for (q = 0; q < idxs.length; q++) {
          j = idxs[q];
          if (j < blo) continue;
          if (j >= bhi) break;
          k = (j2len.get(j - 1) || 0) + 1;
          nj.set(j, k);
          if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
        }
        j2len = nj;
      }
      while (besti > alo && bestj > blo && A[besti - 1] === B[bestj - 1]) { besti--; bestj--; bestsize++; }
      while (besti + bestsize < ahi && bestj + bestsize < bhi && A[besti + bestsize] === B[bestj + bestsize]) bestsize++;
      return [besti, bestj, bestsize];
    }
    var matched = 0, queue = [[0, la, 0, lb]];
    while (queue.length) {
      var t = queue.pop(), r = longest(t[0], t[1], t[2], t[3]), i2 = r[0], j2 = r[1], k2 = r[2];
      if (k2) {
        matched += k2;
        if (t[0] < i2 && t[2] < j2) queue.push([t[0], i2, t[2], j2]);
        if (i2 + k2 < t[1] && j2 + k2 < t[3]) queue.push([i2 + k2, t[1], j2 + k2, t[3]]);
      }
    }
    return 2.0 * matched / (la + lb);
  }

  /* ---- tldextract.extract (ICANN rules only) ---------------------------------------------------- */
  var ROOT = null;
  function node() { return { m: Object.create(null), end: false }; }
  function loadSuffixes(data) {
    ROOT = node();
    function add(rule) {
      var n = ROOT, labs = rule.split('.');
      for (var i = labs.length - 1; i >= 0; i--) n = n.m[labs[i]] || (n.m[labs[i]] = node());
      n.end = true;
    }
    if (data.s) data.s.split(' ').forEach(add);
    Object.keys(data.m).forEach(function (tld) {
      data.m[tld].split(' ').forEach(function (rest) { add(rest + '.' + tld); });
    });
    return true;
  }
  function suffixesLoaded() { return ROOT !== null; }

  function punyDecode(input) {          // RFC 3492
    var base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, maxInt = 2147483647;
    function adapt(delta, num, first) {
      var k = 0;
      delta = first ? Math.floor(delta / damp) : delta >> 1;
      delta += Math.floor(delta / num);
      for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
      return Math.floor(k + (base - tMin + 1) * delta / (delta + skew));
    }
    function digit(cp) {
      if (cp - 48 < 10) return cp - 22;
      if (cp - 65 < 26) return cp - 65;
      if (cp - 97 < 26) return cp - 97;
      return base;
    }
    var out = [], bas = input.lastIndexOf('-'), j, i = 0, n = 128, bias = 72, index;
    if (bas < 0) bas = 0;
    for (j = 0; j < bas; j++) {
      if (input.charCodeAt(j) >= 128) throw new Error('bad punycode');
      out.push(input.charCodeAt(j));
    }
    for (index = bas > 0 ? bas + 1 : 0; index < input.length;) {
      var oldi = i;
      for (var w = 1, k = base; ; k += base) {
        if (index >= input.length) throw new Error('bad punycode');
        var d = digit(input.charCodeAt(index++));
        if (d >= base || d > Math.floor((maxInt - i) / w)) throw new Error('bad punycode');
        i += d * w;
        var t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
        if (d < t) break;
        if (w > Math.floor(maxInt / (base - t))) throw new Error('bad punycode');
        w *= base - t;
      }
      var len = out.length + 1;
      bias = adapt(i - oldi, len, oldi === 0);
      if (Math.floor(i / len) > maxInt - n) throw new Error('bad punycode');
      n += Math.floor(i / len);
      i %= len;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint.apply(String, out);
  }
  function decodeLabel(label) {
    var low = label.toLowerCase();
    if (low.indexOf('xn--') === 0) { try { return punyDecode(low.slice(4)); } catch (e) { /* keep the label */ } }
    return low;
  }
  function schemeless(url) {
    var i = url.indexOf('//');
    if (i === 0) return url.slice(2);
    if (i < 2 || url.charAt(i - 1) !== ':' || /[^a-z0-9+.\-]/.test(url.slice(0, i - 1))) return url;
    return url.slice(i + 2);
  }
  function lenientNetloc(url) {
    var s = schemeless(url);
    s = s.split('/')[0].split('?')[0].split('#')[0];
    s = s.slice(s.lastIndexOf('@') + 1);
    if (s && s.charAt(0) === '[') {
      var e = s.indexOf(']');
      if (e !== -1) return s.slice(0, e + 1);
    }
    var host = pyStrip(s.split(':')[0]);
    return host.replace(/[.。．｡]+$/, '');
  }
  function suffixIndex(labels) {
    var n = ROOT, i = labels.length, j = i;
    for (var x = labels.length - 1; x >= 0; x--) {
      var d = decodeLabel(labels[x]);
      if (n.m[d]) {
        j--;
        n = n.m[d];
        if (n.end) i = j;
        continue;
      }
      if (n.m['*']) return n.m['!' + d] ? j : j - 1;
      break;
    }
    return i;
  }
  function tldExtract(url) {
    var netloc = lenientNetloc(url).replace(/[。．｡]/g, '.');
    var labels = netloc.split('.'), nl = labels.length, idx;
    if (ROOT) idx = suffixIndex(labels);
    else idx = nl > 1 ? nl - 1 : nl;     // list not loaded: treat the last label as the suffix
    if (nl === idx && /^[0-9]/.test(netloc) && isIPv4Loose(netloc)) return { subdomain: '', domain: netloc, suffix: '' };
    return {
      subdomain: idx >= 2 ? labels.slice(0, idx - 1).join('.') : '',
      domain: idx ? labels[idx - 1] : '',
      suffix: idx !== nl ? labels.slice(idx).join('.') : ''
    };
  }
  function isIPv4Loose(s) {            // tldextract's own pattern accepts leading zeros
    return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s);
  }

  /* ---- check_typosquatting ---------------------------------------------------------------------- */
  function checkTyposquatting(domain, trusted) {
    var alerts = [], ext = tldExtract(domain);
    var base = ext.suffix ? ext.domain + '.' + ext.suffix : domain;
    if (trusted.indexOf(base) !== -1 && ext.subdomain)
      alerts.push("Extra subdomain '" + ext.subdomain + "' before trusted base '" + base + "' (possible spoofing)");
    trusted.forEach(function (safe) {
      if (base !== safe && ratio(base, safe) > 0.75)
        alerts.push("Domain '" + base + "' looks similar to '" + safe + "' (possible spoofing)");
    });
    return alerts;
  }

  /* ---- analyze_website, analyze_email, analyze_pdf, classify_threat ----------------------------- */
  function analyzeUrl(url) {
    var p;
    try { p = urlparse(url); } catch (e) { return { type: 'url', error: String(e.message || e) }; }
    var domain = (p.hostname || p.netloc || url).replace(/^[\[\]]+/, '');
    return { type: 'url', url: url, domain: domain, heuristics: urlHeuristics(domain), alerts: [] };
  }

  var RX_FROM_ANGLE = new RegExp('From:[' + WS + ']*[^\\n]*<([^>]+)>', 'iu');
  var RX_FROM_PLAIN = new RegExp('From:[' + WS + ']*([^' + WS + '<]+@[^' + WS + '>]+)', 'iu');
  var RX_WORDS = /(verify|reset|urgent|bank|paypal|password|account|suspend|click here)/iu;
  var RX_REPLY = new RegExp('Reply-To:[' + WS + ']*([^\\r\\n]+)', 'iu');

  function analyzeEmail(text, trusted) {
    var out = { type: 'email', input: text, sender: null, urls: extractUrls(text), mode: null, alerts: [] };
    var s = pyStrip(text);
    if (s.indexOf('\n') === -1 && count(text, '@') === 1 && s.indexOf(' ') === -1) {
      out.mode = 'address';
      out.sender = s;
      var domain = s.split('@').pop();
      out.alerts = out.alerts.concat(checkTyposquatting(domain, trusted));
      if (isHomograph(domain)) out.alerts.push('Homograph Unicode domain (possible spoofing)');
      // SPF and DMARC lookups need DNS and are not run here
    } else {
      out.mode = 'raw';
      var m = RX_FROM_ANGLE.exec(text) || RX_FROM_PLAIN.exec(text);
      if (m) out.sender = m[1];
      if (out.sender && out.sender.indexOf('@') !== -1) {
        var d2 = out.sender.split('@').pop();
        out.alerts = out.alerts.concat(checkTyposquatting(d2, trusted));
        if (isHomograph(d2)) out.alerts.push('Homograph Unicode domain (possible spoofing)');
        // SPF, DMARC and DKIM are not run here
      }
      if (RX_WORDS.test(text)) out.alerts.push('Suspicious wording in content (phishing-like)');
      var rt = RX_REPLY.exec(text);
      if (rt && out.sender) {
        if (pyStrip(rt[1]).indexOf(out.sender) === -1) out.alerts.push('Reply-To differs from From (spoofing risk)');
      }
    }
    return out;
  }

  function analyzePdf(text) { return { type: 'pdf', input: text, urls: extractUrls(text) }; }

  function classify(result) {
    var reasons = [], score = 0;
    if (result.heuristics && result.heuristics.length) {
      reasons.push('Heuristics: ' + result.heuristics.join(', '));
      score += Math.min(2, result.heuristics.length);
    }
    if (result.alerts && result.alerts.length) {
      result.alerts.forEach(function (a) { reasons.push(a); });
      score += result.alerts.length;
    }
    return { verdict: score >= 5 ? 'Malware' : (score >= 1 ? 'Suspicious' : 'Clean'), score: score, reasons: reasons };
  }

  // The same entry point the tool's web page and command line use: strip the input, analyse, classify.
  function run(kind, text, trusted) {
    var s = pyStrip(text || ''), tr = trusted || DEFAULT_TRUSTED, res;
    if (kind === 'url') res = analyzeUrl(s);
    else if (kind === 'email') res = analyzeEmail(s, tr);
    else if (kind === 'pdf') res = analyzePdf(s);
    else throw new Error('unknown kind');
    if (res.error) return { error: res.error, type: kind };
    var c = classify(res);
    res.verdict = c.verdict; res.score = c.score; res.reasons = c.reasons;
    return res;
  }

  return {
    DEFAULT_TRUSTED: DEFAULT_TRUSTED, SUS_KEYWORDS: SUS_KEYWORDS,
    pyStrip: pyStrip, extractUrls: extractUrls, urlparse: urlparse, urlHeuristics: urlHeuristics, urlEvidence: urlEvidence,
    isHomograph: isHomograph, ratio: ratio, loadSuffixes: loadSuffixes, suffixesLoaded: suffixesLoaded,
    tldExtract: tldExtract, checkTyposquatting: checkTyposquatting, analyzeUrl: analyzeUrl,
    analyzeEmail: analyzeEmail, analyzePdf: analyzePdf, classify: classify, run: run,
    punyDecode: punyDecode, isIPv6: isIPv6
  };
});
