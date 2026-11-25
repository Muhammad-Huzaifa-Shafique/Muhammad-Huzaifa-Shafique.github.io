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
})(window, document);
