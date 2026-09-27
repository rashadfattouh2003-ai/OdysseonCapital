/* Odysseon Capital — b-roll running inside the pill of the wordmark.

   Two layers crossfade. The incoming layer fades up OVER the outgoing one
   rather than both fading at once, so there is no luminance dip mid-cut,
   and the fade only starts once the incoming layer actually has frames. */

(function () {
  var pill = document.querySelector('.logo-pill');
  if (!pill) return;

  var CLIPS = Array.from({ length: 26 }, function (_, i) {
    return 'assets/broll/clip_' + String(i + 1).padStart(2, '0') + '.mp4';
  });

  var FADE  = 1100;   /* crossfade, matched to the CSS transition */
  var TAIL  = 250;    /* land the fade this far before the clip runs out */
  var MIN_HOLD = 1400;

  function Layer(el) {
    this.el = el;
    this.bg = el.querySelector('.logo-pill__bg');
    this.fg = el.querySelector('.logo-pill__fg');
  }

  Layer.prototype.load = function (src) {
    [this.bg, this.fg].forEach(function (v) {
      v.src = src;
      v.currentTime = 0;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
  };

  Layer.prototype.play = function () {
    [this.bg, this.fg].forEach(function (v) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
  };

  Layer.prototype.pause = function () {
    this.bg.pause(); this.fg.pause();
  };

  /* resolve once the layer has enough buffered to show a moving frame */
  Layer.prototype.ready = function (cb) {
    var v = this.fg;
    if (v.readyState >= 3) return cb();
    var done = false;
    function go() { if (done) return; done = true; v.removeEventListener('canplay', go); cb(); }
    v.addEventListener('canplay', go);
    setTimeout(go, 1200);          /* never stall the sequence on a slow clip */
  };

  var a = new Layer(pill.querySelector('[data-layer="a"]'));
  var b = new Layer(pill.querySelector('[data-layer="b"]'));
  var front = a, back = b;
  var i = Math.floor(Math.random() * CLIPS.length);
  var timer = null;

  front.el.style.opacity = 1;
  front.el.style.zIndex = 2;
  back.el.style.opacity = 0;
  back.el.style.zIndex = 1;
  front.load(CLIPS[i]);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    front.pause();
    return;
  }

  /* Hold a clip for as long as it can play cleanly, then cut before it ends.
     Measured from where the clip actually is, not from zero: the incoming
     layer starts at the top of the fade, so by the time it takes over it is
     already FADE into itself. Timing from zero would let that error compound
     until the cut landed past the end of the clip again. */
  function schedule() {
    var d = front.fg.duration;
    if (!d || !isFinite(d)) d = 4;
    var left = (d - (front.fg.currentTime || 0)) * 1000;
    var hold = Math.max(MIN_HOLD, left - FADE - TAIL);
    clearTimeout(timer);
    timer = setTimeout(advance, hold);
  }

  function advance() {
    i = (i + 1) % CLIPS.length;
    back.load(CLIPS[i]);

    back.ready(function () {
      /* the incoming layer rises on top; the outgoing one is never dimmed
         while still visible, so the cut holds its brightness throughout */
      back.el.style.zIndex = 3;
      front.el.style.zIndex = 2;
      back.el.style.opacity = 1;

      setTimeout(function () {
        front.el.style.opacity = 0;
        front.el.style.zIndex = 1;
        var t = front; front = back; back = t;
        schedule();
      }, FADE);
    });
  }

  if (front.fg.readyState >= 1) schedule();
  else front.fg.addEventListener('loadedmetadata', schedule, { once: true });

  /* a hidden tab clamps timers and freezes decoding, which would strand a
     half-finished crossfade; park it and pick the sequence back up on return */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimeout(timer);
      front.pause(); back.pause();
    } else {
      front.play();
      schedule();
    }
  });
})();
