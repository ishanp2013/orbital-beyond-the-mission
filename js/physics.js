/* ORBITAL — physics models
 * Patched-conic orbital mechanics, rocket equation, link budget, radiative thermal balance.
 * All functions are pure. Units: km, s, kg, W unless noted.
 */
(function () {
  const ORB = window.ORB;
  const C = ORB.CONST;
  const P = (ORB.phys = {});
  const PI = Math.PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  P.clamp = clamp;

  P.vCirc = (mu, r) => Math.sqrt(mu / r);
  P.visViva = (mu, r, a) => Math.sqrt(Math.max(0, mu * (2 / r - 1 / a)));
  P.periodS = (mu, a) => 2 * PI * Math.sqrt((a * a * a) / mu);
  P.smaFromPeriod = (mu, periodS) => Math.cbrt((mu * periodS * periodS) / (4 * PI * PI));

  // Tsiolkovsky (km/s)
  P.rocketDv = (isp, m0, mf) => (mf <= 0 || m0 <= mf ? 0 : (isp * C.G0 * Math.log(m0 / mf)) / 1000);
  P.propForDv = (isp, dvKms, mDry) => mDry * (Math.exp((dvKms * 1000) / (isp * C.G0)) - 1);

  // Hohmann transfer between circular orbits (any mu)
  P.hohmann = (mu, r1, r2) => {
    const a = (r1 + r2) / 2;
    const dv1 = Math.abs(P.visViva(mu, r1, a) - P.vCirc(mu, r1));
    const dv2 = Math.abs(P.vCirc(mu, r2) - P.visViva(mu, r2, a));
    return { a, dv1, dv2, tof: PI * Math.sqrt((a * a * a) / mu) };
  };

  // Capture Δv from hyperbolic approach (vinf) into orbit with periapsis rp and apoapsis ra
  P.captureDv = (mu, vinf, rp, ra) => {
    const vHyp = Math.sqrt(vinf * vinf + (2 * mu) / rp);
    const a = (rp + ra) / 2;
    return Math.max(0, vHyp - P.visViva(mu, rp, a));
  };

  // Eclipse fraction for a circular orbit with beta angle 0 (worst case, cylindrical shadow)
  P.eclipseFraction = (R, r) => (r <= R ? 0.5 : Math.asin(R / r) / PI);

  /* Outbound heliocentric transfer: tangential departure at r1 (AU) into an ellipse with
   * aphelion ra (AU) ≥ r2. Solves Kepler's equation for time of flight to r2.
   * incDeg: plane difference between Earth and target (applied at arrival). */
  P.helioTransfer = (r1AU, r2AU, raAU, incDeg = 0) => {
    const AU = C.AU_KM, MU = C.MU_SUN;
    const r1 = r1AU * AU, r2 = r2AU * AU;
    const ra = Math.max(raAU, r2AU) * AU;
    const a = (r1 + ra) / 2;
    const e = (ra - r1) / (ra + r1);
    const vDep = P.visViva(MU, r1, a);
    const vinfDep = vDep - P.vCirc(MU, r1);
    let nu, tof, gamma;
    if (ra <= r2 * 1.000001) {
      nu = PI; gamma = 0; tof = PI * Math.sqrt((a * a * a) / MU);
    } else {
      const p = a * (1 - e * e);
      const cosnu = clamp((p / r2 - 1) / e, -1, 1);
      nu = Math.acos(cosnu);
      const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
      const M = E - e * Math.sin(E);
      tof = M * Math.sqrt((a * a * a) / MU);
      gamma = Math.atan((e * Math.sin(nu)) / (1 + e * Math.cos(nu)));
    }
    const v2 = P.visViva(MU, r2, a);
    const vP = P.vCirc(MU, r2);
    const cosAng = Math.cos(gamma) * Math.cos((incDeg * PI) / 180);
    const vinfArr = Math.sqrt(Math.max(0, v2 * v2 + vP * vP - 2 * v2 * vP * cosAng));
    return { c3: vinfDep * vinfDep, vinfDep, vinfArr, tofD: tof / 86400, nu, a: a / AU, e, raAU: ra / AU, gammaDeg: (gamma * 180) / PI };
  };

  // Position along a transfer ellipse (perihelion at angle 0) after time t (s). Returns {r (AU), theta}
  P.ellipsePos = (aAU, e, tS) => {
    const a = aAU * C.AU_KM;
    const n = Math.sqrt(C.MU_SUN / (a * a * a));
    let M = n * tS;
    let E = M;
    for (let i = 0; i < 30; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const r = a * (1 - e * Math.cos(E));
    return { r: r / C.AU_KM, theta: nu };
  };

  // Edelbaum low-thrust Δv between circular orbits (km/s)
  P.edelbaum = (v1, v2, incDeg = 0) =>
    Math.sqrt(v1 * v1 + v2 * v2 - 2 * v1 * v2 * Math.cos((PI / 2) * ((incDeg * PI) / 180)));

  // Electric propulsion: thrust (N) from input power (W)
  P.epThrust = (powerW, isp, eff) => (2 * eff * powerW) / (isp * C.G0);

  /* Numerical heliocentric integration (2-D, Sun only) with an optional instantaneous
   * Jupiter gravity assist (patched conic, assumes Jupiter is phased to be there). */
  P.integrateOutbound = ({ c3, targetAU, maxYears = 30, jga = null }) => {
    const AU = C.AU_KM, MU = C.MU_SUN;
    const vE = P.vCirc(MU, AU);
    let x = AU, y = 0, vx = 0, vy = vE + Math.sqrt(Math.max(0, c3));
    let t = 0;
    const tMax = maxYears * 365.25 * 86400;
    const path = [{ t: 0, x: 1, y: 0 }];
    const rJ = ORB.BODIES.jupiter.aAU * AU;
    let jup = null, lastSample = 0, reached = false, maxR = 1;
    const acc = (px, py) => { const r = Math.hypot(px, py); const k = -MU / (r * r * r); return [k * px, k * py]; };
    while (t < tMax) {
      const r = Math.hypot(x, y);
      const dt = 86400 * clamp(0.6 * (r / AU), 0.5, 20);
      // RK4
      const [ax1, ay1] = acc(x, y);
      const [ax2, ay2] = acc(x + 0.5 * dt * vx, y + 0.5 * dt * vy);
      const vx2 = vx + 0.5 * dt * ax1, vy2 = vy + 0.5 * dt * ay1;
      const [ax3, ay3] = acc(x + 0.5 * dt * vx2, y + 0.5 * dt * vy2);
      const vx3 = vx + 0.5 * dt * ax2, vy3 = vy + 0.5 * dt * ay2;
      const [ax4, ay4] = acc(x + dt * vx3, y + dt * vy3);
      const vx4 = vx + dt * ax3, vy4 = vy + dt * ay3;
      const nx = x + (dt / 6) * (vx + 2 * vx2 + 2 * vx3 + vx4);
      const ny = y + (dt / 6) * (vy + 2 * vy2 + 2 * vy3 + vy4);
      vx = vx + (dt / 6) * (ax1 + 2 * ax2 + 2 * ax3 + ax4);
      vy = vy + (dt / 6) * (ay1 + 2 * ay2 + 2 * ay3 + ay4);
      x = nx; y = ny; t += dt;
      const rn = Math.hypot(x, y);
      maxR = Math.max(maxR, rn / AU);
      if (jga && !jup && rn >= rJ) {
        const vJmag = P.vCirc(MU, rJ);
        const jx = (-y / rn) * vJmag, jy = (x / rn) * vJmag;
        const ix = vx - jx, iy = vy - jy;
        const vinf = Math.hypot(ix, iy);
        const rp = jga.rpRJ * ORB.BODIES.jupiter.R;
        const delta = 2 * Math.asin(1 / (1 + (rp * vinf * vinf) / ORB.BODIES.jupiter.mu));
        let best = null;
        for (const s of [1, -1]) {
          const ca = Math.cos(s * delta), sa = Math.sin(s * delta);
          const ox = ix * ca - iy * sa, oy = ix * sa + iy * ca;
          const sp = Math.hypot(jx + ox, jy + oy);
          if (!best || sp > best.sp) best = { sp, ox, oy };
        }
        const before = Math.hypot(vx, vy);
        vx = jx + best.ox; vy = jy + best.oy;
        jup = { tD: t / 86400, vinf, turnDeg: (delta * 180) / PI, dvGain: Math.hypot(vx, vy) - before, x: x / AU, y: y / AU };
        path.push({ t: t / 86400, x: x / AU, y: y / AU, jup: true });
      }
      if (t - lastSample > 20 * 86400) { path.push({ t: t / 86400, x: x / AU, y: y / AU }); lastSample = t; }
      if (rn >= targetAU * AU) { reached = true; break; }
      // bound orbit that turned around without reaching target
      if ((x * vx + y * vy) < 0 && rn < targetAU * AU) { break; }
    }
    path.push({ t: t / 86400, x: x / AU, y: y / AU });
    const r = Math.hypot(x, y);
    return { reached, tofD: t / 86400, vArr: Math.hypot(vx, vy), rEnd: r / AU, maxR, jupiter: jup, path, theta: Math.atan2(y, x) };
  };

  /* Link budget. distKm, antenna gain (dBi) both ends, Tsys (K). Returns achievable bit rate (bps). */
  P.dishGain = (D, lambdaM, eff = 0.55) => (D > 0 ? 10 * Math.log10(eff * Math.pow((PI * D) / lambdaM, 2)) : 0);
  P.link = ({ ptW, gtDbi, grDbi, distKm, lambdaM, tsysK, lossDb, pointLossDb = 0, capBps }) => {
    const pt = 10 * Math.log10(Math.max(ptW, 1e-6));
    const fspl = 20 * Math.log10((4 * PI * distKm * 1000) / lambdaM);
    const pr = pt + gtDbi + grDbi - fspl - lossDb - pointLossDb;
    const n0 = C.K_DB + 10 * Math.log10(tsysK);
    const prn0 = pr - n0; // dB-Hz
    const reqEbN0 = 1.0, margin = 3.0; // turbo-coded, 3 dB design margin
    let rate = Math.pow(10, (prn0 - reqEbN0 - margin) / 10);
    rate = Math.min(rate, capBps);
    return { rate, prDbw: pr, fsplDb: fspl, prn0, ptDbw: pt };
  };
  P.pointingLoss = (D, lambdaM, errDeg) => {
    if (!D) return 0;
    const bw = (70 * lambdaM) / D; // half-power beamwidth (deg)
    return Math.min(30, 12 * Math.pow(errDeg / bw, 2));
  };

  /* Radiative thermal balance of an MLI-wrapped bus with one radiator facing away from the Sun. */
  P.thermalEq = ({ pDiss, dAU, qPlanet = 0, aRad, epsRad, aBody, epsMli, extraW = 0 }) => {
    const S = C.SOLAR / (dAU * dAU);
    const qin = pDiss + extraW + epsMli * aBody * (S / 4) + epsRad * aRad * qPlanet;
    const g = C.SIGMA * (epsRad * aRad + epsMli * aBody);
    return { T: Math.pow(Math.max(qin, 1e-3) / g, 0.25), qin, g };
  };
  P.heaterNeeded = (eq, tMin) => Math.max(0, eq.g * Math.pow(tMin, 4) - eq.qin);

  // Launch-vehicle capability vs C3 (exponential fit to typical published performance curves — MODEL)
  P.lvCapacityC3 = (lv, c3, kick, siteLat) => {
    let mEsc = lv.mEsc, lambda = lv.lambda;
    if (kick) { mEsc *= ORB.KICK_STAGE.mEscMult; lambda *= ORB.KICK_STAGE.lambdaMult; }
    const siteMult = P.siteMult(siteLat, 28.5);
    return mEsc * Math.exp(-c3 / lambda) * siteMult;
  };
  // Inverse: achieved C3 for a given launch mass
  P.lvAchievedC3 = (lv, mass, kick, siteLat) => {
    let mEsc = lv.mEsc, lambda = lv.lambda;
    if (kick) { mEsc *= ORB.KICK_STAGE.mEscMult; lambda *= ORB.KICK_STAGE.lambdaMult; }
    return lambda * Math.log((mEsc * P.siteMult(siteLat, 28.5)) / mass);
  };
  // Effect of Earth-rotation boost relative to reference site (vehicle upper-stage effective Isp ~350 s)
  P.siteMult = (lat, refLat) => {
    const boost = (l) => 0.4651 * Math.cos((l * PI) / 180); // km/s
    return Math.exp((boost(lat) - boost(refLat)) / (350 * C.G0 / 1000));
  };
  // LEO capability for given altitude and inclination from a launch site (MODEL)
  P.lvCapacityLEO = (lv, altKm, incDeg, siteLat) => {
    const R = ORB.BODIES.earth.R, mu = ORB.BODIES.earth.mu;
    const ve = 350 * C.G0 / 1000;
    const vRef = 0.4651 * Math.cos((28.5 * PI) / 180); // reference: due east from 28.5°
    // rotation contribution along the orbit for inclination ≥ latitude: v_eq·cos(i)
    let rot, plane = 0;
    if (incDeg >= siteLat) rot = 0.4651 * Math.cos((incDeg * PI) / 180);
    else {
      rot = 0.4651 * Math.cos((siteLat * PI) / 180);
      plane = 2 * 7.7 * Math.sin((((siteLat - incDeg) * PI) / 180) / 2);
    }
    const h = P.hohmann(mu, R + Math.min(400, altKm), R + Math.max(400, altKm));
    const altDv = (altKm >= 400 ? 1 : -1) * (h.dv1 + h.dv2);
    const extra = (vRef - rot) + plane + altDv;
    return lv.leo * Math.exp(-extra / ve);
  };

  // Atmospheric drag station-keeping Δv per year at altitude (km), moderate solar activity (MODEL, order-of-magnitude)
  P.dragDvPerYear = (altKm) => {
    // ~100 m/s/yr at 350 km falling ~e-fold every ~55 km
    return 0.1 * Math.exp(-(altKm - 350) / 55); // km/s/yr
  };

  // Distances between Earth and a target over time (circular coplanar orbits) — for comms
  P.earthTargetGeometry = ({ targetAU, thetaT0, nT, thetaE0, days, samples = 240 }) => {
    const nE = (2 * PI) / ORB.CONST.YEAR_D;
    let dMin = Infinity, dMax = 0, dSum = 0, sepMin = 180;
    const series = [];
    for (let i = 0; i <= samples; i++) {
      const t = (days * i) / samples;
      const g = P.geomAt({ targetAU, thetaT: thetaT0 + nT * t, thetaE: thetaE0 + nE * t });
      dMin = Math.min(dMin, g.dAU); dMax = Math.max(dMax, g.dAU); dSum += g.dAU; sepMin = Math.min(sepMin, g.sepDeg);
      series.push({ t, d: g.dAU, sep: g.sepDeg });
    }
    return { dMin, dMax, dMean: dSum / (samples + 1), sepMin, series };
  };
  // Sun-Earth-Probe angle and Earth distance
  P.geomAt = ({ targetAU, thetaT, thetaE }) => {
    const ex = Math.cos(thetaE), ey = Math.sin(thetaE);
    const tx = targetAU * Math.cos(thetaT), ty = targetAU * Math.sin(thetaT);
    const dx = tx - ex, dy = ty - ey;
    const d = Math.hypot(dx, dy);
    // angle at Earth between Sun direction (-e) and probe direction (d)
    const cosSep = (-ex * dx - ey * dy) / d;
    return { dAU: d, sepDeg: (Math.acos(clamp(cosSep, -1, 1)) * 180) / PI };
  };

  // Seeded RNG (mulberry32)
  P.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  P.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
})();
