/* Odysseon Capital — pre-trade sequence, copy.
   Every on-screen string and number lives here. All values are illustrative
   and deliberately carry no return, win rate, or performance claim. */

window.SEQ_CONTENT = {
  wordmark: 'ODYSSEON CAPITAL',
  ticker:   'VLTR',
  tickerName: 'Illustrative instrument',

  regime: {
    title: 'VOLATILITY REGIME',
    vixLabel: 'VIX',
    vixFrom: 17.4,
    vixTo:   23.8,
    verdict: 'DISPERSION REGIME: ACTIVE'
  },

  squeeze: {
    title: 'SQUEEZE',
    sub: 'BOLLINGER INSIDE KELTNER',
    verdict: 'SQUEEZE FIRED'
  },

  chain: {
    title: 'MOMENTUM CHAIN',
    frames: ['15M', '1H', '4H', '1D'],
    verdict: 'ALIGNED 4 / 4'
  },

  adx: {
    title: 'ADX',
    threshold: 25,
    adxTo: 31.4,
    verdict: 'TREND STRENGTH CONFIRMED'
  },

  ema: {
    title: 'EMA CLOUD',
    verdict: 'BIAS: LONG'
  },

  catalyst: {
    title: 'CATALYST + FLOW',
    headline: 'SECTOR READ-ACROSS, PEER PRINT',
    rvolLabel: 'RVOL',
    rvolTo: 4.2,
    verdict: 'CATALYST + RVOL CONFIRMED'
  },

  flow: {
    title: 'OPEN INTEREST',
    cols: ['STRIKE', 'OI', 'DELTA'],
    rows: [
      { k: '44.0', oi: '1,204', d: '0.61' },
      { k: '46.0', oi: '2,873', d: '0.48' },
      { k: '48.0', oi: '4,110', d: '0.33' },
      { k: '50.0', oi: '9,462', d: '0.19' },
      { k: '52.0', oi: '2,087', d: '0.12' },
      { k: '55.0', oi: '1,340', d: '0.07' }
    ],
    pick: 3,
    verdict: 'PIN LEVEL IDENTIFIED'
  },

  ticket: {
    title: 'ORDER TICKET',
    fields: [
      ['ENTRY',     '47.20'],
      ['STOP',      '44.85'],
      ['TARGET',    '54.30'],
      ['TIME EXIT', '21 SESSIONS'],
      ['SIZE',      '2.0% OF BOOK']
    ],
    rr: '1 : 3.02',
    rrLabel: 'R : R',
    button: 'EXECUTE'
  },

  execute: {
    toast: 'ORDER WORKING',
    reset: 'SCANNING'
  }
};
