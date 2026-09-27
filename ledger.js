/* Odysseon Capital — the mark opens the book.

   Pressing the pill in the wordmark fires two pills out of it, which fly to
   where the title sits and land there as the two positions. Done with FLIP:
   the pills are laid out in their final place first, then thrown back to the
   source pill's centre and released, so the landing is pixel-exact rather
   than a guess at coordinates. */

(function () {
  var mark  = document.querySelector('#logo-pill');
  var eject = document.querySelector('#eject');
  if (!mark || !eject) return;

  var pills = [].slice.call(eject.querySelectorAll('.eject__pill'));
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var open = false;

  function fire() {
    if (open) return;
    open = true;

    mark.classList.remove('is-live');
    mark.setAttribute('aria-expanded', 'true');

    var src = mark.getBoundingClientRect();
    var cx = src.left + src.width / 2;
    var cy = src.top + src.height / 2;

    eject.classList.add('is-open');

    if (reduced) { pills.forEach(function (p) { p.style.opacity = 1; }); return; }

    /* the mark recoils, the way something does when it lets go */
    mark.classList.add('is-firing');
    setTimeout(function () { mark.classList.remove('is-firing'); }, 260);

    pills.forEach(function (p, i) {
      var r = p.getBoundingClientRect();
      var dx = cx - (r.left + r.width / 2);
      var dy = cy - (r.top + r.height / 2);
      var tilt = i ? 16 : -16;

      p.style.transition = 'none';
      p.style.transform  = 'translate(' + dx + 'px,' + dy + 'px) scale(.16) rotate(' + tilt + 'deg)';
      p.style.opacity    = 0;
      void p.offsetWidth;                      /* commit the thrown-back state */

      var delay = i * 90;
      p.style.transition =
        'transform 780ms cubic-bezier(.2,1.3,.32,1) ' + delay + 'ms, ' +
        'opacity 200ms ease ' + delay + 'ms';
      p.style.transform = 'none';
      p.style.opacity   = 1;
    });
  }

  mark.addEventListener('click', fire);
  mark.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
  });

  /* if the viewport changes mid-flight the FLIP offsets are stale; the pills
     are already home by then, so just make sure nothing is left mid-transform */
  window.addEventListener('resize', function () {
    if (!open) return;
    pills.forEach(function (p) { p.style.transform = 'none'; });
  });
})();
