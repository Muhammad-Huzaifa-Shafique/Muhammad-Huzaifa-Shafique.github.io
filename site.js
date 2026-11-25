(function (w, d) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  w.$ = function (s, r) { return (r || d).querySelector(s); };
  w.$$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  w.h = function (t, a, p, x) {
    var e = d.createElement(t), k;
    for (k in a || {}) { if (k === 'class') e.className = a[k]; else e.setAttribute(k, a[k]); }
    if (x != null) e.textContent = x;
    if (p) p.appendChild(e);
    return e;
  };
  w.sv = function (t, a, p, x) {
    var e = d.createElementNS(NS, t), k;
    for (k in a || {}) e.setAttribute(k, a[k]);
    if (x != null) e.textContent = x;
    if (p) p.appendChild(e);
    return e;
  };
  var tp;
  w.tip = function (ev, lines) {
    if (!tp) tp = h('div', { 'class': 'tip', role: 'status' }, d.body);
    tp.textContent = '';
    lines.forEach(function (l, i) { h('div', { 'class': i ? '' : 'b' }, tp, l); });
    tp.style.display = 'block';
    var r = tp.getBoundingClientRect(), x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > w.innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > w.innerHeight - 8) y = ev.clientY - r.height - 14;
    tp.style.left = Math.max(4, x) + 'px';
    tp.style.top = Math.max(4, y) + 'px';
  };
  w.untip = function () { if (tp) tp.style.display = 'none'; };
  var lt = 0;
  d.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') lt = Date.now();
    var t = e.target;
    if (!(t && t.closest && t.closest('[data-hv]'))) untip();
  }, true);
  w.hover = function (el, fn) {
    el.setAttribute('data-hv', '1');
    el.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') tip(e, fn()); });
    el.addEventListener('mousemove', function (e) { tip(e, fn()); });
    el.addEventListener('mouseleave', function () { if (Date.now() - lt > 1000) untip(); });
    el.addEventListener('focus', function () {
      var r = el.getBoundingClientRect();
      tip({ clientX: r.left + r.width / 2, clientY: r.top }, fn());
    });
    el.addEventListener('blur', untip);
  };
  w.seg = function (box, items, cur, cb) {
    box.textContent = '';
    var bs = items.map(function (it, i) {
      var b = h('button', { type: 'button', 'aria-pressed': String(i === cur) }, box, it);
      b.addEventListener('click', function () {
        bs.forEach(function (x, j) { x.setAttribute('aria-pressed', String(j === i)); });
        cb(i);
      });
      return b;
    });
    return bs;
  };
  w.fit = function (box, draw) {
    draw();
    if (w.ResizeObserver) {
      var x = box.clientWidth, t;
      new ResizeObserver(function () {
        if (box.clientWidth !== x) { x = box.clientWidth; clearTimeout(t); t = setTimeout(draw, 80); }
      }).observe(box);
    }
  };
  w.getJSON = function (u, ok, fail) {
    fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); })
      .then(ok).catch(fail || function () {});
  };
  w.lin = function (d0, d1, r0, r1) { var k = (r1 - r0) / (d1 - d0); return function (v) { return r0 + (v - d0) * k; }; };
  w.lg = function (d0, d1, r0, r1) {
    var a = Math.log(d0), k = (r1 - r0) / (Math.log(d1) - a);
    return function (v) { return r0 + (Math.log(v) - a) * k; };
  };
  w.f = function (n, k) { return n.toFixed(k == null ? 1 : k); };
  w.comma = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  w.calm = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var y = d.getElementById('yr');
  if (y) y.textContent = new Date().getFullYear();

  /* ---- page effects (progressive: the pages read fine without them) ---- */
  var root = d.documentElement;
  function stars() {
    var c = h('canvas', { id: 'bg', 'aria-hidden': 'true' });
    d.body.insertBefore(c, d.body.firstChild);
    var x = c.getContext && c.getContext('2d');
    if (!x) return;
    var W = 0, H = 0, P = [], m = { x: -999, y: -999 }, last = 0, dpr = Math.min(w.devicePixelRatio || 1, 1.5), L = 130, R = Math.random;
    function size() {
      W = w.innerWidth; H = w.innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(95, Math.max(26, W * H / 16000)));
      while (P.length < n) P.push({ x: R() * W, y: R() * H, vx: (R() - .5) * .28, vy: (R() - .5) * .28, r: R() * 1.1 + .6, v: R() < .2 });
      P.length = n;
    }
    function line(a, b, k, q) {
      x.strokeStyle = 'rgba(109,176,247,' + (k * (1 - Math.sqrt(q) / L)).toFixed(3) + ')';
      x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
    }
    function draw(step) {
      x.clearRect(0, 0, W, H);
      var i, j, a, b, dx, dy, q;
      for (i = 0; i < P.length; i++) {
        a = P[i];
        if (step) {
          a.x += a.vx; a.y += a.vy;
          if (a.x < -10) a.x = W + 10; else if (a.x > W + 10) a.x = -10;
          if (a.y < -10) a.y = H + 10; else if (a.y > H + 10) a.y = -10;
        }
        for (j = i + 1; j < P.length; j++) {
          b = P[j]; dx = a.x - b.x; dy = a.y - b.y; q = dx * dx + dy * dy;
          if (q < L * L) line(a, b, .2, q);
        }
        dx = a.x - m.x; dy = a.y - m.y; q = dx * dx + dy * dy;
        if (q < 170 * 170) line(a, m, .5, q * (L * L) / (170 * 170));
        x.fillStyle = a.v ? 'rgba(152,135,239,.85)' : 'rgba(167,177,198,.65)';
        x.beginPath(); x.arc(a.x, a.y, a.r, 0, 6.2832); x.fill();
      }
    }
    function loop(t) {
      if (!d.hidden && t - last > 32) { last = t; draw(true); }
      w.requestAnimationFrame(loop);
    }
    size(); draw(false);
    w.addEventListener('resize', function () { size(); draw(false); });
    if (calm) return;
    d.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { m.x = e.clientX; m.y = e.clientY; } });
    root.addEventListener('mouseleave', function () { m.x = m.y = -999; });
    w.requestAnimationFrame(loop);
  }
  function progress() {
    var p = h('div', { 'class': 'prog', 'aria-hidden': 'true' }, d.body), t = 0;
    function set() {
      t = 0;
      var s = root.scrollHeight - w.innerHeight;
      p.style.setProperty('--p', s > 0 ? Math.min(1, w.scrollY / s).toFixed(4) : 0);
    }
    w.addEventListener('scroll', function () { if (!t) t = w.requestAnimationFrame(set); }, { passive: true });
    set();
  }
  function reveal() {
    if (calm || !w.IntersectionObserver) return;
    var els = $$('.rv,.proj,.bench,.contact,.skills>div,.sec>.row>h2,.bg li');
    root.classList.add('rv-on');
    els.forEach(function (e) {
      e.classList.add('rv');
      if (e.matches('.bg li,.skills>div')) e.style.transitionDelay = Array.prototype.indexOf.call(e.parentNode.children, e) * 80 + 'ms';
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    els.forEach(function (e) { io.observe(e); });
    w.addEventListener('beforeprint', function () { els.forEach(function (e) { e.classList.add('in'); }); });
  }
  function glow() {
    $$('.proj,.bench,.contact,.term,.skills>div').forEach(function (e) { e.classList.add('glow'); });
    d.addEventListener('pointermove', function (e) {
      var t = e.target.closest && e.target.closest('.glow');
      if (!t || e.pointerType !== 'mouse') return;
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      t.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }
  function typer() {
    $$('.tw').forEach(function (el) {
      var words = (el.getAttribute('data-words') || '').split('|');
      if (calm || words.length < 2) return;
      var i = 0, n = words[0].length, del = true;
      function tick() {
        var wait;
        if (del) {
          n--; el.textContent = words[i].slice(0, n);
          if (n <= 0) { del = false; i = (i + 1) % words.length; wait = 300; } else wait = 26;
        } else {
          n++; el.textContent = words[i].slice(0, n);
          if (n >= words[i].length) { del = true; wait = 2200; } else wait = 50 + Math.random() * 45;
        }
        setTimeout(tick, wait);
      }
      setTimeout(tick, 2400);
    });
  }
  function counters() {
    var els = $$('[data-count]');
    if (!els.length || calm || !w.IntersectionObserver) return;
    function run(e) {
      var to = parseFloat(e.getAttribute('data-count')), dec = +(e.getAttribute('data-dec') || 0), end = e.textContent, t0 = null;
      function step(t) {
        if (t0 == null) t0 = t;
        var k = Math.min(1, (t - t0) / 1100), v = to * (1 - Math.pow(1 - k, 3));
        e.textContent = k < 1 ? (dec ? v.toFixed(dec) : comma(v)) : end;
        e.classList.add('on');
        if (k < 1) w.requestAnimationFrame(step);
      }
      w.requestAnimationFrame(step);
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); run(en.target); } });
    }, { threshold: 0.5 });
    els.forEach(function (e) { io.observe(e); });
  }
  function spy() {
    var links = $$('.top nav a[href^="#"]');
    if (!links.length || !w.IntersectionObserver) return;
    var map = {};
    links.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) map[s.id] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        map[en.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (k) { io.observe($('#' + k)); });
  }
  stars(); progress(); reveal(); glow(); typer(); counters(); spy();
})(window, document);
