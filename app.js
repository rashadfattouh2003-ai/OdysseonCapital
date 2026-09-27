/* Odysseon Capital — report interactions */

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* our own tween — a native smooth scroll gets cancelled by any stray input */
  function glideTo(to, duration) {
    var from = window.scrollY;
    var dist = to - from;
    var t0 = null;

    function ease(t) {                       // easeInOutCubic
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / duration, 1);
      window.scrollTo(0, from + dist * ease(p));
      if (p < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  var hero   = document.querySelector('.hero');
  var sweep  = document.querySelector('.sweep');
  var enter  = document.querySelector('[data-enter]');
  /* follow whatever the button points at, so this works on any page */
  var target = enter ? document.querySelector(enter.getAttribute('href') || '#introduction') : null;

  /* --- hero → report transition --- */
  if (enter && target) {
    enter.addEventListener('click', function (e) {
      e.preventDefault();

      if (reduced) {
        target.scrollIntoView();
        return;
      }

      sweep.classList.remove('is-running');
      void sweep.offsetWidth;          // restart the animation
      sweep.classList.add('is-running');
      hero.classList.add('is-exiting');

      setTimeout(function () {
        var to = target.getBoundingClientRect().top + window.scrollY;
        glideTo(to, 1000);

        /* safety net: if the tween is throttled (background tab, etc.), land anyway */
        setTimeout(function () {
          if (Math.abs(window.scrollY - to) > 8) window.scrollTo(0, to);
        }, 1300);
      }, 380);

      setTimeout(function () {
        hero.classList.remove('is-exiting');
        sweep.classList.remove('is-running');
      }, 1900);
    });
  }

  /* --- reveal on scroll --- */
  var items = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transitionDelay = (el.dataset.delay || 0) + 'ms';
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* --- swap hero chrome for the reading bar --- */
  var railbar = document.querySelector('.railbar');

  function onScroll() {
    var past = window.scrollY > window.innerHeight * 0.62;
    document.body.classList.toggle('is-reading', past);
    if (railbar) railbar.classList.toggle('is-visible', past);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
