/* Odysseon Capital — the realistic scenario carried forward five years.
   $148,706 compounding at 35% a year. Every year mark is hoverable and
   focusable; the figures under the chart are the five-year totals. */

(function () {
  var host = document.querySelector('#cmp-svg');
  if (!host) return;

  var P = 148706, RATE = 0.35, YEARS = 5;

  var pts = [];
  for (var y = 0; y <= YEARS; y++) {
    var bal = P * Math.pow(1 + RATE, y);
    pts.push({
      y: y,
      bal: bal,
      gain: y === 0 ? 0 : bal - P * Math.pow(1 + RATE, y - 1),
      cum: (Math.pow(1 + RATE, y) - 1) * 100
    });
  }

  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 340, PL = 84, PR = 104, PT = 30, PB = 46;
  host.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  function S(t, a) {
    var e = document.createElementNS(NS, t);
    for (var k in a) e.setAttribute(k, a[k]);
    return e;
  }
  function money(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function pct(v) { return (v > 0 ? '+' : '') + v.toFixed(2) + '%'; }

  var lo = P, hi = pts[YEARS].bal;
  var pad = (hi - lo) * 0.16;
  lo -= pad * 0.5; hi += pad;

  function X(i) { return PL + (i / YEARS) * (W - PL - PR); }
  function Y(v) { return PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB); }

  /* horizontal rules on round money */
  var step = 200000;
  for (var g = Math.ceil(lo / step) * step; g <= hi; g += step) {
    host.appendChild(S('line', { x1: PL, x2: W - PR, y1: Y(g), y2: Y(g), class: 'bn-grid' }));
    var t = S('text', { x: PL - 14, y: Y(g) + 4, class: 'bn-axis' });
    t.textContent = '$' + (g / 1000) + 'k';
    host.appendChild(t);
  }

  var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.bal).toFixed(1); }).join(' ');
  host.appendChild(S('path', {
    d: d + ' L' + X(YEARS) + ' ' + (H - PB) + ' L' + X(0) + ' ' + (H - PB) + ' Z', class: 'cmp-fill'
  }));
  var line = S('path', { d: d, class: 'cmp-line' });
  host.appendChild(line);

  /* the closing value, called out at the end of the curve */
  var endTag = S('text', { x: X(YEARS) + 14, y: Y(pts[YEARS].bal) + 5, class: 'cmp-endtag' });
  endTag.textContent = money(pts[YEARS].bal);
  host.appendChild(endTag);

  var guide = S('line', { y1: PT, y2: H - PB, class: 'cmp-guide' });
  guide.style.opacity = 0;
  host.appendChild(guide);

  var readLabel = document.querySelector('[data-c="label"]');
  var REST = 'Five years from ' + money(P);

  var marks = pts.map(function (p, i) {
    var g = S('g', {
      class: 'cmp-mark', tabindex: '0', role: 'button',
      'aria-label': 'Year ' + p.y + ', ' + money(p.bal) + ', ' + pct(p.cum) + ' cumulative'
    });
    g.appendChild(S('circle', { cx: X(i), cy: Y(p.bal), r: 16, class: 'cmp-hit' }));
    g.appendChild(S('circle', { cx: X(i), cy: Y(p.bal), r: 4.5, class: 'cmp-dot' }));
    host.appendChild(g);

    var lab = S('text', { x: X(i), y: H - PB + 24, class: 'cmp-year' });
    lab.textContent = p.y === 0 ? 'NOW' : 'YR ' + p.y;
    host.appendChild(lab);

    function on() {
      marks.forEach(function (m) { m.g.classList.remove('is-on'); });
      g.classList.add('is-on');
      guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i));
      guide.style.opacity = 1;
      readLabel.textContent = (p.y === 0 ? 'Today' : 'Year ' + p.y) + '  ' + money(p.bal) +
                              (p.y === 0 ? '' : '   ' + pct(p.cum));
    }
    function off() {
      g.classList.remove('is-on');
      guide.style.opacity = 0;
      readLabel.textContent = REST;
    }
    g.addEventListener('mouseenter', on);
    g.addEventListener('mouseleave', off);
    g.addEventListener('focus', on);
    g.addEventListener('blur', off);
    g.addEventListener('click', on);

    return { g: g, p: p };
  });

  /* draw in on first sight */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    var fired = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || fired) return;
        fired = true;
        line.style.transition = 'stroke-dashoffset 1500ms cubic-bezier(.4,0,.2,1)';
        line.style.strokeDashoffset = 0;
      });
    }, { threshold: 0.25 }).observe(host);
  }
})();
