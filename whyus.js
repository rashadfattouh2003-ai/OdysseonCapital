/* Odysseon Capital — Why Us
   The versus switcher, the live weighted scorecard and the positioning map.
   Every figure here is the same one that sat in the written analysis; this
   file only changes how it is read. */

(function () {

  /* ------------------------------------------------------------------
     1. Head to head
     ------------------------------------------------------------------ */

  var RIVALS = [
    {
      id: 'bank',
      chip: 'Private bank',
      name: 'Private bank',
      note: 'A discretionary portfolio and a quarterly statement',
      rows: [
        ['Every position published', 'Yes, at close',        'No',                         'us'],
        ['Reasoning disclosed',      'In full',              'No',                         'us'],
        ['Exit set before entry',    'Always',               'No',                         'us'],
        ['Rules-based execution',    'Yes',                  'Partly',                     'us'],
        ['Return ambition',          'High',                 'Moderate',                   'us'],
        ['Cost in a flat year',      '1 per cent',           'Full fee, not published',    'tie'],
        ['Track record',             'Two closed positions', 'Decades',                    'them'],
        ['Breadth of relationship',  'None',                 'Credit, deposits, estate',   'them']
      ]
    },
    {
      id: 'robo',
      chip: 'Sarwa',
      name: 'Sarwa',
      note: 'Automated index portfolios, 0.40 to 0.85 per cent',
      rows: [
        ['Every position published', 'Yes, at close',        'No',              'us'],
        ['Reasoning disclosed',      'In full',              'Not applicable',  'us'],
        ['Exit set before entry',    'Always',               'Not applicable',  'us'],
        ['Rules-based execution',    'Yes',                  'Yes',             'tie'],
        ['Return ambition',          'High',                 'Market',          'us'],
        ['Cost in a flat year',      '1 per cent',           '0.40 to 0.85',    'them'],
        ['Track record',             'Two closed positions', 'Since 2017',      'them'],
        ['Breadth of relationship',  'None',                 'Narrow',          'tie']
      ]
    },
    {
      id: 'self',
      chip: 'Doing it yourself',
      name: 'Your own account',
      note: 'A brokerage account and your own judgment',
      rows: [
        ['Every position published', 'Yes, at close',        'Self-kept, if at all', 'us'],
        ['Reasoning disclosed',      'In full',              'Not applicable',       'us'],
        ['Exit set before entry',    'Always',               'Rarely',               'us'],
        ['Rules-based execution',    'Yes',                  'No',                   'us'],
        ['Return ambition',          'High',                 'Variable',             'us'],
        ['Cost in a flat year',      '1 per cent',           'Commission only',      'them'],
        ['Track record',             'Two closed positions', 'Your own',             'tie'],
        ['Breadth of relationship',  'None',                 'None',                 'tie']
      ]
    }
  ];

  var vs = document.getElementById('vs');

  if (vs) {
    var chips = vs.querySelector('.vs__chips');
    var rName = vs.querySelector('[data-vs="name"]');
    var rNote = vs.querySelector('[data-vs="note"]');
    var tally = vs.querySelector('[data-vs="tally"]');
    var body  = vs.querySelector('.vs__rows');

    RIVALS.forEach(function (r, i) {
      var b = document.createElement('button');
      b.className = 'vs__chip' + (i === 0 ? ' is-on' : '');
      b.type = 'button';
      b.dataset.id = r.id;
      b.textContent = r.chip;
      chips.appendChild(b);
    });

    function paint(rival) {
      rName.textContent = rival.name;
      rNote.textContent = rival.note;

      var wins = rival.rows.filter(function (r) { return r[3] === 'us'; }).length;
      tally.innerHTML = wins + ' / ' + rival.rows.length + '<span>Rows we win</span>';

      body.innerHTML = '';
      rival.rows.forEach(function (row, i) {
        var el = document.createElement('div');
        el.className = 'vs__r';
        el.dataset.w = row[3];
        el.innerHTML =
          '<p class="vs__val vs__val--l">' + row[1] + '</p>' +
          '<p class="vs__k">' + row[0] + '</p>' +
          '<p class="vs__val vs__val--r">' + row[2] + '</p>';
        body.appendChild(el);
        setTimeout(function () { el.classList.add('is-in'); }, 40 + i * 45);
      });
    }

    chips.addEventListener('click', function (e) {
      var b = e.target.closest('.vs__chip');
      if (!b) return;
      chips.querySelectorAll('.vs__chip').forEach(function (c) { c.classList.remove('is-on'); });
      b.classList.add('is-on');
      paint(RIVALS.filter(function (r) { return r.id === b.dataset.id; })[0]);
    });

    paint(RIVALS[0]);
  }

  /* ------------------------------------------------------------------
     2. The scorecard, with track record weight on a slider

     Base weights were 30 on track record and 70 across the other five.
     Moving the slider redistributes the remainder across those five in
     their original proportions, so only the one factor changes.
     ------------------------------------------------------------------ */

  var FACTORS = [
    { k: 'track',  base: 30 },
    { k: 'ret',    base: 25 },
    { k: 'trans',  base: 15 },
    { k: 'price',  base: 10 },
    { k: 'proc',   base: 10 },
    { k: 'dist',   base: 10 }
  ];

  var PLAYERS = [
    { n: 'Odysseon',      ours: true,  s: [1, 5, 5, 3, 5, 1] },
    { n: 'Private bank',  ours: false, s: [5, 3, 2, 2, 4, 5] },
    { n: 'Sarwa',         ours: false, s: [4, 2, 4, 4, 5, 4] },
    { n: 'Doing it yourself', ours: false, s: [3, 3, 5, 5, 2, 3] }
  ];

  var score = document.getElementById('score');

  if (score) {
    var range = score.querySelector('.score__range');
    var wOut  = score.querySelector('[data-s="w"]');
    var bars  = score.querySelector('[data-s="bars"]');
    var read  = score.querySelector('[data-s="read"]');

    PLAYERS.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'bar' + (p.ours ? ' is-ours' : '');
      d.innerHTML =
        '<span class="bar__n">' + p.n + '</span>' +
        '<span class="bar__track"><span class="bar__fill"></span></span>' +
        '<span class="bar__v"></span>';
      bars.appendChild(d);
      p.el = d;
    });

    function weightsFor(w) {
      var restBase = 70;                       // the other five, as first set
      var scale = (100 - w) / restBase;
      return FACTORS.map(function (f, i) { return i === 0 ? w : f.base * scale; });
    }

    function render() {
      var w = +range.value;
      var ws = weightsFor(w);
      wOut.textContent = w + '%';

      var totals = PLAYERS.map(function (p) {
        var t = 0;
        for (var i = 0; i < ws.length; i++) t += ws[i] / 100 * p.s[i];
        return t;
      });

      var best = Math.max.apply(null, totals);

      PLAYERS.forEach(function (p, i) {
        p.el.querySelector('.bar__fill').style.width = (totals[i] / 5 * 100).toFixed(1) + '%';
        p.el.querySelector('.bar__v').textContent = totals[i].toFixed(2);
      });

      var usTotal = totals[0];
      var leaderIdx = totals.indexOf(best);

      if (leaderIdx === 0) {
        read.innerHTML = 'At a track record weight of <b>' + w + ' per cent</b> we score ' +
          '<b>' + usTotal.toFixed(2) + '</b> and lead the board. ' +
          'That is the allocator this desk is built for: one who will read the trades instead of ' +
          'counting the years.';
      } else {
        read.innerHTML = 'At a track record weight of <b>' + w + ' per cent</b> we score ' +
          '<b>' + usTotal.toFixed(2) + '</b> against ' + PLAYERS[leaderIdx].n + ' on ' +
          best.toFixed(2) + '. Weight history heavily enough and a desk with two closed positions ' +
          'cannot win, whatever it charges. Drag the weight down to find the point where it can.';
      }
    }

    range.addEventListener('input', render);
    render();
  }

  /* ------------------------------------------------------------------
     3. Positioning map, with a card on hover
     ------------------------------------------------------------------ */

  var map = document.getElementById('pos-svg');

  if (map) {
    var card = map.querySelector('.pos-card');
    var cRect = card.querySelector('rect');
    var cK = card.querySelector('.pos-card__k');
    var cV = card.querySelector('.pos-card__v');

    map.querySelectorAll('.pos-node').forEach(function (g) {
      function on() {
        var x = +g.dataset.x, y = +g.dataset.y;
        var flip = x > 620;
        var w = 250;
        cRect.setAttribute('width', w);
        card.setAttribute('transform', 'translate(' + (flip ? x - w - 18 : x + 18) + ',' + (y - 52) + ')');
        cK.textContent = g.dataset.name;
        cV.textContent = g.dataset.note;
        card.classList.add('is-on');
      }
      function off() { card.classList.remove('is-on'); }
      g.addEventListener('mouseenter', on);
      g.addEventListener('mouseleave', off);
      g.addEventListener('focus', on);
      g.addEventListener('blur', off);
    });
  }

})();
