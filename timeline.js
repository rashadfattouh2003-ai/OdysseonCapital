/* Odysseon Capital — Section 02, the timeline */

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The module is driven by a config so a second trade can reuse it.
     Absent one it falls back to the IOVA globals, which is how the
     Iovance report has always loaded it. */
  var CFG    = window.TLCFG || {};
  var DATA   = CFG.data   || window.IOVA   || [];
  var EVENTS = CFG.events || window.EVENTS || [];
  var EXIT   = CFG.exit   !== undefined ? CFG.exit : window.EXIT;
  var PXDP   = CFG.pxDp   || 2;
  if (!DATA.length) return;

  /* the overview runs from here; anything earlier is kept only as lead-in
     for the close-ups */
  var VIEW = DATA.filter(function (r) { return r.d >= (CFG.viewFrom || '2026-02-02'); });

  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 300, PL = 8, PT = 26, PB = 34;
  /* a trade that exits near the right edge needs room out there for the
     average-exit label, so the gutter is configurable */
  var PR = CFG.padRight || 8;

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function fmtDate(iso) {
    var m = ['January','February','March','April','May','June',
             'July','August','September','October','November','December'];
    var p = iso.split('-');
    return m[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }

  function fmtShort(iso) {
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var p = iso.split('-');
    return m[+p[1] - 1] + ' ' + (+p[2]);
  }

  function fmtPct(p) { return (p > 0 ? '+' : '') + p.toFixed(2) + '%'; }

  /* ---------------------------------------------------------
     Overview: the price line itself is the timeline
     --------------------------------------------------------- */

  var lo = Math.min.apply(null, VIEW.map(function (r) { return r.l; }));
  var hi = Math.max.apply(null, VIEW.map(function (r) { return r.h; }));
  var pad = (hi - lo) * 0.10;
  lo -= pad; hi += pad;

  function X(i) { return PL + (i / (VIEW.length - 1)) * (W - PL - PR); }
  function Y(p) { return PT + (1 - (p - lo) / (hi - lo)) * (H - PT - PB); }

  var viewIdx = {};
  VIEW.forEach(function (r, i) { viewIdx[r.d] = i; });

  var svg = document.querySelector('#tl-overview');
  if (!svg) return;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  /* month gridlines */
  var seenMonth = {};
  VIEW.forEach(function (r, i) {
    var mo = r.d.slice(0, 7);
    if (seenMonth[mo]) return;
    seenMonth[mo] = true;
    if (i === 0) return;
    svg.appendChild(el('line', {
      x1: X(i), x2: X(i), y1: PT - 10, y2: H - PB + 6, class: 'tl-grid'
    }));
  });

  /* month labels */
  var names = ['January','February','March','April','May','June',
               'July','August','September','October','November','December'];
  var placed = {};
  VIEW.forEach(function (r, i) {
    var mo = r.d.slice(5, 7);
    if (placed[mo]) return;
    placed[mo] = true;
    var t = el('text', { x: X(i) + 6, y: H - PB + 22, class: 'tl-month' });
    t.textContent = names[+mo - 1] || mo;
    svg.appendChild(t);
  });

  /* the price path, plus a soft fill beneath it */
  var d = VIEW.map(function (r, i) { return (i ? 'L' : 'M') + X(i).toFixed(2) + ' ' + Y(r.c).toFixed(2); }).join(' ');

  /* Optional Heikin-Ashi candles. Seeded from the very start of DATA, not
     from the visible window, so the first candle on screen carries a real
     average rather than an arbitrary one. */
  var candleG = null;

  if (CFG.candles) {
    var ha = [], po = null, pc = null;
    DATA.forEach(function (r) {
      var hc = (r.o + r.h + r.l + r.c) / 4;
      var ho = (po === null) ? (r.o + r.c) / 2 : (po + pc) / 2;
      ha.push({ d: r.d, ho: ho, hc: hc,
                hh: Math.max(r.h, ho, hc), hl: Math.min(r.l, ho, hc),
                up: hc >= ho });
      po = ho; pc = hc;
    });
    var haBy = {};
    ha.forEach(function (r) { haBy[r.d] = r; });

    var slotW = (W - PL - PR) / VIEW.length;
    var bodyW = Math.max(2, Math.min(11, slotW * 0.6));

    candleG = el('g', { class: 'tl-candles' });

    VIEW.forEach(function (r, i) {
      var k = haBy[r.d];
      if (!k) return;
      var x = X(i);
      var g = el('g', { class: 'tl-c ' + (k.up ? 'tl-c--up' : 'tl-c--dn') });
      g.appendChild(el('line', { x1: x, x2: x, y1: Y(k.hh), y2: Y(k.hl), class: 'tl-c__w' }));
      var top = Y(Math.max(k.ho, k.hc));
      g.appendChild(el('rect', {
        x: x - bodyW / 2, y: top, width: bodyW,
        height: Math.max(1, Math.abs(Y(k.hc) - Y(k.ho))), class: 'tl-c__b'
      }));
      candleG.appendChild(g);
    });

    svg.appendChild(candleG);
  } else {
    svg.appendChild(el('path', { d: d + ' L' + X(VIEW.length - 1) + ' ' + (H - PB) + ' L' + X(0) + ' ' + (H - PB) + ' Z', class: 'tl-fill' }));
  }

  var line = el('path', { d: d, class: 'tl-line' });
  if (!CFG.candles) svg.appendChild(line);

  /* everything from the exit onward is ours, and is drawn in gold */
  var exitFrom = EXIT ? viewIdx[EXIT.from] : undefined;

  if (exitFrom !== undefined) {
    var tail = VIEW.slice(exitFrom);
    var dg = tail.map(function (r, n) {
      return (n ? 'L' : 'M') + X(exitFrom + n).toFixed(2) + ' ' + Y(r.c).toFixed(2);
    }).join(' ');

    if (!CFG.candles) {
      svg.appendChild(el('path', {
        d: dg + ' L' + X(VIEW.length - 1) + ' ' + (H - PB) + ' L' + X(exitFrom) + ' ' + (H - PB) + ' Z',
        class: 'tl-fill tl-fill--exit'
      }));
      svg.appendChild(el('path', { d: dg, class: 'tl-line tl-line--exit' }));
    }

    /* the average of the scale-out, as a line you can press */
    var gx0 = X(exitFrom), gx1 = X(VIEW.length - 1), gy = Y(EXIT.avg);

    var ge = el('g', {
      class: 'tl-avg', tabindex: '0', role: 'button',
      'aria-label': 'Our exit, average ' + EXIT.avg.toFixed(2) + ' dollars'
    });
    ge.dataset.exit = '1';

    ge.appendChild(el('rect', { x: gx0, y: gy - 12, width: (gx1 - gx0) + 40, height: 24, class: 'tl-avg__hit' }));
    ge.appendChild(el('line', { x1: gx0 - 4, x2: gx1 + 6, y1: gy, y2: gy, class: 'tl-avg__line' }));

    /* With a late exit there is no clear space to the left of the line for
       the key, so it stacks above the price at the right-hand end rather
       than landing on top of the curve. */
    var keyRight = !!CFG.avgKeyRight;

    var gl = el('text', {
      x: gx1 + 12, y: gy + (keyRight ? 14 : 4), class: 'tl-avg__label'
    });
    gl.textContent = '$' + EXIT.avg.toFixed(PXDP);
    ge.appendChild(gl);

    var gk = el('text', {
      x: keyRight ? gx1 + 12 : gx0 - 8,
      y: keyRight ? gy - 6 : gy - 10,
      class: 'tl-avg__key' + (keyRight ? ' tl-avg__key--right' : '')
    });
    gk.textContent = 'AVG EXIT';
    ge.appendChild(gk);

    svg.appendChild(ge);
  }

  /* draw the overview line in once it scrolls into view */
  if (!reduced && CFG.candles) {
    var cd = el('defs', {});
    var cpth = el('clipPath', { id: 'tl-reveal' });
    var crect = el('rect', { x: 0, y: 0, width: 0, height: H });
    cpth.appendChild(crect); cd.appendChild(cpth); svg.appendChild(cd);
    candleG.setAttribute('clip-path', 'url(#tl-reveal)');

    var cseen = false;
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || cseen) return;
        cseen = true;
        requestAnimationFrame(function (t0) {
          (function run(ts) {
            var t = Math.min((ts - t0) / 1500, 1);
            crect.setAttribute('width', (W * (1 - Math.pow(1 - t, 3))).toFixed(2));
            if (t < 1) requestAnimationFrame(run); else svg.classList.add('is-drawn');
          })(t0);
        });
      });
    }, { threshold: 0.25 });
    cio.observe(svg);
  } else if (!reduced) {
    var len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    var seen = false;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || seen) return;
        seen = true;
        line.style.transition = 'stroke-dashoffset 1800ms cubic-bezier(.4,0,.2,1)';
        line.style.strokeDashoffset = 0;
        setTimeout(function () { svg.classList.add('is-drawn'); }, 900);
      });
    }, { threshold: 0.25 });
    io.observe(svg);
  } else {
    svg.classList.add('is-drawn');
  }

  /* event markers, sitting on the curve */
  var lastX = -999, lastLabY = -999;

  EVENTS.forEach(function (ev, n) {
    var i = viewIdx[ev.d];
    if (i === undefined) return;
    var x = X(i), y = Y(ev.close);

    /* adjacent sessions would stack their numbers on top of each other:
       nudge the later one sideways and push it clear of its neighbour */
    var labX = x, labY = y - 14;
    if (x - lastX < 26 && Math.abs(labY - lastLabY) < 17) {
      labX = x + 10;
      labY = labY >= lastLabY ? lastLabY + 20 : lastLabY - 20;
    }
    lastX = x;
    lastLabY = labY;

    var g = el('g', {
      class: 'tl-mark' + (ev.entry ? ' is-entry' : ev.exit ? ' is-exit' : (ev.pct < 0 ? ' is-down' : ' is-up')),
      tabindex: '0', role: 'button',
      'aria-label': fmtDate(ev.d) + ', ' + ev.t + ', ' + fmtPct(ev.pct)
    });
    g.dataset.n = n;

    g.appendChild(el('line', { x1: x, x2: x, y1: y, y2: H - PB, class: 'tl-stem' }));
    g.appendChild(el('circle', { cx: x, cy: y, r: 11, class: 'tl-hit' }));
    g.appendChild(el('circle', { cx: x, cy: y, r: ev.entry ? 5.5 : 4, class: 'tl-dot' }));

    var lab = el('text', { x: labX, y: labY, class: 'tl-n' });
    lab.textContent = ev.entry ? '◆' : (n + 1);
    g.appendChild(lab);

    svg.appendChild(g);
  });

  /* ---------------------------------------------------------
     Index of events beneath the chart
     --------------------------------------------------------- */

  var list = document.querySelector('#tl-index');

  EVENTS.forEach(function (ev, n) {
    var b = document.createElement('button');
    b.className = 'tl-item' + (ev.entry ? ' is-entry' : ev.exit ? ' is-exit' : (ev.pct < 0 ? ' is-down' : ' is-up'));
    b.type = 'button';
    b.dataset.n = n;
    b.innerHTML =
      '<span class="tl-item__n">' + (ev.entry ? '&#9670;' : (n + 1)) + '</span>' +
      '<span class="tl-item__d">' + fmtShort(ev.d) + '</span>' +
      '<span class="tl-item__t">' + ev.t + '</span>' +
      '<span class="tl-item__p">' +
        (ev.entry ? '$' + ev.px.toFixed(PXDP) : fmtPct(ev.pct)) + '</span>';
    list.appendChild(b);
  });

  if (EXIT) {
    var xb = document.createElement('button');
    xb.className = 'tl-item is-exitrow';
    xb.type = 'button';
    xb.dataset.exit = '1';
    xb.innerHTML =
      '<span class="tl-item__n">&#9670;</span>' +
      '<span class="tl-item__d">' + (CFG.exitRowDate || 'Aug 20&ndash;28') + '</span>' +
      '<span class="tl-item__t">' + (CFG.exitRowTitle || 'Our Exit, averaged') + '</span>' +
      '<span class="tl-item__p">$' + EXIT.avg.toFixed(PXDP) + '</span>';
    list.appendChild(xb);
  }

  /* ---------------------------------------------------------
     Close-up: the move, drawn
     --------------------------------------------------------- */

  var modal   = document.querySelector('#tl-modal');
  var mDate   = modal.querySelector('[data-m="date"]');
  var mTitle  = modal.querySelector('[data-m="title"]');
  var mBody   = modal.querySelector('[data-m="body"]');
  var mSvg    = modal.querySelector('[data-m="chart"]');
  var mPct    = modal.querySelector('[data-m="pct"]');
  var mPx     = modal.querySelector('[data-m="px"]');
  var mVol    = modal.querySelector('[data-m="vol"]');
  var mVolK   = modal.querySelector('[data-m="volkey"]');
  var mPctK   = modal.querySelector('[data-m="pctkey"]');
  var mPxK    = modal.querySelector('[data-m="pxkey"]');
  var lastFocus = null;
  var timers = [];

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  var CW = 900, CH = 320, cPL = 54, cPR = 20, cPT = 26, cPB = 40;

  function drawCloseUp(ev) {
    while (mSvg.firstChild) mSvg.removeChild(mSvg.firstChild);
    mSvg.setAttribute('viewBox', '0 0 ' + CW + ' ' + CH);

    var i = DATA.findIndex(function (r) { return r.d === ev.d; });
    var a = Math.max(0, i - 14);
    var b = Math.min(DATA.length - 1, i + 7);
    var win = DATA.slice(a, b + 1);
    var k = i - a;                       /* index of the event day inside the window */

    var wlo = Math.min.apply(null, win.map(function (r) { return r.l; }));
    var whi = Math.max.apply(null, win.map(function (r) { return r.h; }));
    var wp  = (whi - wlo) * 0.14;
    wlo -= wp; whi += wp;

    var cx = function (n) { return cPL + (n / (win.length - 1)) * (CW - cPL - cPR); };
    var cy = function (p) { return cPT + (1 - (p - wlo) / (whi - wlo)) * (CH - cPT - cPB); };

    /* price axis */
    [wlo + (whi - wlo) * 0.08, (wlo + whi) / 2, whi - (whi - wlo) * 0.08].forEach(function (p) {
      mSvg.appendChild(el('line', { x1: cPL, x2: CW - cPR, y1: cy(p), y2: cy(p), class: 'cu-grid' }));
      var t = el('text', { x: cPL - 12, y: cy(p) + 4, class: 'cu-axis' });
      t.textContent = '$' + p.toFixed(2);
      mSvg.appendChild(t);
    });

    /* the event session, shaded */
    mSvg.appendChild(el('rect', {
      x: cx(k - 1), y: cPT, width: Math.max(2, cx(k) - cx(k - 1)), height: CH - cPT - cPB, class: 'cu-band'
    }));
    mSvg.appendChild(el('line', { x1: cx(k), x2: cx(k), y1: cPT, y2: CH - cPB, class: 'cu-event' }));

    var evLab = el('text', { x: cx(k) + 8, y: cPT + 14, class: 'cu-evlabel' });
    evLab.textContent = fmtShort(ev.d);
    mSvg.appendChild(evLab);

    /* date ends */
    var d0 = el('text', { x: cPL, y: CH - cPB + 22, class: 'cu-axis cu-axis--x' });
    d0.textContent = fmtShort(win[0].d);
    mSvg.appendChild(d0);
    var d1 = el('text', { x: CW - cPR, y: CH - cPB + 22, class: 'cu-axis cu-axis--x cu-axis--end' });
    d1.textContent = fmtShort(win[win.length - 1].d);
    mSvg.appendChild(d1);

    /* the line */
    var dd = win.map(function (r, n) { return (n ? 'L' : 'M') + cx(n).toFixed(2) + ' ' + cy(r.c).toFixed(2); }).join(' ');
    mSvg.appendChild(el('path', {
      d: dd + ' L' + cx(win.length - 1) + ' ' + (CH - cPB) + ' L' + cx(0) + ' ' + (CH - cPB) + ' Z',
      class: 'cu-fill'
    }));

    var path = el('path', { d: dd, class: 'cu-line' });
    mSvg.appendChild(path);

    var head = el('circle', { cx: cx(0), cy: cy(win[0].c), r: 4.5, class: 'cu-head' });
    mSvg.appendChild(head);

    function land() {
      if (ev.entry) {
        mPct.textContent = '$' + ev.px.toFixed(PXDP);
        mPct.className = 'cu-figure__v';
      } else {
        mPct.textContent = fmtPct(ev.pct);
        mPct.className = 'cu-figure__v ' + (ev.pct >= 0 ? 'is-up' : 'is-down');
      }
      /* the 52-week high is the print that made it one, not where it settled */
      mPx.textContent = '$' + (ev.showHigh ? ev.high : ev.close).toFixed(2);
    }

    function finish() {
      path.style.strokeDashoffset = 0;
      head.setAttribute('cx', cx(win.length - 1));
      head.setAttribute('cy', cy(win[win.length - 1].c));
      land();
    }

    /* a hidden tab freezes rAF and clamps timers, so draw nothing and show the result */
    if (reduced || document.hidden) {
      finish();
      return;
    }

    /* draw it: the line travels, the head follows, the readout climbs with it */
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;

    var DUR = 2200;
    var t0 = null;
    var startPx = win[0].c;

    function tick(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / DUR, 1);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   /* easeInOutQuad */

      path.style.strokeDashoffset = len * (1 - e);

      var pt = path.getPointAtLength(len * e);
      head.setAttribute('cx', pt.x);
      head.setAttribute('cy', pt.y);

      /* the readout tracks the session the head is currently over */
      var n = Math.min(win.length - 1, Math.round(e * (win.length - 1)));
      var px = win[n].c;
      mPx.textContent = '$' + px.toFixed(2);
      if (ev.entry) {
        mPct.textContent = '$' + ev.px.toFixed(PXDP);
        mPct.className = 'cu-figure__v';
      } else {
        mPct.textContent = fmtPct((px / startPx - 1) * 100);
        mPct.className = 'cu-figure__v ' + (px >= startPx ? 'is-up' : 'is-down');
      }

      if (p < 1) requestAnimationFrame(tick);
      else land();
    }
    requestAnimationFrame(tick);

    /* if the tab is hidden mid-draw, land it rather than leaving a half-drawn line */
    function onHide() { if (document.hidden) finish(); }
    document.addEventListener('visibilitychange', onHide);
    timers.push(setTimeout(function () {
      document.removeEventListener('visibilitychange', onHide);
      if (parseFloat(path.style.strokeDashoffset) > 1) finish();
    }, DUR + 400));
  }

  function drawExit() {
    var EX = EXIT;
    while (mSvg.firstChild) mSvg.removeChild(mSvg.firstChild);
    mSvg.setAttribute('viewBox', '0 0 ' + CW + ' ' + CH);

    var i = DATA.findIndex(function (r) { return r.d === EX.from; });
    var a = Math.max(0, i - 10);
    var win = DATA.slice(a);
    var k = i - a;

    var wlo = Math.min.apply(null, win.map(function (r) { return r.l; }).concat([EX.lo]));
    var whi = Math.max.apply(null, win.map(function (r) { return r.h; }).concat([EX.hi]));
    var wp  = (whi - wlo) * 0.16;
    wlo -= wp; whi += wp;

    var cx = function (n) { return cPL + (n / (win.length - 1)) * (CW - cPL - cPR); };
    var cy = function (p) { return cPT + (1 - (p - wlo) / (whi - wlo)) * (CH - cPT - cPB); };

    [wlo + (whi - wlo) * 0.08, (wlo + whi) / 2, whi - (whi - wlo) * 0.08].forEach(function (p) {
      mSvg.appendChild(el('line', { x1: cPL, x2: CW - cPR, y1: cy(p), y2: cy(p), class: 'cu-grid' }));
      var tx = el('text', { x: cPL - 12, y: cy(p) + 4, class: 'cu-axis' });
      tx.textContent = '$' + p.toFixed(2);
      mSvg.appendChild(tx);
    });

    /* the band we sold through */
    mSvg.appendChild(el('rect', {
      x: cx(k), y: cy(EX.hi), width: (CW - cPR) - cx(k),
      height: Math.max(2, cy(EX.lo) - cy(EX.hi)), class: 'cu-goldband'
    }));

    /* the line, navy up to the exit and gold through it */
    var head0 = win.slice(0, k + 1);
    var dh = head0.map(function (r, n) { return (n ? 'L' : 'M') + cx(n).toFixed(2) + ' ' + cy(r.c).toFixed(2); }).join(' ');
    mSvg.appendChild(el('path', { d: dh, class: 'cu-line' }));

    var tail = win.slice(k);
    var dt = tail.map(function (r, n) { return (n ? 'L' : 'M') + cx(k + n).toFixed(2) + ' ' + cy(r.c).toFixed(2); }).join(' ');
    var gpath = el('path', { d: dt, class: 'cu-line cu-line--gold' });
    mSvg.appendChild(gpath);

    /* the average, drawn last so it sits on top */
    var avgY = cy(EX.avg);
    var avg = el('line', { x1: cPL, x2: CW - cPR, y1: avgY, y2: avgY, class: 'cu-avg' });
    mSvg.appendChild(avg);
    var al = el('text', { x: cPL + 8, y: avgY - 9, class: 'cu-avglabel' });
    al.textContent = 'AVERAGE EXIT $' + EX.avg.toFixed(PXDP);
    mSvg.appendChild(al);

    var d0 = el('text', { x: cPL, y: CH - cPB + 22, class: 'cu-axis cu-axis--x' });
    d0.textContent = fmtShort(win[0].d);
    mSvg.appendChild(d0);
    var d1 = el('text', { x: CW - cPR, y: CH - cPB + 22, class: 'cu-axis cu-axis--x cu-axis--end' });
    d1.textContent = fmtShort(win[win.length - 1].d);
    mSvg.appendChild(d1);

    if (reduced || document.hidden) return;

    var len = gpath.getTotalLength();
    gpath.style.strokeDasharray = len;
    gpath.style.strokeDashoffset = len;
    avg.style.opacity = 0; al.style.opacity = 0;
    timers.push(setTimeout(function () {
      gpath.style.transition = 'stroke-dashoffset 1500ms cubic-bezier(.4,0,.2,1)';
      gpath.style.strokeDashoffset = 0;
    }, 60));
    timers.push(setTimeout(function () {
      avg.style.transition = 'opacity 600ms ease'; avg.style.opacity = 1;
      al.style.transition  = 'opacity 600ms ease'; al.style.opacity = 1;
    }, 900));
  }

  function openExit() {
    var EX = EXIT;
    clearTimers();
    lastFocus = document.activeElement;

    mDate.textContent  = 'August 20 to August 28, 2026';
    mTitle.textContent = EX.t;
    mBody.textContent  = EX.b;

    mPctK.textContent = 'Average exit';
    mPct.textContent  = '$' + EX.avg.toFixed(2);
    mPct.className    = 'cu-figure__v';
    mPxK.textContent  = 'Sold between';
    mPx.textContent   = '$' + EX.hi.toFixed(2) + ' \u2013 $' + EX.lo.toFixed(2);
    mVol.textContent  = '';
    mVolK.textContent = '';

    modal.classList.add('is-open');
    modal.classList.add('is-exit');
    modal.classList.remove('is-entry');
    document.body.classList.add('is-locked');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('.cu__close').focus();

    drawExit();
  }

  function open(n) {
    var ev = EVENTS[n];
    if (!ev) return;
    clearTimers();
    lastFocus = document.activeElement;

    mDate.textContent  = fmtDate(ev.d);
    mTitle.textContent = ev.t;
    mBody.textContent  = ev.b;
    mVol.textContent   = (ev.vol / 1e6).toFixed(1) + 'm shares';
    mVolK.textContent  = 'Volume';
    modal.classList.remove('is-exit');
    mPctK.textContent  = ev.entry ? 'Our fill' : 'Change on the day';
    mPxK.textContent   = ev.entry ? 'Session close'
                       : ev.showHigh ? 'Session high' : 'New price';
    modal.classList.toggle('is-entry', !!ev.entry);

    modal.classList.add('is-open');
    document.body.classList.add('is-locked');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('.cu__close').focus();

    drawCloseUp(ev);
  }

  function close() {
    clearTimers();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (lastFocus) lastFocus.focus();
  }

  /* wiring */
  function bind(root) {
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-exit]')) return openExit();
      var t = e.target.closest('[data-n]');
      if (t) open(+t.dataset.n);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('[data-exit]')) { e.preventDefault(); return openExit(); }
      var t = e.target.closest('[data-n]');
      if (!t) return;
      e.preventDefault();
      open(+t.dataset.n);
    });
  }
  bind(svg);
  bind(list);

  /* hovering the index highlights the dot, and the other way round */
  function link(n, on) {
    var dot  = svg.querySelector('[data-n="' + n + '"]');
    var item = list.querySelector('[data-n="' + n + '"]');
    if (dot)  dot.classList.toggle('is-lit', on);
    if (item) item.classList.toggle('is-lit', on);
  }
  [svg, list].forEach(function (root) {
    root.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-n]'); if (t) link(t.dataset.n, true);
    });
    root.addEventListener('mouseout', function (e) {
      var t = e.target.closest('[data-n]'); if (t) link(t.dataset.n, false);
    });
  });

  modal.querySelector('.cu__close').addEventListener('click', close);
  modal.querySelector('.cu__scrim').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
})();
