/* Odysseon Capital — the algorithm's 2025 backtest, rendered from the curves
   traced out of the strategy tester chart in the trading strategy deck. */

(function () {
  var A = window.ALGO;
  var svg = document.querySelector('#algo-svg');
  var legend = document.querySelector('#algo-legend');
  if (!A || !svg || !legend) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var KEYS = ['algo', 'spx'];

  var META = {
    algo: { name: 'Odysseon algorithm', tag: 'V2', note: 'Multi-timeframe squeeze breakout, spot only' },
    spx:  { name: 'S&P 500',            tag: 'HOLD', note: 'The same year, bought and held' }
  };

  var W = 1000, H = 440, PL = 62, PR = 26, PT = 26, PB = 42;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  function el(n, a) {
    var e = document.createElementNS(NS, n);
    for (var k in a) e.setAttribute(k, a[k]);
    return e;
  }

  function fmtPct(v) { return (v > 0 ? '+' : '') + v.toFixed(2) + '%'; }

  function fmtDate(iso) {
    var m = ['January','February','March','April','May','June',
             'July','August','September','October','November','December'];
    var p = iso.split('-');
    return (+p[2]) + ' ' + m[+p[1] - 1];
  }

  var dates = A.dates, N = dates.length;

  var lo = Infinity, hi = -Infinity;
  KEYS.forEach(function (k) {
    A[k].forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
  });
  var pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;

  function X(i) { return PL + (i / (N - 1)) * (W - PL - PR); }
  function Y(v) { return PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB); }

  for (var g = Math.ceil(lo / 10) * 10; g <= hi; g += 10) {
    var zero = Math.abs(g) < 0.001;
    svg.appendChild(el('line', { x1: PL, x2: W - PR, y1: Y(g), y2: Y(g), class: zero ? 'bn-zero' : 'bn-grid' }));
    var t = el('text', { x: PL - 12, y: Y(g) + 4, class: 'bn-axis' });
    t.textContent = (g > 0 ? '+' : '') + g + '%';
    svg.appendChild(t);
  }

  var names = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
                '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };
  var seen = {};
  dates.forEach(function (d, i) {
    var mo = d.slice(5, 7);
    if (seen[mo]) return;
    seen[mo] = true;
    if (i > 0) svg.appendChild(el('line', { x1: X(i), x2: X(i), y1: PT, y2: H - PB, class: 'bn-grid' }));
    var t = el('text', { x: X(i) + 5, y: H - PB + 22, class: 'bn-month' });
    t.textContent = names[mo];
    svg.appendChild(t);
  });

  var paths = {}, dots = {};

  KEYS.forEach(function (k) {
    var d = A[k].map(function (v, i) {
      return (i ? 'L' : 'M') + X(i).toFixed(2) + ' ' + Y(v).toFixed(2);
    }).join(' ');
    if (k === 'algo') {
      svg.appendChild(el('path', {
        d: d + ' L' + X(N - 1) + ' ' + Y(0) + ' L' + X(0) + ' ' + Y(0) + ' Z',
        class: 'ag-fill'
      }));
    }
    var p = el('path', { d: d, class: 'ag-line ag-line--' + k });
    svg.appendChild(p);
    paths[k] = p;
  });

  var cross = el('line', { x1: 0, x2: 0, y1: PT, y2: H - PB, class: 'bn-cross' });
  cross.style.opacity = 0;
  svg.appendChild(cross);

  KEYS.forEach(function (k) {
    var c = el('circle', { r: 4.5, class: 'ag-dot ag-dot--' + k });
    c.style.opacity = 0;
    svg.appendChild(c);
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
          paths[k].style.transition = 'stroke-dashoffset 1700ms cubic-bezier(.4,0,.2,1) ' + (n * 160) + 'ms';
          paths[k].style.strokeDashoffset = 0;
        });
      });
    }, { threshold: 0.2 }).observe(svg);
  }

  var vals = {};
  KEYS.forEach(function (k) {
    var m = META[k];
    var row = document.createElement('div');
    row.className = 'bn-row ag-row--' + k;
    row.innerHTML =
      '<span class="bn-swatch"></span>' +
      '<span class="bn-name">' + m.name + '</span>' +
      '<span class="bn-ticker">' + m.tag + '</span>' +
      '<span class="bn-note">' + m.note + '</span>' +
      '<span class="bn-val">' + fmtPct(A[k][N - 1]) + '</span>';
    legend.appendChild(row);
    vals[k] = row.querySelector('.bn-val');
  });

  var dateOut = document.querySelector('[data-a="date"]');

  function readAt(i) {
    KEYS.forEach(function (k) {
      var v = A[k][i];
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
      vals[k].textContent = fmtPct(A[k][N - 1]);
      dots[k].style.opacity = 0;
    });
    cross.style.opacity = 0;
    dateOut.textContent = A.meta.window;
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
})();
