/* Odysseon Capital — year-to-date curves, benchmarks and the fund.

   The benchmarks are indexed to their own 2 January close. The fund sits flat
   until the 24 March entry and then tracks Iovance from $3.50.

   The options leverage is already baked into the fund series in benchmarks.js:
   $50,407 into $148,706 is +195.01%, against +152.29% for $3.50 to the $8.83
   average exit, so the contracts returned 1.281x the underlying's move. MULT
   here is a further display multiplier and stays at 1. */

(function () {
  var B = window.BENCH;
  var svg = document.querySelector('#bench-svg');
  var legend = document.querySelector('#bench-legend');
  if (!B || !svg || !legend) return;

  var MULT = 1;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var KEYS = ['fund', 'xbi', 'ibb', 'sp'];

  var W = 1000, H = 500, PL = 66, PR = 26, PT = 26, PB = 42;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) e.setAttribute(k, a[k]);
    return e;
  }

  /* 'ytd'     : each index from its own 2 January close, holding the shares
     'options' : the same view expressed the way ours was, as a January 2027
                 call bought on 2 January and held. Strikes are the most liquid
                 Jan-2027 strike within 2% of each fund's 2 January close;
                 values are Black-Scholes on the real closing path. */
  var mode = 'ytd';
  var ENTRY_I = B.series.fund.entryIndex;

  function pctOf(k, i) {
    if (k === 'fund') return B.series.fund.pct[i] * MULT;
    var s = B.series[k];
    return (mode === 'options' && s.optPct) ? s.optPct[i] : s.pct[i];
  }

  function fmtPct(v) { return (v > 0 ? '+' : '') + v.toFixed(2) + '%'; }

  function fmtDate(iso) {
    var m = ['January','February','March','April','May','June',
             'July','August','September','October','November','December'];
    var p = iso.split('-');
    return (+p[2]) + ' ' + m[+p[1] - 1];
  }

  var dates = B.dates, N = dates.length;
  var visible = KEYS.slice();

  /* layers, so a rescale can redraw the axis without touching the lines */
  var gGrid = el('g', {}), gLine = el('g', {}), gTop = el('g', {});
  svg.appendChild(gGrid); svg.appendChild(gLine); svg.appendChild(gTop);

  var lo, hi;

  function scale() {
    lo = Infinity; hi = -Infinity;
    visible.forEach(function (k) {
      B.series[k].pct.forEach(function (_, i) {
        var v = pctOf(k, i);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      });
    });
    var pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;
  }

  function X(i) { return PL + (i / (N - 1)) * (W - PL - PR); }
  function Y(v) { return PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB); }

  function gridStep() {
    var span = hi - lo;
    var steps = [5, 10, 20, 25, 50];
    for (var i = 0; i < steps.length; i++) if (span / steps[i] <= 8) return steps[i];
    return 100;
  }

  function drawGrid() {
    while (gGrid.firstChild) gGrid.removeChild(gGrid.firstChild);

    var step = gridStep();
    for (var g = Math.ceil(lo / step) * step; g <= hi; g += step) {
      var zero = Math.abs(g) < 0.001;
      gGrid.appendChild(el('line', {
        x1: PL, x2: W - PR, y1: Y(g), y2: Y(g), class: zero ? 'bn-zero' : 'bn-grid'
      }));
      var t = el('text', { x: PL - 12, y: Y(g) + 4, class: 'bn-axis' });
      t.textContent = (g > 0 ? '+' : '') + g + '%';
      gGrid.appendChild(t);
    }

    var names = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May',
                  '06':'Jun','07':'Jul','08':'Aug' };
    var seen = {};
    dates.forEach(function (d, i) {
      var mo = d.slice(5, 7);
      if (seen[mo]) return;
      seen[mo] = true;
      if (i > 0) gGrid.appendChild(el('line', { x1: X(i), x2: X(i), y1: PT, y2: H - PB, class: 'bn-grid' }));
      var t = el('text', { x: X(i) + 6, y: H - PB + 22, class: 'bn-month' });
      t.textContent = names[mo] || mo;
      gGrid.appendChild(t);
    });

    /* the session we bought */
    gGrid.appendChild(el('line', { x1: X(ENTRY_I), x2: X(ENTRY_I), y1: PT, y2: H - PB, class: 'bn-entry' }));
    var lab = el('text', { x: X(ENTRY_I) + 7, y: PT + 13, class: 'bn-entrylabel' });
    lab.textContent = 'ENTRY';
    gGrid.appendChild(lab);
  }

  var paths = {}, dots = {};

  function pathFor(k) {
    return B.series[k].pct.map(function (_, i) {
      return (i ? 'L' : 'M') + X(i).toFixed(2) + ' ' + Y(pctOf(k, i)).toFixed(2);
    }).join(' ');
  }

  function drawLines() {
    KEYS.forEach(function (k) {
      if (!paths[k]) {
        paths[k] = el('path', { class: 'bn-line bn-line--' + k });
        gLine.appendChild(paths[k]);
      }
      paths[k].setAttribute('d', pathFor(k));
    });
  }

  scale(); drawGrid(); drawLines();

  var cross = el('line', { x1: 0, x2: 0, y1: PT, y2: H - PB, class: 'bn-cross' });
  cross.style.opacity = 0;
  gTop.appendChild(cross);

  KEYS.forEach(function (k) {
    var c = el('circle', { r: 4.5, class: 'bn-dot bn-dot--' + k });
    c.style.opacity = 0;
    gTop.appendChild(c);
    dots[k] = c;
  });

  if (!reduced) {
    KEYS.forEach(function (k) {
      var len = paths[k].getTotalLength();
      paths[k].style.strokeDasharray = len;
      paths[k].style.strokeDashoffset = len;
    });
    var fired = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || fired) return;
        fired = true;
        KEYS.forEach(function (k, n) {
          paths[k].style.transition = 'stroke-dashoffset 1600ms cubic-bezier(.4,0,.2,1) ' + (n * 130) + 'ms';
          paths[k].style.strokeDashoffset = 0;
        });
      });
    }, { threshold: 0.2 }).observe(svg);
  }

  /* ---- legend, which doubles as the readout ---- */
  var vals = {};

  KEYS.forEach(function (k) {
    var s = B.series[k];
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'bn-row bn-row--' + k;
    row.dataset.k = k;
    row.innerHTML =
      '<span class="bn-swatch"></span>' +
      '<span class="bn-name">' + s.name + '</span>' +
      '<span class="bn-ticker">' + s.ticker + '</span>' +
      '<span class="bn-note">' + s.note + '</span>' +
      '<span class="bn-val" data-v="' + k + '">' + fmtPct(pctOf(k, N - 1)) + '</span>';
    legend.appendChild(row);
    vals[k] = row.querySelector('[data-v]');
  });

  var dateOut = document.querySelector('[data-b="date"]');
  var isolated = null;

  /* isolating rescales the axis, which is the point: the fund runs to 151%
     and would otherwise flatten the three benchmarks against the floor */
  function setIsolate(k) {
    isolated = (isolated === k) ? null : k;
    visible = isolated ? [isolated] : KEYS.slice();

    KEYS.forEach(function (key) {
      var off = isolated && isolated !== key;
      paths[key].classList.toggle('is-off', !!off);
      dots[key].classList.toggle('is-off', !!off);
      legend.querySelector('.bn-row--' + key).classList.toggle('is-off', !!off);
    });

    scale(); drawGrid(); drawLines();
    KEYS.forEach(function (key) { paths[key].style.strokeDasharray = 'none'; paths[key].style.strokeDashoffset = 0; });
    clearRead();
  }

  function readAt(i) {
    KEYS.forEach(function (k) {
      var v = pctOf(k, i);
      vals[k].textContent = fmtPct(v);
      dots[k].setAttribute('cx', X(i));
      dots[k].setAttribute('cy', Y(v));
      dots[k].style.opacity = 1;
    });
    cross.setAttribute('x1', X(i));
    cross.setAttribute('x2', X(i));
    cross.style.opacity = 1;
    dateOut.textContent = fmtDate(dates[i]);
  }

  function clearRead() {
    KEYS.forEach(function (k) {
      vals[k].textContent = fmtPct(pctOf(k, N - 1));
      dots[k].style.opacity = 0;
    });
    cross.style.opacity = 0;
    dateOut.textContent = '2 January to 28 August';
  }

  function indexFromEvent(e) {
    var r = svg.getBoundingClientRect();
    var x = ((e.clientX - r.left) / r.width) * W;
    var f = (x - PL) / (W - PL - PR);
    return Math.max(0, Math.min(N - 1, Math.round(f * (N - 1))));
  }

  svg.addEventListener('pointermove', function (e) { readAt(indexFromEvent(e)); });
  svg.addEventListener('pointerleave', clearRead);
  svg.addEventListener('pointerdown', function (e) { readAt(indexFromEvent(e)); });

  legend.addEventListener('click', function (e) {
    var r = e.target.closest('[data-k]');
    if (r) setIsolate(r.dataset.k);
  });

  /* ---- basis toggle ---- */
  var titleOut = document.querySelector('[data-b="title"]');
  var modeBtns = document.querySelectorAll('.bench__mode');

  var TITLES = {
    ytd: 'Year to date return, 2026',
    options: 'The same year, bought as January 2027 calls'
  };

  var NOTES = {
    ytd: {
      sp:  'The broad market',
      xbi: 'Equal-weight biotech, where Iovance sits',
      ibb: 'Cap-weighted biotech, led by the majors'
    },
    options: {
      sp:  B.series.sp.contract,
      xbi: B.series.xbi.contract,
      ibb: B.series.ibb.contract
    }
  };

  function setMode(m) {
    if (m === mode) return;
    mode = m;

    modeBtns.forEach(function (b) { b.classList.toggle('is-on', b.dataset.mode === m); });
    titleOut.textContent = TITLES[m];

    ['sp', 'xbi', 'ibb'].forEach(function (k) {
      legend.querySelector('.bn-row--' + k + ' .bn-note').textContent = NOTES[m][k];
    });

    scale(); drawGrid(); drawLines();
    KEYS.forEach(function (k) {
      paths[k].style.strokeDasharray = 'none';
      paths[k].style.strokeDashoffset = 0;
    });
    clearRead();
  }

  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
})();
