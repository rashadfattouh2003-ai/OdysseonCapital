/* ============================================================================
   Odysseon Capital — the pre-trade sequence.

   Architecture note: everything visible is a pure function of a single integer
   frame index, renderFrame(f). Nothing reads the wall clock, and no CSS
   transition or keyframe drives anything that matters. In the page a rAF loop
   only advances that integer; a frame-capture renderer would step it directly.
   Same scene, same pixels, either way.

   The loop seam is structural rather than cosmetic: every panel's internal
   animation is multiplied by its own `lit` value, and every lit value is zero
   at frame 0 and at the final frame. The cursor travels home over the closing
   cascade and arrives exactly on the last frame. Nothing is crossfaded to hide
   a join. window.SEQ.checkSeam() measures it.
   ============================================================================ */

(function () {
  var host = document.querySelector('#seq-stage');
  if (!host || !window.SEQ_TIMELINE || !window.SEQ_CONTENT) return;

  var T = window.SEQ_TIMELINE, C = window.SEQ_CONTENT;
  var FPS = T.fps;
  var W = 1200, H = 700;

  /* scene frame boundaries */
  var scenes = [], acc = 0;
  T.scenes.forEach(function (s, i) {
    var n = Math.round(s.dur * FPS);
    scenes.push({ id: s.id, label: s.label, i: i, from: acc, to: acc + n, len: n });
    acc += n;
  });
  var N = acc;

  /* ---------- easing ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; }
  /* travel curve: decelerate hard into the target, overshoot a touch, settle */
  function settle(t, over) {
    t = clamp(t, 0, 1);
    var e = easeOut(t);
    return e + over * Math.sin(Math.PI * clamp((t - 0.55) / 0.45, 0, 1)) * (1 - t);
  }
  /* deterministic hash so any wobble is identical on every render of a frame */
  function noise(f, salt) {
    var x = Math.sin(f * 12.9898 + salt * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }
  /* slow drift: one new sample every `period` seconds, smoothly interpolated,
     which is how a resting hand actually moves */
  function drift(f, salt, period) {
    var p = f / (FPS * (period || 2.2));
    var i = Math.floor(p);
    return lerp(noise(i, salt), noise(i + 1, salt), smooth(p - i));
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    return 'rgb(' + Math.round(lerp(c1[0], c2[0], t)) + ',' +
                    Math.round(lerp(c1[1], c2[1], t)) + ',' +
                    Math.round(lerp(c1[2], c2[2], t)) + ')';
  }

  /* ---------- palette: the report's own, not a foreign accent ---------- */
  var CO = {
    ink:    [246, 244, 240],
    muted:  [246, 244, 240],
    gold:   [191, 167, 110],
    dim:    [ 62,  86, 122],
    up:     [ 79, 191, 139],
    down:   [196, 121,  94],
    panel:  'rgba(7, 37, 84, 0.42)',
    panelOn:'rgba(7, 37, 84, 0.78)'
  };

  /* ---------- deterministic price series ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  /* Each timeframe gets its own series. A lower timeframe is choppier and
     coils later; a higher one is smoother and trends harder. Same coil-then-
     expansion shape in all of them, which is the point being made on screen. */
  function series(seed, cfg) {
    var r = rng(seed), n = 70, out = [], px = cfg.start;
    for (var i = 0; i < n; i++) {
      var inCoil = i >= cfg.coil[0] && i < cfg.coil[1];
      var vol = inCoil ? cfg.vol * 0.26 : (i < cfg.coil[0] ? cfg.vol : cfg.vol * 1.25);
      var drift = i < cfg.coil[0] ? cfg.pre : inCoil ? 0.004 : cfg.post;
      var o = px;
      px += (r() - 0.5) * 2 * vol + drift;
      var c = px;
      out.push({ o: o, c: c,
                 h: Math.max(o, c) + r() * vol * 0.7,
                 l: Math.min(o, c) - r() * vol * 0.7 });
    }
    return out;
  }

  var TF = [
    { key: 'BASE', seed: 20260913, start: 44, vol: 0.62, coil: [18, 44], pre: 0.00, post: 0.130 },
    { key: '15M',  seed: 31,       start: 46, vol: 0.74, coil: [22, 48], pre: -0.02, post: 0.098 },
    { key: '1H',   seed: 917,      start: 43, vol: 0.55, coil: [16, 45], pre: 0.01, post: 0.145 },
    { key: '4H',   seed: 4402,     start: 41, vol: 0.44, coil: [14, 41], pre: 0.02, post: 0.190 },
    { key: '1D',   seed: 88231,    start: 38, vol: 0.36, coil: [12, 38], pre: 0.03, post: 0.235 }
  ];

  function sma(a, p, i) { var s = 0, n = 0; for (var k = i - p + 1; k <= i; k++) if (k >= 0) { s += a[k]; n++; } return s / n; }
  function sdev(a, p, i) {
    var m = sma(a, p, i), s = 0, n = 0;
    for (var k = i - p + 1; k <= i; k++) if (k >= 0) { s += (a[k] - m) * (a[k] - m); n++; }
    return Math.sqrt(s / n);
  }
  function emaOf(src, p) {
    var k = 2 / (p + 1), out = [src[0]];
    for (var i = 1; i < src.length; i++) out.push(src[i] * k + out[i-1] * (1 - k));
    return out;
  }
  function atrOf(bars, p) {
    var out = [], prev = bars[0].c;
    for (var i = 0; i < bars.length; i++) {
      var tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - prev), Math.abs(bars[i].l - prev));
      prev = bars[i].c;
      out.push(i === 0 ? tr : (out[i-1] * (p - 1) + tr) / p);
    }
    return out;
  }

  /* Bollinger and Keltner are computed properly on each series, so the
     compression the scene claims is really in the data, not drawn on. */
  function study(cfg) {
    var bars = series(cfg.seed, cfg);
    var closes = bars.map(function (b) { return b.c; });
    var e20 = emaOf(closes, 20), a14 = atrOf(bars, 14);
    var band = bars.map(function (b, i) {
      var m = sma(closes, 20, i), d = sdev(closes, 20, i);
      return { bbU: m + 2*d, bbL: m - 2*d, kcU: e20[i] + 1.5*a14[i], kcL: e20[i] - 1.5*a14[i] };
    });
    var sq = band.map(function (x) { return x.bbU < x.kcU && x.bbL > x.kcL; });
    var fire = (function () { for (var i = 24; i < sq.length; i++) if (sq[i-1] && !sq[i]) return i; return 46; })();
    var lo = Infinity, hi = -Infinity;
    band.forEach(function (x, i) {
      lo = Math.min(lo, x.kcL, bars[i].l); hi = Math.max(hi, x.kcU, bars[i].h);
    });
    var pad = (hi - lo) * 0.08;
    return { bars: bars, band: band, sq: sq, fire: fire, e20: e20, atr: a14,
             emas: [8, 13, 21, 34, 55].map(function (p) { return emaOf(closes, p); }),
             lo: lo - pad, hi: hi + pad };
  }

  var STUDY = TF.map(study);
  var BARS = STUDY[0].bars, BAND = STUDY[0].band, SQ = STUDY[0].sq;
  var FIRE = STUDY[0].fire, ema20 = STUDY[0].e20, atr = STUDY[0].atr;

  /* ADX / DI, simplified but real in shape */
  var ADX = (function () {
    var dxs = [], pdi = [], mdi = [];
    for (var i = 1; i < BARS.length; i++) {
      var up = BARS[i].h - BARS[i-1].h, dn = BARS[i-1].l - BARS[i].l;
      var p = up > dn && up > 0 ? up : 0, m = dn > up && dn > 0 ? dn : 0;
      var a = atr[i] || 1;
      pdi.push(100 * p / a); mdi.push(100 * m / a);
      dxs.push(100 * Math.abs(pdi[i-1] - mdi[i-1]) / Math.max(1, pdi[i-1] + mdi[i-1]));
    }
    var sm = [], k = 14;
    for (var j = 0; j < dxs.length; j++) sm.push(j === 0 ? dxs[0] : (sm[j-1] * (k-1) + dxs[j]) / k);
    return { adx: sm, pdi: pdi, mdi: mdi };
  })();

  /* ---------- geometry ---------- */
  var R = {
    chart:    { x: 24,  y: 88,  w: 672, h: 330 },
    adx:      { x: 24,  y: 430, w: 672, h: 106 },
    equity:   { x: 24,  y: 548, w: 672, h: 108 },
    regime:   { x: 708, y: 88,  w: 468, h: 74  },
    chain:    { x: 708, y: 174, w: 468, h: 130 },
    catalyst: { x: 708, y: 316, w: 468, h: 96  },
    flow:     { x: 708, y: 424, w: 468, h: 116 },
    ticket:   { x: 708, y: 552, w: 468, h: 104 }
  };
  var PLOT = { x: 40, y: 124, w: 640, h: 226 };
  var DOTY = 368;

  /* which panel each scene lights, in order */
  var ORDER = ['regime','chart','chain','adx','chart','catalyst','flow','ticket','ticket'];

  /* ---------- DOM ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function E(t, cls, css) {
    var e = document.createElement(t);
    if (cls) e.className = cls;
    if (css) for (var k in css) e.style[k] = css[k];
    return e;
  }
  function S(t, at) {
    var e = document.createElementNS(NS, t);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }
  function place(el, r) {
    el.style.left = r.x + 'px'; el.style.top = r.y + 'px';
    el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
  }

  var stage = E('div', 'sq-stage');
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  host.appendChild(stage);

  /* progress hairline + caption */
  var progBar = E('div', 'sq-prog'); stage.appendChild(progBar);
  var cap = E('div', 'sq-cap'); stage.appendChild(cap);
  var capNum = E('span', 'sq-cap__n'); cap.appendChild(capNum);
  var capTxt = E('span', 'sq-cap__t'); cap.appendChild(capTxt);
  var mark = E('div', 'sq-mark'); mark.textContent = C.wordmark; stage.appendChild(mark);

  var P = {};
  function panel(key, title) {
    var p = E('div', 'sq-panel'); place(p, R[key]); stage.appendChild(p);
    var h = E('div', 'sq-panel__h'); h.textContent = title; p.appendChild(h);
    P[key] = p; return p;
  }

  /* --- chart --- */
  var chart = panel('chart', '');
  var chartH = chart.querySelector('.sq-panel__h');
  var csvg = S('svg', { class: 'sq-svg', viewBox: '0 0 ' + R.chart.w + ' ' + R.chart.h });
  chart.appendChild(csvg);

  function cx(i) { return (PLOT.x - R.chart.x) + i / (BARS.length - 1) * PLOT.w; }
  function cyOf(st, v) { return (PLOT.y - R.chart.y) + (1 - (v - st.lo) / (st.hi - st.lo)) * PLOT.h; }
  function cy(v) { return cyOf(STUDY[0], v); }

  /* one drawn chart per timeframe; only one is opaque at a time */
  var CHARTS = STUDY.map(function (st, n) {
    var g = S('g', {});
    csvg.appendChild(g);

    function band(k1, k2) {
      var up = st.band.map(function (b, i) { return (i ? 'L' : 'M') + cx(i).toFixed(1) + ' ' + cyOf(st, b[k1]).toFixed(1); }).join(' ');
      var dn = st.band.map(function (b, i) { return cx(i).toFixed(1) + ' ' + cyOf(st, b[k2]).toFixed(1); }).reverse();
      return up + ' L' + dn.join(' L') + ' Z';
    }
    var kc = S('path', { d: band('kcU','kcL'), class: 'sq-kc' }); g.appendChild(kc);
    var bb = S('path', { d: band('bbU','bbL'), class: 'sq-bb' }); g.appendChild(bb);

    var ribbon = st.emas.map(function (e) {
      var d = e.map(function (v, i) { return (i ? 'L' : 'M') + cx(i).toFixed(1) + ' ' + cyOf(st, v).toFixed(1); }).join(' ');
      var p = S('path', { d: d, class: 'sq-ema' }); g.appendChild(p); return p;
    });

    var w = Math.max(2.2, PLOT.w / st.bars.length * 0.56);
    var cg = S('g', {}); g.appendChild(cg);
    st.bars.forEach(function (b, i) {
      cg.appendChild(S('line', { x1: cx(i), x2: cx(i), y1: cyOf(st, b.h), y2: cyOf(st, b.l), class: 'sq-wick' }));
      var y0 = cyOf(st, Math.max(b.o, b.c)), y1 = cyOf(st, Math.min(b.o, b.c));
      cg.appendChild(S('rect', { x: cx(i) - w/2, y: y0, width: w, height: Math.max(1, y1 - y0),
                                 class: 'sq-body ' + (b.c >= b.o ? 'is-up' : 'is-dn') }));
    });

    var dg = S('g', {}); g.appendChild(dg);
    var dots = st.bars.map(function (b, i) {
      if (i < 12) return null;
      var c = S('circle', { cx: cx(i), cy: DOTY - R.chart.y, r: 2.6, class: 'sq-dot' });
      /* only the opening chart animates its dots; the rest sit settled */
      if (n > 0) c.setAttribute('fill', st.sq[i] ? mix(CO.dim, CO.down, 1) : mix(CO.dim, CO.up, 1));
      dg.appendChild(c); return c;
    });

    return { g: g, kc: kc, bb: bb, ribbon: ribbon, cg: cg, dg: dg, dots: dots, st: st };
  });

  var pinLine = S('line', { x1: cx(0), x2: cx(BARS.length-1), class: 'sq-pin' }); csvg.appendChild(pinLine);
  var pinTag  = S('text', { class: 'sq-pintag', x: cx(BARS.length-1) - 6 }); csvg.appendChild(pinTag);

  /* timeframe tabs: the thing the cursor actually clicks in scene 3 */
  var TABW = 52, TABX = R.chart.w - 16 - TABW * 4;
  var tabs = C.chain.frames.map(function (f, i) {
    var t = E('div', 'sq-tab');
    t.textContent = f;
    t.style.left = (TABX + i * TABW) + 'px';
    t.style.width = (TABW - 4) + 'px';
    chart.appendChild(t);
    return t;
  });
  function tabPoint(i) { return { x: R.chart.x + TABX + i * TABW + (TABW - 4) / 2, y: R.chart.y + 18 }; }

  var sqChip = E('div', 'sq-chip'); sqChip.textContent = C.squeeze.verdict;
  sqChip.style.left = '16px'; sqChip.style.top = (DOTY - R.chart.y + 14) + 'px';
  chart.appendChild(sqChip);
  var emaChip = E('div', 'sq-chip sq-chip--r'); emaChip.textContent = C.ema.verdict;
  emaChip.style.right = '16px'; emaChip.style.top = (DOTY - R.chart.y + 14) + 'px';
  chart.appendChild(emaChip);

  /* --- ADX --- */
  var adxP = panel('adx', C.adx.title);
  var asvg = S('svg', { class: 'sq-svg', viewBox: '0 0 ' + R.adx.w + ' ' + R.adx.h });
  adxP.appendChild(asvg);
  var AP = { x: 16, y: 30, w: R.adx.w - 32, h: R.adx.h - 44 };
  function ax(i) { return AP.x + i / (ADX.adx.length - 1) * AP.w; }
  function ay(v) { return AP.y + (1 - clamp(v, 0, 50) / 50) * AP.h; }
  asvg.appendChild(S('line', { x1: AP.x, x2: AP.x + AP.w, y1: ay(C.adx.threshold), y2: ay(C.adx.threshold), class: 'sq-thr' }));
  var thrHot = S('line', { x1: AP.x, x2: AP.x + AP.w, y1: ay(C.adx.threshold), y2: ay(C.adx.threshold), class: 'sq-thr-hot' });
  asvg.appendChild(thrHot);
  function aline(arr, cls) {
    var d = arr.map(function (v, i) { return (i ? 'L' : 'M') + ax(i).toFixed(1) + ' ' + ay(v).toFixed(1); }).join(' ');
    var p = S('path', { d: d, class: cls }); asvg.appendChild(p); return p;
  }
  var pdiP = aline(ADX.pdi, 'sq-di sq-di--p');
  var mdiP = aline(ADX.mdi, 'sq-di sq-di--m');
  var adxLine = aline(ADX.adx, 'sq-adx');
  var adxChip = E('div', 'sq-chip'); adxChip.textContent = C.adx.verdict;
  adxChip.style.right = '16px'; adxChip.style.top = '8px'; adxP.appendChild(adxChip);

  /* --- equity --- */
  var eqP = panel('equity', 'BOOK');
  var esvg = S('svg', { class: 'sq-svg', viewBox: '0 0 ' + R.equity.w + ' ' + R.equity.h });
  eqP.appendChild(esvg);
  var EP = { x: 16, y: 30, w: R.equity.w - 32, h: R.equity.h - 46 };
  var eqPts = (function () { var r = rng(77), a = [0], v = 0;
    for (var i = 1; i < 46; i++) { v += r() * 0.9 - 0.28; a.push(v); } return a; })();
  var eqMin = Math.min.apply(null, eqPts), eqMax = Math.max.apply(null, eqPts) + 2.4;
  function ex(i) { return EP.x + i / 46 * EP.w; }
  function ey(v) { return EP.y + (1 - (v - eqMin) / (eqMax - eqMin)) * EP.h; }
  var eqPath = S('path', { d: eqPts.map(function (v, i) { return (i ? 'L' : 'M') + ex(i).toFixed(1) + ' ' + ey(v).toFixed(1); }).join(' '), class: 'sq-eq' });
  esvg.appendChild(eqPath);
  var eqStep = S('path', { class: 'sq-eq sq-eq--new' }); esvg.appendChild(eqStep);
  var eqDot = S('circle', { r: 3, class: 'sq-eqdot' }); esvg.appendChild(eqDot);

  /* --- regime --- */
  var rgP = panel('regime', C.regime.title);
  var vixV = E('div', 'sq-big'); rgP.appendChild(vixV);
  var vixK = E('div', 'sq-k'); vixK.textContent = C.regime.vixLabel; rgP.appendChild(vixK);
  var rgChip = E('div', 'sq-chip sq-chip--wide'); rgChip.textContent = C.regime.verdict; rgP.appendChild(rgChip);

  /* --- chain --- */
  var chP = panel('chain', C.chain.title);
  var chRows = C.chain.frames.map(function (f, i) {
    var row = E('div', 'sq-row'); row.style.top = (34 + i * 22) + 'px';
    var k = E('span', 'sq-row__k'); k.textContent = f; row.appendChild(k);
    var bar = E('span', 'sq-row__bar'); row.appendChild(bar);
    var tick = E('span', 'sq-row__tick'); tick.textContent = '✓'; row.appendChild(tick);
    chP.appendChild(row);
    return { row: row, bar: bar, tick: tick };
  });
  var chChip = E('div', 'sq-chip sq-chip--r'); chChip.textContent = C.chain.verdict;
  chChip.style.right = '14px'; chChip.style.top = '8px'; chP.appendChild(chChip);

  /* --- catalyst --- */
  var caP = panel('catalyst', C.catalyst.title);
  var head = E('div', 'sq-head'); head.textContent = C.catalyst.headline; caP.appendChild(head);
  var rvK = E('div', 'sq-k sq-k--rv'); rvK.textContent = C.catalyst.rvolLabel; caP.appendChild(rvK);
  var rvV = E('div', 'sq-rv'); caP.appendChild(rvV);
  var rvBar = E('div', 'sq-rvbar'); var rvFill = E('i'); rvBar.appendChild(rvFill); caP.appendChild(rvBar);

  /* --- flow --- */
  var flP = panel('flow', C.flow.title);
  var flClip = E('div', 'sq-clip'); flP.appendChild(flClip);
  var flScroll = E('div', 'sq-scroll'); flClip.appendChild(flScroll);
  var flRows = C.flow.rows.map(function (r, i) {
    var row = E('div', 'sq-frow');
    [r.k, r.oi, r.d].forEach(function (v, n) {
      var c = E('span', 'sq-frow__c' + (n ? '' : ' is-k')); c.textContent = v; row.appendChild(c);
    });
    flScroll.appendChild(row); return row;
  });
  var flChip = E('div', 'sq-chip sq-chip--r'); flChip.textContent = C.flow.verdict;
  flChip.style.right = '14px'; flChip.style.top = '8px'; flP.appendChild(flChip);

  /* --- ticket --- */
  var tkP = panel('ticket', C.ticket.title);
  var tkFields = C.ticket.fields.map(function (f, i) {
    var col = i % 3, row = Math.floor(i / 3);
    var el = E('div', 'sq-fld');
    el.style.left = (14 + col * 150) + 'px';
    el.style.top = (30 + row * 30) + 'px';
    var k = E('span', 'sq-fld__k'); k.textContent = f[0]; el.appendChild(k);
    var v = E('span', 'sq-fld__v'); el.appendChild(v);
    tkP.appendChild(el);
    return { el: el, v: v, full: f[1] };
  });
  var rrBadge = E('div', 'sq-rr'); tkP.appendChild(rrBadge);
  var btn = E('div', 'sq-btn'); btn.textContent = C.ticket.button; tkP.appendChild(btn);
  var toast = E('div', 'sq-toast'); toast.textContent = C.execute.toast; stage.appendChild(toast);

  /* --- cursor --- */
  /* the pointer is the Odysseon mark, cut out of its background, and it is
     centred on the target rather than tipped at it the way an arrow is */
  var cur = E('div', 'sq-cursor');
  cur.innerHTML = '<img class="sq-cursor__m" src="assets/odysseon-mark.png" alt="">';
  stage.appendChild(cur);
  var ripple = E('div', 'sq-ripple'); stage.appendChild(ripple);

  /* ---------- cursor path ---------- */
  var HOME = { x: 612, y: 402 };
  function mid(r, fx, fy) { return { x: r.x + r.w * fx, y: r.y + r.h * fy }; }


  /* one entry per click: when it happens and where */
  var STOPS = [], TAB_F = [];
  (function build() {
    function sc(id) { for (var i = 0; i < scenes.length; i++) if (scenes[i].id === id) return scenes[i]; }
    var s;
    s = sc('regime');   STOPS.push({ f: s.from + Math.round(s.len * 0.55), p: mid(R.regime, 0.74, 0.55) });
    s = sc('squeeze');  STOPS.push({ f: s.from + Math.round(s.len * 0.45), p: { x: cx(FIRE) + R.chart.x, y: DOTY } });
    s = sc('chain');
    for (var ti = 0; ti < 4; ti++) {
      var tf = s.from + Math.round(s.len * (0.20 + ti * 0.19));
      TAB_F.push(tf);
      STOPS.push({ f: tf, p: tabPoint(ti) });
    }
    s = sc('adx');      STOPS.push({ f: s.from + Math.round(s.len * 0.5), p: mid(R.adx, 0.62, 0.55) });
    s = sc('ema');      STOPS.push({ f: s.from + Math.round(s.len * 0.5), p: { x: R.chart.x + cx(30), y: R.chart.y + cy(ema20[30]) } });
    s = sc('catalyst'); STOPS.push({ f: s.from + Math.round(s.len * 0.45), p: mid(R.catalyst, 0.5, 0.6) });
    s = sc('flow');     STOPS.push({ f: s.from + Math.round(s.len * 0.55), p: mid(R.flow, 0.5, 0.62) });
    s = sc('ticket');   STOPS.push({ f: s.from + Math.round(s.len * 0.45), p: mid(R.ticket, 0.5, 0.45) });
    s = sc('execute');  STOPS.push({ f: s.from + Math.round(s.len * 0.30), p: { x: R.ticket.x + R.ticket.w - 62, y: R.ticket.y + R.ticket.h - 22 } });
  })();

  /* which chart is on screen when. The tail entry returns to the opening
     chart during the cascade, once it has dimmed, so frame 0 and the final
     frame show the same drawing. */
  var TFSWITCH = [{ f: 0, idx: 0 }]
    .concat(TAB_F.map(function (fr, i) { return { f: fr, idx: i + 1 }; }))
    .concat([{ f: 0, idx: 0 }]);
  TFSWITCH[TFSWITCH.length - 1].f = acc - 26;
  var SWAP = 9;

  var DWELL = Math.round(T.cursor.dwell * FPS);
  var TRAVEL = Math.round(T.cursor.travel * FPS);

  /* position of the pointer at any frame, as an eased arc between stops */
  function cursorAt(f) {
    var prevP = HOME, prevF = 0;
    for (var i = 0; i < STOPS.length; i++) {
      var s = STOPS[i];
      var arriveAt = s.f - DWELL;
      var leaveAt = Math.max(prevF, arriveAt - TRAVEL);
      if (f < leaveAt) return { x: prevP.x, y: prevP.y, moving: false, idx: i };
      if (f < arriveAt) {
        var t = (f - leaveAt) / Math.max(1, arriveAt - leaveAt);
        return arc(prevP, s.p, t, i);
      }
      if (f <= s.f + 6) return { x: s.p.x, y: s.p.y, moving: false, idx: i };
      prevP = s.p; prevF = s.f;
    }
    /* home run, landing exactly on the final frame so frame 0 matches */
    var back = Math.min(TRAVEL + 20, N - 1 - prevF);
    var t2 = clamp((f - (N - 1 - back)) / Math.max(1, back), 0, 1);
    return arc(prevP, HOME, t2, STOPS.length);
  }
  function arc(a, b, t, salt) {
    var e = settle(t, T.cursor.overshoot);
    var x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e);
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    var bow = Math.sin(Math.PI * clamp(t, 0, 1)) * T.cursor.arc * (salt % 2 ? 1 : -1) * Math.min(1, L / 420);
    return { x: x + (-dy / L) * bow, y: y + (dx / L) * bow, moving: t < 1, idx: salt };
  }

  /* ---------- per-scene helpers ---------- */
  function sceneOf(id) { for (var i = 0; i < scenes.length; i++) if (scenes[i].id === id) return scenes[i]; }
  var CASCADE = sceneOf('execute');
  var CASC_FROM = CASCADE.from + Math.round(CASCADE.len * 0.46);
  var CASC_TO = N - 1;

  /* lit(order) — 0 before the scene, 1 once passed, 0 again by the last frame */
  function lit(orderIndex, f) {
    var s = scenes[orderIndex];
    var up = smooth((f - s.from) / (FPS * 0.30));
    var k = (ORDER.length - 1) - orderIndex;
    var span = (CASC_TO - CASC_FROM);
    var w = span / (ORDER.length + 2);
    var d0 = CASC_FROM + k * w * 0.78;
    var down = 1 - smooth((f - d0) / Math.max(1, w * 1.5));
    return clamp(Math.min(up, down), 0, 1);
  }
  /* progress through a scene's own animation */
  function prog(id, f, a, b) {
    var s = sceneOf(id);
    return clamp((f - (s.from + s.len * (a || 0))) / Math.max(1, s.len * ((b || 1) - (a || 0))), 0, 1);
  }

  /* ---------- the one function that matters ---------- */
  function renderFrame(f) {
    f = ((f % N) + N) % N;

    var L = {};
    ORDER.forEach(function (_, i) { L[scenes[i].id] = lit(i, f); });

    /* chart lights on the squeeze scene and stays up through the EMA scene */
    var chartLit = Math.max(L.squeeze, L.ema);

    /* --- chrome --- */
    var edge = Math.min(smooth(f / (FPS * 0.35)), 1 - smooth((f - (N - 1 - FPS * 0.35)) / (FPS * 0.35)));
    prog_(edge, f);

    /* --- panels --- */
    setPanel(P.regime,   L.regime);
    setPanel(P.chart,    chartLit);
    setPanel(P.chain,    L.chain);
    setPanel(P.adx,      L.adx);
    setPanel(P.catalyst, L.catalyst);
    setPanel(P.flow,     L.flow);
    setPanel(P.ticket,   Math.max(L.ticket, L.execute));
    setPanel(P.equity,   Math.max(0.34, L.execute) * Math.max(edge, 0));

    /* 1 — regime */
    var rp = prog('regime', f, 0.1, 0.8) * L.regime;
    vixV.textContent = lerp(C.regime.vixFrom, C.regime.vixTo, rp).toFixed(1);
    vixV.style.color = mix(CO.dim, CO.gold, rp);
    chip(rgChip, rp > 0.9 ? L.regime : 0);

    /* which timeframe is drawn, and the crossfade between two of them */
    var si = 0;
    for (var q = 0; q < TFSWITCH.length; q++) if (f >= TFSWITCH[q].f) si = q;
    var tfCur = TFSWITCH[si].idx;
    var tfPrev = si > 0 ? TFSWITCH[si - 1].idx : tfCur;
    var tfT = smooth(clamp((f - TFSWITCH[si].f) / SWAP, 0, 1));

    /* 2 — squeeze: dots fire left to right, bands separate */
    var sp = prog('squeeze', f, 0.15, 0.85) * L.squeeze;
    var ep = prog('ema', f, 0.1, 0.8) * L.ema;

    CHARTS.forEach(function (ch, i) {
      var o = (i === tfCur && i === tfPrev) ? 1 : i === tfCur ? tfT : i === tfPrev ? 1 - tfT : 0;
      ch.g.style.opacity = o.toFixed(3);
      ch.g.style.display = o < 0.002 ? 'none' : '';
      ch.bb.setAttribute('opacity', (0.10 + 0.30 * chartLit).toFixed(3));
      ch.kc.setAttribute('opacity', (0.05 + 0.16 * chartLit).toFixed(3));
      ch.cg.setAttribute('opacity', (0.16 + 0.84 * chartLit).toFixed(3));
      ch.dg.setAttribute('opacity', (0.25 + 0.75 * chartLit).toFixed(3));
      ch.ribbon.forEach(function (p) {
        p.setAttribute('stroke', mix(CO.dim, CO.up, ep));
        p.setAttribute('opacity', (0.30 + 0.55 * chartLit).toFixed(3));
      });
    });

    /* the opening chart is the one whose squeeze is watched firing */
    CHARTS[0].dots.forEach(function (d, i) {
      if (!d) return;
      var fired = SQ[i] ? 0 : 1;
      var reached = clamp((sp * BARS.length - i) / 3, 0, 1);
      var on = fired * reached;
      d.setAttribute('fill', on > 0.5 ? mix(CO.dim, CO.up, on) : mix(CO.dim, CO.down, 1 - reached * 0.3));
    });
    chip(sqChip, sp > 0.85 ? L.squeeze : 0);

    /* the tabs, and the header naming what is on screen */
    tabs.forEach(function (t, i) {
      var on = (i + 1 === tfCur) ? 1 : 0;
      t.style.opacity = (0.30 + 0.70 * Math.max(on, L.chain * 0.55)).toFixed(3);
      t.style.color = on ? 'var(--ground)' : 'var(--ink-muted)';
      t.style.background = on ? 'var(--gold)' : 'transparent';
      t.style.borderColor = 'rgba(191,167,110,' + (on ? 0.9 : 0.22) + ')';
    });
    chartH.textContent = C.ticker + '  \u00B7  ' + (tfCur ? C.chain.frames[tfCur - 1] : C.squeeze.sub);

    /* 3 — chain: a check lands per timeframe, then the set locks */
    var cp = prog('chain', f, 0.10, 0.92) * L.chain;
    chRows.forEach(function (r, i) {
      var on = clamp(cp * 4 - i, 0, 1);
      r.bar.style.transform = 'scaleX(' + on.toFixed(3) + ')';
      r.tick.style.opacity = on.toFixed(3);
      r.tick.style.transform = 'scale(' + (0.7 + 0.3 * easeOut(on)).toFixed(3) + ')';
      r.row.style.opacity = (0.4 + 0.6 * L.chain).toFixed(3);
    });
    var locked = cp > 0.985 ? 1 : 0;
    chip(chChip, locked * L.chain);
    P.chain.style.boxShadow = locked
      ? '0 0 0 1px rgba(191,167,110,' + (0.34 * L.chain).toFixed(3) + ') inset' : 'none';

    /* 4 — ADX crosses 25 */
    var ap = prog('adx', f, 0.12, 0.88) * L.adx;
    [adxLine, pdiP, mdiP].forEach(function (p) { reveal(p, ap); });
    thrHot.setAttribute('opacity', (ap > 0.72 ? (ap - 0.72) / 0.28 : 0).toFixed(3));
    chip(adxChip, ap > 0.9 ? L.adx : 0);

    /* 5 — EMA cloud turns with price (the ribbon itself is set per chart above) */
    chip(emaChip, ep > 0.85 ? L.ema : 0);

    /* 6 — catalyst chip slides in, RVOL sweeps */
    var kp = prog('catalyst', f, 0.05, 0.55) * L.catalyst;
    var vp = prog('catalyst', f, 0.25, 0.9) * L.catalyst;
    head.style.transform = 'translateX(' + ((1 - easeOut(kp)) * -26).toFixed(1) + 'px)';
    head.style.opacity = easeOut(kp).toFixed(3);
    rvV.textContent = (C.catalyst.rvolTo * vp).toFixed(1) + '×';
    rvV.style.color = mix(CO.dim, CO.gold, vp);
    rvFill.style.transform = 'scaleX(' + (vp).toFixed(3) + ')';

    /* 7 — options chain scrolls, snaps to the pin strike */
    var fp = prog('flow', f, 0.05, 0.62) * L.flow;
    var snap = prog('flow', f, 0.62, 0.8) * L.flow;
    var rowH = 20, clipH = 74, targetY = -C.flow.pick * rowH + (clipH - rowH) / 2 - rowH;
    var spin = (1 - easeInOut(fp)) * -rowH * 9;
    flScroll.style.transform = 'translateY(' + (targetY * easeInOut(fp) + spin * (1 - fp)).toFixed(1) + 'px)';
    flScroll.style.filter = 'blur(' + ((1 - easeInOut(fp)) * 2.2).toFixed(2) + 'px)';
    flRows.forEach(function (r, i) {
      var on = (i === C.flow.pick) ? snap : 0;
      r.style.background = on > 0 ? 'rgba(191,167,110,' + (0.16 * on).toFixed(3) + ')' : 'transparent';
      r.style.color = on > 0.4 ? mix(CO.ink, CO.gold, on) : '';
      r.style.opacity = (0.45 + 0.55 * L.flow).toFixed(3);
    });
    chip(flChip, snap > 0.7 ? L.flow : 0);
    var pst = CHARTS[tfCur].st;
    var pinY = cyOf(pst, pst.bars[Math.min(pst.bars.length - 1, pst.fire + 8)].c) - 8;
    pinLine.setAttribute('y1', pinY); pinLine.setAttribute('y2', pinY);
    pinLine.setAttribute('opacity', (0.9 * snap * chartLit).toFixed(3));
    pinTag.setAttribute('y', pinY - 6);
    pinTag.setAttribute('opacity', (0.95 * snap * chartLit).toFixed(3));
    pinTag.textContent = 'PIN ' + C.flow.rows[C.flow.pick].k;

    /* 8 — ticket writes itself */
    var tp = prog('ticket', f, 0.08, 0.86) * L.ticket;
    tkFields.forEach(function (fl, i) {
      var on = clamp(tp * tkFields.length - i, 0, 1);
      var n = Math.round(on * fl.full.length);
      fl.v.textContent = fl.full.slice(0, n);
      fl.el.style.opacity = (0.30 + 0.70 * clamp(on * 2, 0, 1) * L.ticket).toFixed(3);
    });
    var rrOn = tp > 0.94 ? 1 : 0;
    rrBadge.textContent = C.ticket.rrLabel + '  ' + C.ticket.rr;
    chip(rrBadge, rrOn * L.ticket);
    btn.style.opacity = (0.35 + 0.65 * L.ticket).toFixed(3);

    /* 9 — execute, then the terminal rearms */
    var xf = STOPS[STOPS.length - 1].f;
    var press = clamp((f - xf) / 6, 0, 1) * (1 - clamp((f - xf - 6) / 10, 0, 1));
    btn.style.transform = 'scale(' + (1 - 0.045 * press).toFixed(3) + ')';
    btn.style.background = 'rgba(191,167,110,' + (0.14 + 0.5 * press * L.execute).toFixed(3) + ')';
    var tShow = clamp((f - xf - 4) / 10, 0, 1) * L.execute;
    toast.style.opacity = tShow.toFixed(3);
    toast.style.transform = 'translateY(' + ((1 - easeOut(tShow)) * 10).toFixed(1) + 'px)';

    var eStep = clamp((f - xf - 6) / 14, 0, 1) * L.execute;
    var last = eqPts.length - 1;
    eqStep.setAttribute('d', 'M' + ex(last) + ' ' + ey(eqPts[last]) +
                             ' L' + ex(last + 1) + ' ' + ey(eqPts[last] + 2.1 * eStep));
    eqStep.setAttribute('opacity', eStep.toFixed(3));
    eqDot.setAttribute('cx', ex(last + eStep)); eqDot.setAttribute('cy', ey(eqPts[last] + 2.1 * eStep));
    eqDot.setAttribute('opacity', eStep.toFixed(3));

    /* --- cursor --- */
    var c = cursorAt(f);
    var jx = 0, jy = 0;
    if (!c.moving && T.cursor.jitter > 0) {
      jx = drift(f, 3, 2.4) * T.cursor.jitter * edge;
      jy = drift(f, 7, 3.1) * T.cursor.jitter * edge;
    }
    var clickScale = 1;
    for (var i = 0; i < STOPS.length; i++) {
      var d = f - STOPS[i].f;
      if (d >= 0 && d < 5) clickScale = 0.92;
      if (d >= 0 && d < 26) {
        ripple.style.left = STOPS[i].p.x + 'px'; ripple.style.top = STOPS[i].p.y + 'px';
        var rt = d / 26;
        ripple.style.transform = 'translate(-50%,-50%) scale(' + (0.2 + rt * 2.6).toFixed(3) + ')';
        ripple.style.opacity = ((1 - rt) * 0.5).toFixed(3);
      }
    }
    var anyRipple = STOPS.some(function (s) { return f - s.f >= 0 && f - s.f < 26; });
    if (!anyRipple) ripple.style.opacity = '0';
    cur.style.transform = 'translate(' + (c.x + jx).toFixed(2) + 'px,' + (c.y + jy).toFixed(2) + 'px) scale(' + clickScale + ')';
    cur.style.opacity = edge.toFixed(3);

    /* --- caption --- */
    var active = scenes[0], into = 0;
    if (edge > 0.001) {
      for (var i = 0; i < scenes.length; i++) if (f >= scenes[i].from) active = scenes[i];
      into = (f - active.from) / Math.max(1, active.len);
    }
    var slide = 1 - smooth(clamp(into / 0.10, 0, 1));
    capNum.textContent = String(active.i + 1).padStart(2, '0') + ' / 0' + scenes.length;
    capTxt.textContent = active.label;
    cap.style.opacity = (edge * (0.35 + 0.65 * (1 - slide))).toFixed(3);
    capTxt.style.transform = 'translateY(' + (slide * 7).toFixed(2) + 'px)';
  }

  /* the bar fills across the loop; it fades at both ends so the seam holds */
  function prog_(edge, f) {
    /* fills across the loop, fades at both ends; on the two seam frames it is
       fully transparent, so it is also reset to zero width and the seam holds */
    var w = edge <= 0.001 ? 0 : (f / (N - 1));
    progBar.style.transform = 'scaleX(' + w.toFixed(4) + ')';
    progBar.style.opacity = edge.toFixed(3);
  }

  function setPanel(el, v) {
    el.style.opacity = (0.40 + 0.60 * v).toFixed(3);
    el.style.borderColor = 'rgba(191,167,110,' + (0.10 + 0.34 * v).toFixed(3) + ')';
    el.style.background = v > 0.02
      ? 'rgba(7,37,84,' + (0.34 + 0.34 * v).toFixed(3) + ')'
      : 'rgba(7,37,84,0.30)';
  }
  function chip(el, v) {
    el.style.opacity = v.toFixed(3);
    el.style.transform = 'translateY(' + ((1 - easeOut(v)) * 5).toFixed(2) + 'px)';
  }
  function reveal(p, t) {
    if (!p._len) p._len = p.getTotalLength();
    p.style.strokeDasharray = p._len;
    p.style.strokeDashoffset = (p._len * (1 - easeInOut(t))).toFixed(2);
  }

  /* ---------- driver ---------- */
  var frame = 0, running = false, raf = null, t0 = null;
  function tick(ts) {
    if (t0 === null) t0 = ts;
    frame = Math.floor((ts - t0) / 1000 * FPS) % N;
    renderFrame(frame);
    if (running) raf = requestAnimationFrame(tick);
  }
  function start() { if (running) return; running = true; t0 = null; raf = requestAnimationFrame(tick); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function fit() {
    var w = host.clientWidth;
    if (!w) return;
    stage.style.transform = 'scale(' + (w / W) + ')';
    host.style.height = (H * w / W) + 'px';
  }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(host);
  else window.addEventListener('resize', fit);

  renderFrame(0);

  /* only animate while it is actually on screen */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.15 }).observe(host);
  } else { start(); }

  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : start();
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stop();
    renderFrame(Math.round(sceneOf('ticket').from + sceneOf('ticket').len * 0.9));
  }

  /* ---------- public surface: scrub, capture, verify ---------- */
  window.SEQ = {
    totalFrames: N,
    fps: FPS,
    scenes: scenes,
    render: renderFrame,
    play: start,
    pause: stop,
    seek: function (f) { stop(); renderFrame(f); },
    /* the loop-seam test the render pipeline would gate the build on */
    checkSeam: function (verbose) {
      function snap(f) {
        renderFrame(f);
        return Array.prototype.map.call(stage.querySelectorAll('*'), function (el) {
          var st = el.style;
          return {
            tag: el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || ''),
            v: [st.opacity, st.transform, st.background, st.borderColor, st.strokeDashoffset,
                el.getAttribute('opacity'), el.getAttribute('fill'), el.getAttribute('stroke'),
                el.getAttribute('d'), el.getAttribute('cx'), el.getAttribute('y1'),
                el.textContent && el.textContent.length].join('|')
          };
        });
      }
      var was = frame;
      var a = snap(0), b = snap(N - 1);
      renderFrame(was);
      var diffs = [];
      for (var i = 0; i < a.length; i++) {
        if (a[i].v !== b[i].v) diffs.push({ i: i, node: a[i].tag, at0: a[i].v, atEnd: b[i].v });
      }
      return { identical: diffs.length === 0, nodes: a.length,
               differing: diffs.length, detail: verbose ? diffs : diffs.slice(0, 6) };
    }
  };

  /* ?debug=1 — scrub the timeline and read the frame counter */
  if (/[?&]debug=1/.test(location.search)) {
    var dbg = E('div', 'sq-debug');
    var range = document.createElement('input');
    range.type = 'range'; range.min = 0; range.max = N - 1; range.value = 0;
    var read = E('span', 'sq-debug__n');
    dbg.appendChild(range); dbg.appendChild(read);
    host.appendChild(dbg);
    range.addEventListener('input', function () {
      stop(); frame = +range.value; renderFrame(frame);
      var s = scenes[0]; for (var i = 0; i < scenes.length; i++) if (frame >= scenes[i].from) s = scenes[i];
      read.textContent = frame + ' / ' + (N - 1) + '  ·  ' + (frame / FPS).toFixed(2) + 's  ·  ' + s.id;
    });
    setInterval(function () { if (running) { range.value = frame;
      read.textContent = frame + ' / ' + (N - 1) + '  ·  ' + (frame / FPS).toFixed(2) + 's'; } }, 80);
  }
})();
