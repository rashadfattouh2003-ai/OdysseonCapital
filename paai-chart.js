/* Odysseon Capital — Paradium (PAAI), Heikin-Ashi candles
   Gold body for an up candle, white for a down candle, per the desk's
   own convention. Entries and the exit are marked at their fill prices. */

(function () {
  var D = window.PAAI;
  if (!D) return;

  var svg = document.getElementById('pa-svg');
  if (!svg) return;

  var NS = 'http://www.w3.org/2000/svg';

  var FROM = '2026-08-03';          // the rebrand run-up onwards
  var TO   = '2026-09-21';
  var rows = D.slice(FROM, TO);

  /* ---- geometry ---- */
  var W = 1180, H = 640;
  var L = 16, R = W - 78;           // price scale sits on the right
  var PT = 26,  PB = 428;           // price panel
  var VT = 470, VB = 556;           // volume panel
  var XL = 590;                     // month labels

  var n    = rows.length;
  var slot = (R - L) / n;
  var bw   = Math.min(19, slot * 0.62);

  function cx(i) { return L + slot * (i + 0.5); }

  var hi = 0, lo = Infinity, vmax = 0;
  rows.forEach(function (d) {
    hi = Math.max(hi, d.hh, d.h);
    lo = Math.min(lo, d.hl, d.l);
    vmax = Math.max(vmax, d.v);
  });
  hi = Math.ceil(hi * 10) / 10 + 0.1;
  lo = Math.max(0, Math.floor(lo * 10) / 10 - 0.05);

  function y(p) { return PB - (p - lo) / (hi - lo) * (PB - PT); }
  function vy(v) { return VB - (v / vmax) * (VB - VT); }

  function el(tag, attrs, cls) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute('class', cls);
    return e;
  }
  function add(parent, tag, attrs, cls) { var e = el(tag, attrs, cls); parent.appendChild(e); return e; }

  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = '';

  /* ---- clip used for the left-to-right reveal ---- */
  var defs = add(svg, 'defs', {});
  var cp   = add(defs, 'clipPath', { id: 'pa-reveal' });
  var cpr  = add(cp, 'rect', { x: 0, y: 0, width: 0, height: H });

  /* ---- grid and price scale ---- */
  var gGrid = add(svg, 'g', {});
  var step  = (hi - lo) > 2.4 ? 0.5 : 0.25;
  for (var p = Math.ceil(lo / step) * step; p <= hi; p += step) {
    var yy = y(p);
    add(gGrid, 'line', { x1: L, y1: yy, x2: R, y2: yy }, 'pa-grid');
    add(gGrid, 'text', { x: R + 10, y: yy + 3.5 }, 'pa-axis').textContent = '$' + p.toFixed(2);
  }

  /* volume panel frame */
  add(gGrid, 'line', { x1: L, y1: VB, x2: R, y2: VB }, 'pa-grid');
  add(gGrid, 'text', { x: R + 10, y: VT + 4 }, 'pa-axis').textContent =
    (vmax / 1e6).toFixed(0) + 'M';
  add(gGrid, 'text', { x: L, y: VT - 10 }, 'pa-panel').textContent = 'Volume';

  /* month dividers */
  var seen = {};
  rows.forEach(function (d, i) {
    var m = d.date.slice(0, 7);
    if (seen[m]) return;
    seen[m] = 1;
    var x = cx(i) - slot / 2;
    if (i > 0) add(gGrid, 'line', { x1: x, y1: PT, x2: x, y2: VB }, 'pa-div');
    add(gGrid, 'text', { x: x + 6, y: XL }, 'pa-month').textContent =
      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m.slice(5) - 1] + ' 2026';
  });

  /* ---- candles and volume, both inside the reveal clip ---- */
  var gRev = add(svg, 'g', { 'clip-path': 'url(#pa-reveal)' });

  rows.forEach(function (d, i) {
    var x = cx(i);
    var cls = d.up ? 'pa-c pa-c--up' : 'pa-c pa-c--dn';
    var g = add(gRev, 'g', {}, cls);

    add(g, 'line', { x1: x, y1: y(d.hh), x2: x, y2: y(d.hl) }, 'pa-wick');

    var top = y(Math.max(d.ho, d.hc));
    var hgt = Math.max(1.4, Math.abs(y(d.hc) - y(d.ho)));
    add(g, 'rect', { x: x - bw / 2, y: top, width: bw, height: hgt }, 'pa-body');

    add(gRev, 'rect', {
      x: x - bw / 2, y: vy(d.v), width: bw, height: Math.max(0.8, VB - vy(d.v))
    }, d.up ? 'pa-vol pa-vol--up' : 'pa-vol pa-vol--dn');
  });

  /* ---- fill levels and markers ---- */
  var gMk = add(svg, 'g', {}, 'pa-marks');
  var idx = {};
  rows.forEach(function (d, i) { idx[d.date] = i; });

  function level(price, text, anchorY) {
    var yy = y(price);
    add(gMk, 'line', { x1: L, y1: yy, x2: R, y2: yy }, 'pa-lvl');
    var t = add(gMk, 'text', { x: L + 8, y: yy + (anchorY || -7) }, 'pa-lvl__t');
    t.textContent = text;
  }

  level(D.stats.avgEntry, 'Average entry  $' + D.stats.avgEntry.toFixed(4), -7);
  level(D.stats.exitPx,   'Exit  $' + D.stats.exitPx.toFixed(4), -7);

  /* Label placement is hand set. The three fills all land in the same
     low, crowded corner of the chart, so the labels are led out into the
     empty space above the base instead of stacking on top of each other. */
  var LBL = {
    '2026-09-01': { dx: -32, dy: -152, anchor: 'end'   },
    '2026-09-08': { dx:  30, dy:  -70, anchor: 'start' },
    '2026-09-18': { dx: -112, dy: -60, anchor: 'end'   }
  };

  D.fills.forEach(function (f) {
    var i = idx[f.date];
    if (i === undefined) return;
    var x = cx(i), yy = y(f.price);
    var out = f.kind === 'sell';

    var g = add(gMk, 'g', {}, 'pa-mk ' + (out ? 'pa-mk--out' : 'pa-mk--in'));

    var cfg = LBL[f.date] || { dx: 26, dy: -60, anchor: 'start' };
    var lx = x + cfg.dx;
    var ly = yy + cfg.dy;

    /* leader from the fill price out to its label, with the last leg level
       so it reads as an annotation rather than a trend line */
    var kx = cfg.anchor === 'end' ? lx + 8 : lx - 8;
    add(g, 'path', { d: 'M' + x + ' ' + yy + ' L' + kx + ' ' + (ly + 8) + ' L' + lx + ' ' + (ly + 8) }, 'pa-mk__lead');

    add(g, 'circle', { cx: x, cy: yy, r: 6.5 }, 'pa-mk__halo');
    add(g, 'circle', { cx: x, cy: yy, r: 3.2 }, 'pa-mk__dot');

    var ta = cfg.anchor;
    var k = add(g, 'text', { x: lx, y: ly, 'text-anchor': ta }, 'pa-mk__k');
    k.textContent = f.label;
    var v = add(g, 'text', { x: lx, y: ly + 17, 'text-anchor': ta }, 'pa-mk__v');
    v.textContent = '$' + f.price.toFixed(4) + '  ·  ' + f.qty.toLocaleString('en-US', {
      minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' sh';
    var s = add(g, 'text', { x: lx, y: ly + 33, 'text-anchor': ta }, 'pa-mk__s');
    s.textContent = new Date(f.date + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric' });
  });

  /* ---- crosshair and readout ---- */
  var cross = add(svg, 'line', { x1: 0, y1: PT, x2: 0, y2: VB }, 'pa-cross');
  var hit   = add(svg, 'rect', { x: L, y: PT, width: R - L, height: VB - PT, fill: 'transparent' });

  var out = {
    date: document.querySelector('[data-pa="date"]'),
    o:    document.querySelector('[data-pa="o"]'),
    h:    document.querySelector('[data-pa="h"]'),
    l:    document.querySelector('[data-pa="l"]'),
    c:    document.querySelector('[data-pa="c"]'),
    v:    document.querySelector('[data-pa="v"]')
  };

  function fmtDate(s) {
    return new Date(s + 'T12:00:00').toLocaleDateString('en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtVol(v) {
    return v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : (v / 1e3).toFixed(0) + 'k';
  }

  function show(i) {
    var d = rows[i];
    if (!d) return;
    cross.setAttribute('x1', cx(i));
    cross.setAttribute('x2', cx(i));
    cross.style.opacity = 1;
    if (out.date) out.date.textContent = fmtDate(d.date);
    if (out.o) out.o.textContent = '$' + d.o.toFixed(2);
    if (out.h) out.h.textContent = '$' + d.h.toFixed(2);
    if (out.l) out.l.textContent = '$' + d.l.toFixed(2);
    if (out.c) out.c.textContent = '$' + d.c.toFixed(2);
    if (out.v) out.v.textContent = fmtVol(d.v);
  }

  function clear() {
    cross.style.opacity = 0;
    show(rows.length - 1);
    cross.style.opacity = 0;
  }

  function track(e) {
    var box = svg.getBoundingClientRect();
    var px = (e.clientX - box.left) / box.width * W;
    var i = Math.round((px - L) / slot - 0.5);
    show(Math.max(0, Math.min(rows.length - 1, i)));
  }

  hit.addEventListener('mousemove', track);
  hit.addEventListener('mouseleave', clear);
  hit.addEventListener('touchmove', function (e) {
    if (e.touches[0]) { track(e.touches[0]); e.preventDefault(); }
  }, { passive: false });

  clear();

  /* ---- reveal ---- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function play() {
    if (reduced) { cpr.setAttribute('width', W); svg.classList.add('is-in'); return; }
    var t0 = null, dur = 1250;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min((ts - t0) / dur, 1);
      var e = 1 - Math.pow(1 - t, 3);
      cpr.setAttribute('width', (W * e).toFixed(2));
      if (t < 1) requestAnimationFrame(step); else svg.classList.add('is-in');
    }
    requestAnimationFrame(step);
  }

  if (!('IntersectionObserver' in window)) { play(); }
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { play(); io.disconnect(); } });
    }, { threshold: 0.2 });
    io.observe(svg);
  }
})();
