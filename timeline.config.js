/* Odysseon Capital — pre-trade sequence, timing.
   Retime the whole piece here without touching animation code.
   Every scene duration is in seconds; the clock is frame-based at FPS. */

window.SEQ_TIMELINE = {
  fps: 60,

  scenes: [
    { id: 'regime',   dur: 2.5, label: 'VOLATILITY REGIME' },
    { id: 'squeeze',  dur: 3.0, label: 'SQUEEZE DETECTION' },
    { id: 'chain',    dur: 3.5, label: 'MOMENTUM CHAIN'    },
    { id: 'adx',      dur: 2.5, label: 'TREND STRENGTH'    },
    { id: 'ema',      dur: 2.5, label: 'DIRECTIONAL BIAS'  },
    { id: 'catalyst', dur: 3.0, label: 'CATALYST + RVOL'   },
    { id: 'flow',     dur: 3.0, label: 'OPTIONS FLOW'      },
    { id: 'ticket',   dur: 3.0, label: 'RISK-DEFINED TICKET' },
    { id: 'execute',  dur: 2.5, label: 'EXECUTE'           }
  ],

  cursor: {
    dwell: 0.20,        /* seconds of stillness before every click */
    travel: 0.55,       /* seconds to cross to a new target */
    overshoot: 0.06,    /* how far past the target before settling */
    arc: 46,            /* pixels of perpendicular bow in the path */
    jitter: 0.45        /* pixels of slow drift while dwelling; 0 pins it dead still */
  }
};
