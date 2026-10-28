// Glottal pulse shapes over one normalised period (0 <= t < 1).
//
// Each model gives two tables: the glottal flow (scaled to peak 1) and the
// flow derivative (scaled to peak magnitude 1). Lip radiation acts roughly as
// a time derivative, so the flow derivative is what excites the vocal tract.

export const TABLE_SIZE = 4096;

function normalisePeak(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] /= m;
  return x;
}

// Periodic derivative of a table by central differences.
function differentiate(flow) {
  const n = flow.length;
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = (flow[(i + 1) % n] - flow[(i - 1 + n) % n]) / 2;
  return d;
}

// Rosenberg (1971) trigonometric pulse. oq = open quotient (fraction of the
// period the glottis is open); the opening phase is twice as long as the
// closing phase.
export function rosenberg(oq, n = TABLE_SIZE) {
  const tp = (2 / 3) * oq;
  const tn = (1 / 3) * oq;
  const flow = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (t < tp) flow[i] = 0.5 * (1 - Math.cos((Math.PI * t) / tp));
    else if (t < tp + tn) flow[i] = Math.cos((Math.PI * (t - tp)) / (2 * tn));
  }
  return { flow: normalisePeak(flow), deriv: normalisePeak(differentiate(flow)) };
}

// Liljencrants-Fant (LF) model, set by the single shape parameter Rd
// (Fant 1995): small Rd is a tense voice, large Rd a lax/breathy voice.
export function lfParams(rd) {
  const ra = (-1 + 4.8 * rd) / 100;
  const rk = (22.4 + 11.8 * rd) / 100;
  const rg = rk / (4 * ((0.11 * rd) / (0.5 + 1.2 * rk) - ra));
  const tp = 1 / (2 * rg);
  const te = tp * (1 + rk);
  const ta = ra;
  // Return-phase constant: eps * ta = 1 - exp(-eps * (1 - te)).
  let eps = 1 / ta;
  for (let i = 0; i < 100; i++) eps = (1 - Math.exp(-eps * (1 - te))) / ta;
  const wg = Math.PI / tp;
  // Return-phase area with Ee = 1.
  const tr = 1 - te;
  const returnArea = -((1 - Math.exp(-eps * tr)) / eps - tr * Math.exp(-eps * tr)) / (eps * ta);
  const openArea = (alpha) => {
    const e0 = -1 / (Math.exp(alpha * te) * Math.sin(wg * te));
    const s = Math.exp(alpha * te) * (alpha * Math.sin(wg * te) - wg * Math.cos(wg * te)) + wg;
    return (e0 * s) / (alpha * alpha + wg * wg);
  };
  // Total area must be zero (flow returns to zero). Bisection on alpha.
  const f = (alpha) => openArea(alpha) + returnArea;
  let lo = -50;
  let hi = 200;
  for (let i = 0; i < 200 && f(lo) * f(hi) > 0; i++) {
    lo -= 50;
    hi += 50;
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  const alpha = (lo + hi) / 2;
  const e0 = -1 / (Math.exp(alpha * te) * Math.sin(wg * te));
  return { tp, te, ta, eps, alpha, e0, wg };
}

export function lf(rd, n = TABLE_SIZE) {
  const { te, ta, eps, alpha, e0, wg } = lfParams(rd);
  const deriv = new Float64Array(n);
  const tail = Math.exp(-eps * (1 - te));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    deriv[i] = t <= te
      ? e0 * Math.exp(alpha * t) * Math.sin(wg * t)
      : -(Math.exp(-eps * (t - te)) - tail) / (eps * ta);
  }
  const flow = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += deriv[i];
    flow[i] = acc;
  }
  // Remove the small numerical drift so the flow starts and ends at zero.
  const drift = flow[n - 1];
  for (let i = 0; i < n; i++) flow[i] -= (drift * i) / (n - 1);
  return { flow: normalisePeak(flow), deriv: normalisePeak(deriv) };
}

export function glottalTables(model, { oq = 0.6, rd = 1.0 } = {}) {
  if (model === 'rosenberg') return rosenberg(oq);
  if (model === 'lf') return lf(rd);
  // Impulse train: no table for the derivative; a Rosenberg pulse is still
  // used to shape the "pulsed" noise.
  return { flow: rosenberg(0.5).flow, deriv: null };
}
