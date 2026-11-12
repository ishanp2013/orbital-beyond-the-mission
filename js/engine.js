/* ORBITAL — design evaluation engine
 * evaluate(mission, design, opts) → a complete engineering assessment of the spacecraft + mission:
 * mass, power, thermal, comms, propulsion, launch, trajectory, cost, reliability, science, issues, readiness.
 * The SAME numbers drive the launch simulation, mission control and the final report.
 */
(function () {
  const ORB = window.ORB;
  const P = ORB.phys, C = ORB.CONST, K = ORB.COMPONENTS;
  const E = (ORB.engine = {});
  const find = (arr, id) => arr.find((x) => x.id === id) || arr[0];
  const clamp = P.clamp;
  const D2R = Math.PI / 180;

  E.clone = (o) => JSON.parse(JSON.stringify(o));
  E.defaultDesign = (mission) => E.clone(mission.baseline);
  E.parts = (d) => ({
    solar: find(K.solar, d.solarType), battery: find(K.battery, d.batteryType), pmad: find(K.pmad, d.pmad),
    engine: find(K.engine, d.engine), acs: find(K.acs, d.acs), antenna: find(K.antenna, d.antenna), band: find(K.band, d.band),
    insulation: find(K.insulation, d.insulation), thermalCtrl: find(K.thermalCtrl, d.thermalCtrl), structure: find(K.structure, d.structure),
    computer: find(K.computer, d.computer), storage: find(K.storage, d.storage), lv: find(ORB.LAUNCHERS, d.lv), site: find(ORB.LAUNCH_SITES, d.site),
  });

  // Radiation shielding factor relative to the 1 mm Al-equivalent reference (MODEL)
  E.shieldFactor = (mm) => (Math.exp(-mm / 3) + 0.01) / (Math.exp(-1 / 3) + 0.01);

  /* ------------------------------------------------------------------ science orbit */
  E.scienceOrbit = (m, d) => {
    const o = { duty: 1, res: 1, coverage: 1, optical: 1, ecl: 0, periodMin: 0, qHot: 0, qCold: 0, skPerYr: 0, env: ORB.ENV[m.id], radMult: 1, label: '' };
    if (m.type === 'leo') {
      const b = ORB.BODIES.earth, inc = find(ORB.ORBITS.eoInc, d.orbit.inc);
      const alt = clamp(d.orbit.alt || 700, 300, 1200), r = b.R + alt;
      o.alt = alt; o.incDeg = inc.incDeg; o.incOpt = inc;
      o.periodMin = P.periodS(b.mu, r) / 60;
      o.v = P.vCirc(b.mu, r);
      o.ecl = inc.eclipse ? P.eclipseFraction(b.R, r) : 0.01;
      o.res = clamp(Math.pow(700 / alt, 0.5), 0.6, 1.3);
      o.coverage = inc.coverage; o.optical = inc.optical;
      const vf = Math.pow(b.R / r, 2);
      o.qHot = 125 * vf; o.qCold = 80 * vf;
      o.skPerYr = P.dragDvPerYear(alt) + 0.002;
      o.radMult = alt > 900 ? 2.5 : alt > 700 ? 1.5 : 1; // inner Van Allen belt / SAA exposure grows with altitude
      o.label = `${alt} km · ${inc.name}`;
      o.sunAU = [0.983, 1.017];
    } else if (m.type === 'moon') {
      const b = ORB.BODIES.moon, inc = find(ORB.ORBITS.moonInc, d.orbit.inc);
      const alt = d.orbit.alt || 100, r = b.R + alt;
      o.alt = alt; o.incOpt = inc;
      o.periodMin = P.periodS(b.mu, r) / 60;
      o.v = P.vCirc(b.mu, r);
      o.ecl = P.eclipseFraction(b.R, r);
      o.res = clamp(Math.pow(100 / alt, 0.35), 0.7, 1.3);
      o.coverage = inc.coverage;
      const vf = Math.pow(b.R / r, 2);
      o.qHot = 300 * vf; o.qCold = 8;
      o.skPerYr = 0.15 * Math.exp(-(alt - 50) / 45); // lunar mascon perturbations
      o.label = `${alt} km · ${inc.name}`;
      o.sunAU = [0.983, 1.017];
    } else if (m.id === 'mars') {
      const b = ORB.BODIES.mars, opt = find(ORB.ORBITS.mars, d.orbit.id);
      const rp = b.R + opt.alt, ra = b.R + opt.apo;
      o.opt = opt; o.alt = opt.alt;
      o.periodMin = P.periodS(b.mu, (rp + ra) / 2) / 60;
      o.v = P.visViva(b.mu, rp, (rp + ra) / 2);
      o.ecl = opt.apo === opt.alt ? P.eclipseFraction(b.R, rp) : 0.08;
      o.res = opt.res; o.coverage = opt.coverage;
      o.qHot = opt.apo === opt.alt ? 45 : 12; o.qCold = 10;
      o.skPerYr = 0.01;
      o.label = opt.name;
      o.sunAU = [b.aAU * (1 - b.ecc), b.aAU * (1 + b.ecc)];
    } else if (m.id === 'asteroid') {
      const b = ORB.BODIES.tessera, opt = find(ORB.ORBITS.asteroid, d.orbit.id);
      o.opt = opt; o.alt = opt.radiusKm;
      o.periodMin = P.periodS(b.mu, opt.radiusKm) / 60;
      o.v = P.vCirc(b.mu, opt.radiusKm) * 1000; // m/s
      o.ecl = opt.eclipse ? 0.18 : 0;
      o.res = opt.res; o.navRisk = opt.risk;
      o.skPerYr = 0.012 * opt.risk;
      o.label = opt.name;
      o.sunAU = [b.aAU * (1 - b.ecc), b.aAU * (1 + b.ecc)];
    } else if (m.id === 'jupiter') {
      const b = ORB.BODIES.jupiter, opt = find(ORB.ORBITS.jupiter, d.orbit.id);
      const a = P.smaFromPeriod(b.mu, opt.periodD * 86400), rp = opt.rpRJ * b.R, ra = 2 * a - rp;
      o.opt = opt; o.rp = rp; o.ra = ra;
      o.periodMin = opt.periodD * 1440;
      o.v = P.visViva(b.mu, rp, a);
      o.ecl = 0; o.duty = opt.duty; o.radMult = opt.radMult;
      o.skPerYr = 0.03;
      o.label = opt.name;
      o.sunAU = [b.aAU * (1 - b.ecc), b.aAU * (1 + b.ecc)];
    } else if (m.id === 'kbo') {
      const opt = ORB.ORBITS.kboFlyby.find((x) => x.km === d.orbit.flybyKm) || ORB.ORBITS.kboFlyby[1];
      o.opt = opt; o.res = opt.res; o.navRisk = opt.navRisk;
      o.label = `Flyby at ${opt.km.toLocaleString()} km`;
      o.sunAU = [44, 47];
    }
    return o;
  };

  /* ------------------------------------------------------------------ trajectory */
  E.trajectory = (m, d, so) => {
    const t = d.trajectory || {};
    const tr = { type: t.type, items: [], notes: [], feasible: true, reason: '', mode: 'c3', c3: 0, tofD: 0, extraD: 0, epDv: 0, cruiseSun: [1, 1], vinfArr: 0 };
    const add = (label, dv, hint) => tr.items.push({ label, dv, hint });
    if (m.type === 'leo') {
      tr.mode = 'leo'; tr.type = 'direct';
      tr.tofD = 0; tr.extraD = 30; // commissioning
      const yrs = d.duration / 365.25;
      add('Injection error trim', 0.01, 'Rockets never insert perfectly; small burns fix the orbit.');
      add(`Drag make-up (${(so.skPerYr * 1000).toFixed(1)} m/s/yr × ${yrs.toFixed(1)} yr)`, so.skPerYr * yrs, 'Thin upper atmosphere slows the spacecraft; lower orbits decay faster.');
      if (so.alt > 600) {
        const b = ORB.BODIES.earth, r = b.R + so.alt, rpT = b.R + 250;
        const dvDeorbit = P.vCirc(b.mu, r) - P.visViva(b.mu, r, (r + rpT) / 2);
        add('End-of-life deorbit (perigee to 250 km)', dvDeorbit, 'Above ~600 km natural decay takes decades; guidelines require disposal within 25 years.');
      } else tr.notes.push('Below ~600 km, drag removes the spacecraft naturally within 25 years — no deorbit burn needed.');
      tr.cruiseSun = [0.983, 1.017];
      tr.windowText = 'Daily launch opportunities (orbit plane timing).';
    } else if (m.type === 'moon') {
      const b = ORB.BODIES.moon, r = b.R + so.alt;
      const yrs = d.duration / 365.25;
      if (t.type === 'blt') {
        tr.c3 = -0.6; tr.tofD = 105; tr.vinfArr = 0.35;
        add('Trajectory corrections', 0.06, 'Low-energy routes are sensitive; more navigation needed.');
        add('Lunar orbit insertion', P.captureDv(b.mu, tr.vinfArr, r, r), 'Arriving slowly means a smaller braking burn.');
      } else if (t.type === 'ep') {
        tr.c3 = -16.4; tr.ep = true; // GTO-like drop-off
        tr.epDv = 3.9 + (100 - so.alt) * 0.0006;
        add('Low-thrust spiral GTO → lunar orbit (Edelbaum-type estimate)', tr.epDv, 'Slow spiral outward from a geostationary-transfer-like orbit, then spiral down to the Moon.');
        add('Trajectory corrections', 0.03);
      } else {
        tr.type = 'direct'; tr.c3 = -2.0; tr.tofD = 4.5; tr.vinfArr = 0.82;
        add('Trajectory corrections', 0.03, 'Small burns during the 4–5 day coast.');
        add('Lunar orbit insertion', P.captureDv(b.mu, tr.vinfArr, r, r), 'Braking burn behind the Moon.');
      }
      add(`Orbit maintenance (${(so.skPerYr * 1000).toFixed(0)} m/s/yr × ${yrs.toFixed(1)} yr)`, so.skPerYr * yrs, 'Lumpy lunar gravity (mascons) distorts low orbits.');
      tr.cruiseSun = [0.983, 1.017];
      tr.windowText = 'Lunar windows recur monthly.';
    } else if (m.type === 'helio') {
      const tb = ORB.BODIES[m.dest];
      const r2 = tb.aAU, inc = tb.incDeg || 0;
      const half = m.window ? m.window.halfWidth : 25;
      const off = t.offset || 0, k = Math.pow(off / half, 2);
      const yrs = d.duration / 365.25;
      tr.synodicD = 1 / Math.abs(1 / ORB.CONST.YEAR_D - 1 / tb.periodD);
      if (Math.abs(off) > 2 * half) { tr.feasible = false; tr.reason = `Departure ${Math.abs(off)} days from the optimum is outside the launch window (±${2 * half} days). The planets are no longer aligned.`; }
      let base;
      if (t.type === 'ep') {
        tr.ep = true; tr.c3 = 1.0;
        const v1 = P.vCirc(C.MU_SUN, C.AU_KM), v2 = P.vCirc(C.MU_SUN, r2 * C.AU_KM);
        const helio = P.edelbaum(v1, v2, inc);
        let spiral = 0;
        if (m.id === 'mars') {
          const mb = ORB.BODIES.mars;
          spiral = so.opt.apo === so.opt.alt ? P.vCirc(mb.mu, mb.R + so.opt.alt) : P.vCirc(mb.mu, mb.R + so.opt.alt) * 0.55;
          if (so.opt.aerobrake) tr.notes.push('Aerobraking is not combined with low-thrust spirals in this model; the spiral goes straight to the science orbit.');
        }
        tr.epDv = helio + spiral;
        add(`Heliocentric low-thrust transfer (Edelbaum: ${helio.toFixed(2)} km/s)`, helio, 'Continuous thrust gradually raises the orbit around the Sun.');
        if (spiral) add('Capture spiral down to science orbit', spiral, 'Without a big braking burn, the craft spirals inward slowly.');
        add('Navigation & trims', 0.05);
        base = P.helioTransfer(1, r2, r2, inc);
        tr.hohmannTofD = base.tofD;
      } else if (t.type === 'ega') {
        base = P.helioTransfer(1, r2, r2, 0);
        tr.c3 = 28 + 10 * k; tr.tofD = base.tofD + 730; tr.vinfArr = base.vinfArr * (1 + 0.15 * k);
        add('Deep-space maneuver (ΔV-EGA)', 0.75, 'Burn near aphelion of the 2-year loop that sets up the Earth flyby.');
        add('Trajectory corrections', 0.06);
        tr.notes.push('ΔV-EGA modelled as: launch C3 ≈ 28 km²/s², a 0.75 km/s deep-space burn, then an Earth flyby that delivers the same arrival as a direct transfer, 2 years later.');
        tr.cruiseSun = [0.9, Math.max(r2 * (1 + tb.ecc), 2.3)];
      } else {
        const speed = t.type === 'fast' ? clamp(t.speed || 0, 0, 1) : 0;
        const ra = r2 * (1 + speed * 1.5);
        base = P.helioTransfer(1, r2, ra, inc);
        tr.c3 = base.c3 + (2 + 0.3 * base.c3) * k;
        tr.tofD = base.tofD;
        tr.vinfArr = base.vinfArr * (1 + 0.15 * k);
        tr.ra = base.raAU; tr.ecc = base.e; tr.a = base.a; tr.nu = base.nu;
        add('Trajectory corrections', m.id === 'jupiter' ? 0.08 : 0.05, 'Typically 3–5 small burns during cruise.');
      }
      if (m.id === 'mars' && !tr.ep) {
        const mb = ORB.BODIES.mars, opt = so.opt;
        if (opt.aerobrake) {
          add('Mars orbit insertion (into loose ellipse)', P.captureDv(mb.mu, tr.vinfArr, mb.R + 300, mb.R + opt.captureApo), 'Capture into a long ellipse — much cheaper than a circular orbit.');
          add('Aerobraking walk-in, corridor control & periapsis raise', 0.12, 'Small burns keep each atmospheric pass safe, then lift periapsis out of the atmosphere.');
          tr.extraD = 180;
          tr.notes.push('Aerobraking replaces ~1 km/s of propellant with ~6 months of careful passes through the upper atmosphere.');
        } else add('Mars orbit insertion', P.captureDv(mb.mu, tr.vinfArr, mb.R + opt.alt, mb.R + opt.apo), 'The braking burn that converts the arriving hyperbola into an orbit.');
      }
      if (m.id === 'asteroid' && !tr.ep) add(`Rendezvous (match speed & 3° plane)`, tr.vinfArr, 'A small asteroid has negligible gravity: the full relative velocity must be cancelled by the engine.');
      if (m.id === 'jupiter') {
        const jb = ORB.BODIES.jupiter;
        add('Jupiter orbit insertion', P.captureDv(jb.mu, tr.vinfArr, so.rp, so.ra), 'Burn at closest approach, deep in Jupiter\'s gravity well, where it is most effective (Oberth effect).');
      }
      add(`Orbit maintenance (${(so.skPerYr * 1000).toFixed(0)} m/s/yr)`, so.skPerYr * yrs);
      if (!tr.cruiseSun || tr.cruiseSun[1] === 1) tr.cruiseSun = [1, Math.max(so.sunAU[1], r2)];
      // window and arrival geometry
      tr.window = { halfWidth: half, offset: off };
      tr.windowText = `Windows recur every ${(tr.synodicD / 30.44).toFixed(1)} months (synodic period ${tr.synodicD.toFixed(0)} days).`;
      tr.base = base;
    } else if (m.type === 'kbo') {
      const isJ = t.type === 'jga';
      tr.c3 = clamp(t.c3 || 120, 80, 220);
      const key = `${tr.c3}|${isJ}|${t.rpRJ}`;
      E._kboCache = E._kboCache || {};
      let res = E._kboCache[key];
      if (!res) { res = P.integrateOutbound({ c3: tr.c3, targetAU: 44, maxYears: 40, jga: isJ ? { rpRJ: clamp(t.rpRJ || 32, 3, 100) } : null }); E._kboCache[key] = res; }
      tr.int = res; tr.path = res.path;
      if (!res.reached) { tr.feasible = false; tr.reason = `With C3 = ${tr.c3} km²/s² the spacecraft never reaches 44 AU — the Sun pulls it back (bound orbit, max ${res.maxR.toFixed(1)} AU). Increase launch energy${isJ ? '' : ' or use a Jupiter gravity assist'}.`; tr.tofD = 40 * 365; }
      else tr.tofD = res.tofD;
      tr.vinfArr = res.vArr;
      tr.jupiter = res.jupiter;
      add('Trajectory corrections (cruise)', 0.08, 'A decade-long cruise needs periodic tweaks.');
      if (isJ) add('Jupiter flyby targeting', 0.03, 'Aiming precisely for the right flyby altitude.');
      add('Flyby targeting at Halcyon', 0.04 * so.navRisk, 'The target\'s position is uncertain until the spacecraft\'s own camera finds it; closer flybys need sharper aim.');
      tr.cruiseSun = [1, 44];
      if (m.maxTravelYears && tr.tofD / 365.25 > m.maxTravelYears && tr.feasible) {
        tr.tooLong = true;
      }
      tr.windowText = isJ ? 'Jupiter-assist windows occur roughly every 13 months, when Jupiter is in the right place.' : 'Direct trajectories have a yearly window.';
    }
    return tr;
  };

  /* ------------------------------------------------------------------ main evaluation */
  E.evaluate = (m, d, opts = {}) => {
    const p = E.parts(d);
    const diff = ORB.DIFFICULTY.find((x) => x.id === (opts.difficulty || 'engineer')) || ORB.DIFFICULTY[1];
    const ev = { mission: m, design: d, parts: p, issues: [], difficulty: diff };
    const so = (ev.orbit = E.scienceOrbit(m, d));
    const tr = (ev.traj = E.trajectory(m, d, so));
    const sciDays = d.duration;
    const yrsTotal = (tr.tofD + tr.extraD + sciDays) / 365.25;
    ev.time = { cruiseD: tr.tofD, extraD: tr.extraD, sciDays, totalD: tr.tofD + tr.extraD + sciDays, yrsTotal };
    const instruments = d.instruments.map((id) => ORB.INSTRUMENT_BY_ID[id]).filter(Boolean);
    const isKbo = m.type === 'kbo';

    /* ---------------- power generation model ---------------- */
    const sunRange = [Math.min(tr.cruiseSun[0], so.sunAU[0]), Math.max(tr.cruiseSun[1], so.sunAU[1])];
    const envRad = so.env ? so.env.rad : 4;
    const arrayDegMult = 1 + (m.id === 'jupiter' ? 3 : 0);
    const util = p.pmad.id === 'det' ? (sunRange[1] / sunRange[0] < 1.3 ? 0.95 : 0.82) : 1.0;
    const lilt = (dAU) => (dAU <= 3 ? 1 : Math.max(0.7, 1 - 0.05 * (dAU - 3)));
    const arrayW = (dAU, yrs) => d.solarArea > 0 && p.solar.eff > 0
      ? (C.SOLAR / (dAU * dAU)) * d.solarArea * p.solar.eff * 0.85 * 0.97 * util * lilt(dAU) * Math.pow(1 - p.solar.degr * arrayDegMult, yrs) : 0;
    const rtgW = (yrs) => d.rtgCount * K.rtg.powerW * Math.pow(1 - K.rtg.decay, yrs);
    ev.powerFns = { arrayW, rtgW, util };

    /* ---------------- loads ---------------- */
    const txDC = d.txPower / (p.band.id === 'ka' ? 0.4 : 0.45);
    const duty = clamp(d.dsnHours / 24, 0, 1);
    const instW = instruments.reduce((s, i) => s + i.powerW, 0);
    const busW = 25 + p.computer.powerW + p.storage.powerW + p.acs.powerW + 8;

    /* ---------------- masses (two-pass for body-size dependence) ---------------- */
    let dry = 600, mass;
    for (let pass = 0; pass < 3; pass++) {
      const L = clamp(1.0 + dry / 1500, 0.8, 4.5);
      const aBody = 6 * L * L;
      const items = [];
      const pushM = (key, label, kg) => items.push({ key, label, kg });
      if (d.solarArea > 0 && p.solar.id !== 'none') pushM('power', 'Solar arrays + drive', d.solarArea * p.solar.areal + 0.4 * d.solarArea + 4);
      if (d.rtgCount > 0) pushM('power', 'Radioisotope power units', d.rtgCount * K.rtg.massKg);
      pushM('power', 'Battery', (d.batteryWh / p.battery.whKg) * 1.1);
      pushM('power', 'Power electronics', p.pmad.massKg);
      pushM('prop', 'Engine & feed system', p.engine.massKg);
      pushM('prop', 'Propellant tanks', d.propellant * p.engine.tankFrac);
      pushM('adcs', 'Attitude control', p.acs.massKg);
      pushM('comms', 'Antenna', p.antenna.massKg);
      pushM('comms', 'Transmitter & transponder', 3 + 0.08 * d.txPower + (p.band.id === 'ka' ? 2 : 0));
      pushM('thermal', 'Insulation blankets', p.insulation.massKg * (aBody / 10));
      pushM('thermal', 'Radiator', d.radiatorArea * 5.5);
      pushM('thermal', 'Thermal control hardware', p.thermalCtrl.massKg);
      pushM('avionics', 'Flight computer', p.computer.massKg);
      pushM('avionics', 'Data recorder', p.storage.massKg);
      if (d.shielding > 0) pushM('struct', 'Electronics radiation vault', d.shielding * 5.4);
      instruments.forEach((i) => pushM('payload', i.name, i.massKg));
      const sub = items.reduce((s, x) => s + x.kg, 0);
      pushM('struct', 'Harness & cabling (6%)', sub * 0.06);
      const noStruct = sub * 1.06;
      const structKg = noStruct * p.structure.frac;
      pushM('struct', `Primary structure (${Math.round(p.structure.frac * 100)}%)`, structKg);
      dry = noStruct + structKg;
      mass = { items, dry, prop: d.propellant, wet: dry + d.propellant, adapter: 60, L, aBody };
    }
    mass.launch = mass.wet + mass.adapter;
    mass.payload = instruments.reduce((s, i) => s + i.massKg, 0);
    mass.byKey = {};
    mass.items.forEach((x) => (mass.byKey[x.key] = (mass.byKey[x.key] || 0) + x.kg));
    ev.mass = mass;

    /* ---------------- thermal ---------------- */
    const ins = p.insulation, tc = p.thermalCtrl;
    const rtgHeat = d.rtgCount * 60;
    const tMin = 263, tMax = 313 + tc.hotBonus;
    const txRF = d.txPower;
    const hotEq = P.thermalEq({ pDiss: busW + instW + txDC - txRF, dAU: sunRange[0], qPlanet: so.qHot, aRad: d.radiatorArea, epsRad: 0.85, aBody: mass.aBody, epsMli: ins.effEmit, extraW: rtgHeat });
    const opColdEq = P.thermalEq({ pDiss: busW + instW + (txDC - txRF) * duty, dAU: so.sunAU[1] || sunRange[1], qPlanet: so.qCold, aRad: d.radiatorArea, epsRad: tc.coldEps, aBody: mass.aBody, epsMli: ins.effEmit, extraW: rtgHeat });
    const survW = 25 + p.computer.powerW + 8 + p.acs.powerW * 0.5;
    const survEq = P.thermalEq({ pDiss: survW, dAU: sunRange[1], qPlanet: 0, aRad: d.radiatorArea, epsRad: tc.coldEps, aBody: mass.aBody, epsMli: ins.effEmit, extraW: rtgHeat });
    const heaterOp = P.heaterNeeded(opColdEq, tMin);
    const heaterSurv = P.heaterNeeded(survEq, tMin);
    ev.thermal = { hotT: hotEq.T, opColdT: opColdEq.T, survT: survEq.T, heaterOp, heaterSurv, tMin, tMax, hotEq, opColdEq, survEq, rtgHeat };

    /* ---------------- power budget ---------------- */
    const loads = {
      'Housekeeping & sensors': 25, 'Flight computer': p.computer.powerW, 'Data recorder': p.storage.powerW,
      'Attitude control': p.acs.powerW, 'Receiver': 8, 'Transmitter (DC)': txDC, 'Instruments': instW, 'Heaters': heaterOp,
    };
    let peak = Object.values(loads).reduce((a, b) => a + b, 0);
    // Deep-space flyby craft alternate between observing and transmitting (they cannot do both): peak = larger of the two modes
    if (isKbo) peak = Math.max(peak - txDC, peak - instW);
    const eclLoad = peak - txDC * (1 - duty);
    const sMax = so.sunAU[1] || 1;
    const genSunRaw = arrayW(sMax, yrsTotal) + rtgW(yrsTotal);
    const genSun = genSunRaw * p.pmad.xd;
    const genEcl = rtgW(yrsTotal) * p.pmad.xd;
    const T = so.periodMin * 60, Te = so.ecl * T, Td = T - Te;
    const ebatt = Math.max(0, eclLoad - genEcl) * (Te / 3600); // Wh per eclipse
    const etaRT = p.pmad.xe / p.pmad.xd;
    const required = peak + (Td > 0 ? (ebatt * 3600) / (etaRT * Td) : 0);
    const margin = genSun / required - 1;
    const battHealthEOL = Math.pow(1 - p.battery.fade, yrsTotal);
    const dod = ebatt / Math.max(1, d.batteryWh * 0.95 * battHealthEOL);
    const cyclesYr = so.ecl > 0.02 && so.periodMin > 0 ? (365.25 * 1440) / so.periodMin : 0;
    const dodMax = (() => {
      const t = { nih2: [0.4, 0.55, 0.7], liion: [0.3, 0.5, 0.7], liion_he: [0.25, 0.45, 0.65] }[p.battery.id];
      return cyclesYr > 3000 ? t[0] : cyclesYr > 300 ? t[1] : t[2];
    })();
    const launchE = (busW - p.storage.powerW + txDC * 0.3 + heaterSurv) * 1.5; // Wh until arrays deploy & sun acquisition
    const launchOk = rtgW(0) * p.pmad.xd >= busW + heaterSurv ? true : launchE <= d.batteryWh * 0.8;
    const genBOL1AU = arrayW(1, 0) + rtgW(0);
    const genCruiseMin = arrayW(sunRange[1], yrsTotal) * p.pmad.xd + rtgW(yrsTotal) * p.pmad.xd;
    ev.power = { loads, peak, eclLoad, genSun, genSunRaw, genEcl, required, margin, ebatt, dod, dodMax, cyclesYr, battHealthEOL, launchE, launchOk,
      genBOL1AU, sMax, busW, instW, txDC, survW: survW + heaterSurv, eclMin: Te / 60, periodMin: so.periodMin, genCruiseMin };

    /* ---------------- electric propulsion performance ---------------- */
    const isEP = p.engine.type === 'ep';
    let epPower = 0;
    if (isEP) {
      const dC = m.type === 'helio' ? (1 + (ORB.BODIES[m.dest].aAU)) / 2 : 1;
      const gen = (arrayW(dC, yrsTotal / 3) + rtgW(0)) * p.pmad.xd;
      epPower = clamp(gen - (busW + txDC * 0.2), 0, p.engine.pMax);
    }
    ev.ep = { power: epPower, thrustN: isEP ? P.epThrust(epPower, p.engine.isp, p.engine.eff) : 0 };

    /* ---------------- propulsion / Δv ---------------- */
    const dvItems = tr.items.slice();
    const dvBase = dvItems.reduce((s, x) => s + x.dv, 0);
    dvItems.push({ label: 'Contingency reserve (5%)', dv: dvBase * 0.05 });
    const dvReq = dvBase * 1.05;
    const dvCap = P.rocketDv(p.engine.isp, mass.wet, mass.dry);
    const propNeeded = P.propForDv(p.engine.isp, dvReq, mass.dry);
    ev.prop = { isp: p.engine.isp, dvItems, dvReq, dvCap, margin: dvCap / Math.max(dvReq, 1e-6) - 1, propNeeded };
    if (tr.ep && isEP) {
      const mdot = ev.ep.thrustN / (p.engine.isp * C.G0); // kg/s
      const propEP = mass.wet * (1 - Math.exp((-tr.epDv * 1000) / (p.engine.isp * C.G0)));
      const burnS = mdot > 0 ? propEP / mdot : Infinity;
      tr.tofD = burnS / 86400 / 0.85; // 85% thrust duty (navigation, coast arcs)
      if (m.type === 'helio') tr.tofD = Math.max(tr.tofD, (tr.hohmannTofD || 200) * 0.9);
      ev.ep.burnDays = burnS / 86400; ev.ep.propEP = propEP;
      ev.time.cruiseD = tr.tofD; ev.time.totalD = tr.tofD + tr.extraD + sciDays; ev.time.yrsTotal = ev.time.totalD / 365.25;
    }

    /* ---------------- geometry: Earth distance & light time ---------------- */
    const geo = {};
    if (m.type === 'leo') {
      const r = ORB.BODIES.earth.R + so.alt, R = ORB.BODIES.earth.R;
      geo.dMaxKm = Math.sqrt(r * r - R * R) * 0.85; geo.dMeanKm = geo.dMaxKm * 0.6; geo.dMinKm = so.alt; geo.sepMin = 180;
    } else if (m.type === 'moon') {
      geo.dMaxKm = ORB.BODIES.moon.aKmMax; geo.dMeanKm = ORB.BODIES.moon.aKm; geo.dMinKm = 356500; geo.sepMin = 180;
    } else if (m.type === 'helio') {
      const tb = ORB.BODIES[m.dest];
      let thetaArr;
      if (tr.ep) thetaArr = ((2 * Math.PI) / ((ORB.CONST.YEAR_D + tb.periodD) / 2)) * tr.tofD;
      else if (tr.type === 'ega') thetaArr = Math.PI + 2 * Math.PI * 2;
      else thetaArr = tr.nu || Math.PI;
      const thetaE = (2 * Math.PI * tr.tofD) / ORB.CONST.YEAR_D;
      tr.thetaArr = thetaArr; tr.thetaE0 = 0; tr.thetaT0 = thetaArr - (2 * Math.PI * tr.tofD) / tb.periodD;
      const g = P.earthTargetGeometry({ targetAU: tb.aAU, thetaT0: thetaArr, nT: (2 * Math.PI) / tb.periodD, thetaE0: thetaE, days: sciDays + tr.extraD });
      geo.dMaxKm = g.dMax * C.AU_KM; geo.dMeanKm = g.dMean * C.AU_KM; geo.dMinKm = g.dMin * C.AU_KM; geo.sepMin = g.sepMin; geo.series = g.series;
      geo.conjunction = g.sepMin < 3;
    } else if (m.type === 'kbo') {
      geo.dMaxKm = 46 * C.AU_KM; geo.dMeanKm = 45 * C.AU_KM; geo.dMinKm = 43 * C.AU_KM; geo.sepMin = 30;
    }
    geo.owltMeanS = geo.dMeanKm / C.C; geo.owltMaxS = geo.dMaxKm / C.C;
    ev.geo = geo;

    /* ---------------- communications ---------------- */
    const lambda = 0.299792458 / p.band.freqGHz;
    const nearEarth = m.type === 'leo';
    const ground = nearEarth ? { D: 11, tsys: p.band.id === 'ka' ? 220 : 160, name: '11 m ground station' } : { D: 34, tsys: p.band.id === 'ka' ? 45 : 30, name: '34 m deep-space antenna' };
    const gr = P.dishGain(ground.D, lambda, 0.6);
    const gt = p.antenna.D > 0 ? P.dishGain(p.antenna.D, lambda, 0.55) : p.antenna.gainDbi;
    const pl = P.pointingLoss(p.antenna.D, lambda, p.acs.pointDeg);
    const cap = p.band.capMbps * 1e6;
    const lk = (distKm, ptW = d.txPower, g = gt, ploss = pl) => P.link({ ptW, gtDbi: g, grDbi: gr, distKm, lambdaM: lambda, tsysK: ground.tsys, lossDb: 2 + p.band.lossDb, pointLossDb: ploss, capBps: cap });
    const linkMax = lk(geo.dMaxKm), linkMean = lk(geo.dMeanKm), linkMin = lk(geo.dMinKm);
    const lgaRate = P.link({ ptW: d.txPower, gtDbi: 5, grDbi: P.dishGain(ground.D, 0.299792458 / 8.4, 0.6), distKm: geo.dMaxKm, lambdaM: 0.299792458 / 8.4, tsysK: nearEarth ? 160 : 30, lossDb: 2.3, capBps: 1e6 }).rate;
    // average achievable rate over the science phase (rate ∝ 1/d², so average the rate, not the distance)
    let rateAvg = linkMean.rate;
    if (geo.series) rateAvg = geo.series.reduce((sum, x) => sum + (x.sep < 2.5 ? 0 : lk(x.d * C.AU_KM).rate), 0) / geo.series.length;
    const dailyMean = (rateAvg * d.dsnHours * 3600 * p.band.avail) / 1e9; // Gbit/day (incl. weather availability)
    const dailyMin = (linkMax.rate * d.dsnHours * 3600 * p.band.avail) / 1e9;
    let genDay = instruments.reduce((s, i) => s + i.rate * so.duty, 0);
    ev.comms = { lambda, ground, gt, gr, pointLossDb: pl, rateAvg, rateMax: linkMax.rate, rateMean: linkMean.rate, rateMin: linkMin.rate, linkMax, linkMean,
      dailyMean, dailyMin, genDay, lgaRate, lk, owltMeanS: geo.owltMeanS, owltMaxS: geo.owltMaxS };
    // Data return
    let returnRatio = genDay > 0 ? clamp(dailyMean / genDay, 0, 1) : 1;
    const bufferOk = p.storage.gbit >= genDay * (nearEarth ? 1.0 : 1.5);
    if (isKbo) {
      const flybyData = instruments.filter((i) => i.imaging || i.optical).reduce((s, i) => s + i.rate * 0.6, 0) * so.res;
      const stored = Math.min(flybyData, p.storage.gbit);
      const downDays = dailyMean > 0 ? stored / dailyMean : Infinity;
      ev.comms.flybyData = flybyData; ev.comms.flybyStored = stored; ev.comms.flybyDownDays = downDays;
      returnRatio = flybyData > 0 ? (stored / flybyData) * clamp(sciDays / downDays, 0, 1) : 1;
    }
    ev.comms.returnRatio = returnRatio; ev.comms.bufferOk = bufferOk;

    /* ---------------- radiation ---------------- */
    const shieldMm = p.structure.shieldMm + d.shielding;
    const sf = E.shieldFactor(shieldMm);
    const cruiseYrs = tr.tofD / 365.25, sciYrs = (sciDays + tr.extraD) / 365.25;
    let doseRaw = ORB.ENV.cruise.rad * cruiseYrs + (so.env ? so.env.rad * so.radMult * (m.id === 'jupiter' ? 1 : 1) : 4) * sciYrs;
    if (tr.jupiter) doseRaw += 15000 / Math.pow(d.trajectory.rpRJ || 32, 2);
    const dose = doseRaw * sf;
    ev.radiation = { shieldMm, factor: sf, doseRaw, dose, tid: p.computer.tidKrad, ratio: dose / p.computer.tidKrad, ratePerYr: (so.env ? so.env.rad * so.radMult : 4) * sf };

    /* ---------------- launch vehicle ---------------- */
    const lv = p.lv;
    let capacity;
    if (tr.mode === 'leo') capacity = P.lvCapacityLEO(lv, so.alt, so.incDeg, p.site.lat) * (d.kick ? 0.97 : 1);
    else capacity = P.lvCapacityC3(lv, tr.c3, d.kick, p.site.lat);
    const envelope = Math.max(mass.L * 1.1, p.antenna.D + 0.25, d.rtgCount > 0 ? mass.L + 0.5 : 0, Math.sqrt(Math.max(d.solarArea, 0)) * (p.solar.id === 'flex' ? 0.35 : 0.55));
    ev.lv = { lv, capacity, margin: capacity / mass.launch - 1, envelope, fairingOk: envelope <= lv.fairingUse, rel: lv.rel * (d.kick ? ORB.KICK_STAGE.rel : 1) };

    /* ---------------- cost ---------------- */
    const ci = [];
    const pushC = (label, M, group) => ci.push({ label, M, group });
    if (d.solarArea > 0 && p.solar.id !== 'none') pushC('Solar arrays', d.solarArea * p.solar.costM2 + 2, 'hw');
    if (d.rtgCount > 0) pushC('Radioisotope power + launch approval', d.rtgCount * K.rtg.cost + K.rtg.approval, 'hw');
    pushC('Battery', d.batteryWh * p.battery.costWh + 1, 'hw');
    pushC('Power electronics', p.pmad.cost, 'hw');
    pushC('Propulsion & propellant', p.engine.cost + d.propellant * p.engine.propCostKg + d.propellant * p.engine.tankFrac * 0.01, 'hw');
    pushC('Attitude control', p.acs.cost, 'hw');
    pushC('Telecommunications', p.antenna.cost + 3 + 0.1 * d.txPower + p.band.cost, 'hw');
    pushC('Thermal control', ins.cost + d.radiatorArea * 0.5 + tc.cost, 'hw');
    const structKg = mass.items.filter((x) => x.label.startsWith('Primary structure'))[0].kg;
    pushC('Structure & shielding', structKg * p.structure.costKg + d.shielding * 0.3, 'hw');
    pushC('Avionics', p.computer.cost + p.storage.cost, 'hw');
    instruments.forEach((i) => pushC(i.name, i.cost, 'payload'));
    pushC('Bus integration & flight software', 20, 'hw');
    const hw = ci.reduce((s, x) => s + x.M, 0);
    pushC('Assembly, test & project management (30%)', hw * 0.3, 'wrap');
    pushC(`Launch: ${lv.name}${d.kick ? ' + kick stage' : ''}`, lv.cost + (d.kick ? ORB.KICK_STAGE.cost : 0), 'launch');
    const cruiseF = m.cruiseOpsFactor || 0.4;
    const opsDays = sciDays + tr.extraD + tr.tofD * cruiseF;
    pushC('Mission operations team', m.opsPerDay * opsDays, 'ops');
    pushC(`${m.dsn.label} (${d.dsnHours} h/day)`, d.dsnHours * m.dsn.costH * (sciDays + tr.extraD + tr.tofD * 0.25), 'ops');
    const total = ci.reduce((s, x) => s + x.M, 0);
    const budget = opts.budget || m.budget * diff.budgetMult;
    ev.cost = { items: ci, total, budget, remaining: budget - total, hw };

    /* ---------------- reliability ---------------- */
    const yrs = ev.time.yrsTotal;
    const radPenalty = Math.exp(-Math.max(0, ev.radiation.ratio - 0.75) * 3);
    const rel = [
      ['Launch vehicle', ev.lv.rel],
      ['Solar array deployment', d.solarArea > 0 && p.solar.id !== 'none' ? p.solar.deployRel : 1],
      ['Solar arrays', Math.pow(p.solar.rel, yrs)],
      ['Radioisotope power', d.rtgCount > 0 ? Math.pow(K.rtg.rel, yrs) : 1],
      ['Battery', Math.pow(p.battery.rel, yrs)],
      ['Power electronics', Math.pow(p.pmad.rel, yrs)],
      ['Propulsion', Math.pow(p.engine.rel, Math.max(1, yrs * 0.5))],
      ['Attitude control', Math.pow(p.acs.rel, yrs)],
      ['Flight computer (incl. radiation)', Math.pow(p.computer.rel, yrs) * radPenalty],
      ['Thermal control', Math.pow(tc.rel, yrs)],
      ['Structure', Math.pow(p.structure.rel, yrs)],
    ];
    if (m.id === 'mars' && so.opt.aerobrake) rel.push(['Aerobraking campaign', p.structure.id === 'reinforced' ? 0.985 : p.structure.id === 'cfrp' ? 0.95 : 0.97]);
    const relMission = rel.reduce((s, x) => s * x[1], 1);
    ev.reliability = { items: rel.map(([label, r]) => ({ label, r })), mission: relMission };

    /* ---------------- science potential ---------------- */
    const cat = m.id;
    const hasHGA = p.antenna.D >= 1.5;
    const sciList = instruments.map((i) => {
      let q = 1; const notes = [];
      if (i.imaging) { q *= p.acs.pointQ; if (p.acs.pointQ < 1) notes.push(`pointing ×${p.acs.pointQ}`); }
      if (i.imaging && so.res !== 1) { q *= so.res; notes.push(`resolution ×${so.res.toFixed(2)}`); }
      if (i.optical && so.optical !== 1) { q *= so.optical; notes.push(`lighting ×${so.optical}`); }
      if (i.coldNeeded && ev.thermal.hotT > 300) { q *= 0.75; notes.push('warm detector ×0.75'); }
      if (m.id === 'jupiter' && i.optical && shieldMm < 8) { q *= 0.85; notes.push('radiation noise ×0.85'); }
      return { id: i.id, inst: i, rel: i.rel_[cat] ?? 0.3, q, notes, rate: i.rate * so.duty };
    });
    if (hasHGA && (m.id === 'asteroid' || m.id === 'jupiter' || m.id === 'mars' || m.id === 'moon')) {
      const q = p.acs.id === 'coldgas' ? 0.5 : 1;
      sciList.push({ id: 'radio', inst: ORB.RADIO_SCIENCE, rel: m.id === 'asteroid' || m.id === 'jupiter' ? 1 : 0.5, q, notes: q < 1 ? ['coarse attitude ×0.5'] : [], rate: 0, radio: true });
    }
    ev.sciList = sciList;
    const radioFactor = clamp(d.dsnHours / 8, 0.25, 1.2);
    const obsDays = (s) => {
      if (s.radio) return sciDays * so.duty * radioFactor;
      if (isKbo) {
        const isFly = s.inst.imaging || s.inst.optical;
        if (isFly) return 4 * returnRatio;
        if (['particle', 'mag', 'rad'].includes(s.id)) return tr.tofD * 0.3 * 0.4; // planned: hibernation with yearly field-measurement campaigns
        return 0;
      }
      return sciDays * so.duty * returnRatio * (bufferOk ? 1 : 0.85);
    };
    const objectives = m.objectives.map((o) => {
      let acc = 0; const contrib = [];
      sciList.filter((s) => o.inst.includes(s.id)).forEach((s) => { const v = obsDays(s) * s.q; acc += v; contrib.push({ id: s.id, v }); });
      let comp = clamp(acc / o.needDays, 0, 1);
      if (o.coverage) comp *= so.coverage;
      return { ...o, expected: comp, contrib, acc };
    });
    const sciIndex = objectives.reduce((s, o) => s + o.weight * o.expected, 0) * 100;
    const valuePts = sciList.reduce((s, x) => s + x.inst.value * x.rel * x.q * (1 - Math.exp(-obsDays(x) / ((m.duration.ref * 0.5) * (isKbo && (x.inst.imaging || x.inst.optical) ? 0.01 : 1)))), 0);
    ev.science = { objectives, index: sciIndex, valuePts, obsDays, radioFactor };

    /* ---------------- issues ---------------- */
    const I = ev.issues;
    const issue = (sev, sys, title, why, fix) => I.push({ sev, sys, title, why, fix });
    const pct = (x) => `${(x * 100).toFixed(0)}%`;
    const fm = (x) => `$${x.toFixed(0)} M`;
    // budget
    if (ev.cost.remaining < 0) issue('fail', 'budget', 'Budget exceeded', `Total mission cost ${fm(total)} exceeds the ${fm(budget)} cap by ${fm(-ev.cost.remaining)}. The review board will not fund it as-is.`, 'Cut expensive items: a smaller launcher, fewer/cheaper instruments, shorter operations or fewer ground-station hours.');
    else if (ev.cost.remaining < budget * 0.03) issue('warn', 'budget', 'No financial reserve', `Only ${fm(ev.cost.remaining)} remains. Real projects keep reserves for problems that appear during development and flight.`, 'Free up ~5–10% of the budget so operations can respond to anomalies.');
    // launch mass
    if (ev.lv.margin < 0) issue('fail', 'launch', 'Spacecraft too heavy for the launch vehicle', `Launch mass ${mass.launch.toFixed(0)} kg exceeds ${lv.name}'s capability of ${capacity.toFixed(0)} kg for this ${tr.mode === 'leo' ? 'orbit' : `departure energy (C3 = ${tr.c3.toFixed(1)} km²/s²)`}.`, 'Choose a bigger rocket, reduce propellant or hardware mass, or pick a lower-energy trajectory.');
    else if (ev.lv.margin < 0.1) issue('warn', 'launch', 'Thin launch mass margin', `Only ${pct(ev.lv.margin)} launch margin. Spacecraft mass typically grows during development.`, 'Aim for ≥10% margin.');
    if (!ev.lv.fairingOk) issue('fail', 'launch', 'Spacecraft does not fit in the fairing', `Stowed envelope ≈ ${ev.lv.envelope.toFixed(1)} m but ${lv.name}'s fairing allows ${lv.fairingUse} m.`, 'Use a smaller antenna / roll-out arrays, or a launcher with a wider fairing.');
    if (d.kick && tr.mode === 'leo') issue('warn', 'launch', 'Kick stage is unnecessary', 'A kick stage adds energy for escape trajectories; for low Earth orbit it only costs money and mass.', 'Remove the kick stage.');
    // power
    if (margin < 0) issue('fail', 'power', 'Insufficient power generation', `Worst-case delivered power ${genSun.toFixed(0)} W vs ${required.toFixed(0)} W required (incl. ${loads.Heaters.toFixed(0)} W heaters${so.ecl > 0.02 ? ' and battery recharge after eclipse' : ''}) at ${sMax.toFixed(2)} AU, end of life. Sunlight there is ${(1 / (sMax * sMax) * 100).toFixed(0)}% of Earth's.`, 'Add array area or radioisotope power, use more efficient cells, or reduce instrument/transmitter loads.');
    else if (margin < 0.15) issue('warn', 'power', 'Low power margin', `Power margin ${pct(margin)} at end of life. Degradation, dust or a failed string could push you negative.`, 'Target 15–30% margin.');
    else if (margin > 1.2 && genBOL1AU > 600) issue('info', 'power', 'Power system may be oversized', `Margin ${pct(margin)} — you are carrying (and paying for) a lot of unused capability.`, 'Trim array area to save mass and cost.');
    if (!launchOk) issue('fail', 'power', 'Battery cannot survive launch', `From liftoff until the arrays deploy (~1.5 h) the spacecraft needs ~${launchE.toFixed(0)} Wh, but the battery provides only ${(d.batteryWh * 0.8).toFixed(0)} Wh usable.`, 'Increase battery capacity.');
    if (so.ecl > 0.02) {
      if (dod > 0.95) issue('fail', 'power', 'Battery too small for eclipses', `Each ${(Te / 60).toFixed(0)}-minute eclipse drains ${ebatt.toFixed(0)} Wh — ${pct(dod)} of the end-of-life battery. It would run flat in shadow.`, 'Increase battery capacity or reduce loads during eclipse.');
      else if (dod > dodMax) issue('warn', 'power', 'Deep battery cycling', `Depth of discharge ${pct(dod)} exceeds the ${pct(dodMax)} recommended for ~${Math.round(cyclesYr).toLocaleString()} cycles/year. The battery will lose capacity quickly.`, 'Add capacity to keep DoD lower.');
    }
    // thermal
    if (ev.thermal.hotT > tMax + 10) issue('fail', 'thermal', 'Spacecraft overheats', `Hot case ${(ev.thermal.hotT - 273.15).toFixed(0)} °C exceeds the ${(tMax - 273.15).toFixed(0)} °C limit by more than 10 K. Electronics would fail.`, 'Increase radiator area or use loop heat pipes.');
    else if (ev.thermal.hotT > tMax) issue('warn', 'thermal', 'Running hot', `Hot case ${(ev.thermal.hotT - 273.15).toFixed(0)} °C is above the ${(tMax - 273.15).toFixed(0)} °C limit. Expect thermal stress and derating.`, 'Add radiator area.');
    if (heaterOp > 0.25 * Math.max(genSun, 1)) issue('warn', 'thermal', 'Heaters consume a large share of power', `Keeping electronics above −10 °C needs ${heaterOp.toFixed(0)} W of heaters (${pct(heaterOp / Math.max(genSun, 1))} of available power).`, 'Use louvers, better insulation or a smaller radiator.');
    // propulsion
    if (isEP && !tr.ep && m.type !== 'leo') issue('fail', 'prop', 'Electric propulsion cannot do this trajectory', 'Electric thrusters produce a fraction of a newton — they cannot perform the short, powerful braking burns an impulsive trajectory requires.', 'Select a low-thrust trajectory or a chemical engine.');
    if (tr.ep && !isEP) issue('fail', 'prop', 'Low-thrust trajectory needs electric propulsion', 'A spiral trajectory needs continuous thrust for months; a chemical engine would require impossible amounts of propellant.', 'Select a Hall or ion thruster, or a ballistic trajectory.');
    if (tr.ep && isEP && epPower < 400) issue('fail', 'prop', 'Not enough power for electric propulsion', `Only ${epPower.toFixed(0)} W available for thrusting — the engine needs kilowatts.`, 'Add solar array area.');
    if (tr.ep && isEP && tr.tofD > 365 * 5) issue('warn', 'prop', 'Very long low-thrust cruise', `Thrusting would take ${(tr.tofD / 365.25).toFixed(1)} years with ${epPower.toFixed(0)} W.`, 'More power gives more thrust.');
    if (ev.prop.margin < 0) issue('fail', 'prop', 'Not enough Δv', `The spacecraft can deliver ${(dvCap * 1000).toFixed(0)} m/s but the mission needs ${(dvReq * 1000).toFixed(0)} m/s. It would run out of propellant ${m.type === 'leo' ? 'before the end of the mission' : 'before completing orbit insertion'}.`, `Carry ≥ ${propNeeded.toFixed(0)} kg propellant, use a higher-Isp engine, or pick a cheaper trajectory/orbit.`);
    else if (ev.prop.margin < 0.1) issue('warn', 'prop', 'Thin Δv margin', `Δv margin ${pct(ev.prop.margin)}. Launch dispersions or extra corrections could exhaust it.`, 'Add 5–10% more propellant.');
    else if (ev.prop.margin > 1.0 && d.propellant > 200) issue('info', 'prop', 'Excess propellant', `You carry ${pct(ev.prop.margin)} more Δv than needed — extra mass the rocket must lift.`, 'Reduce propellant to save launch mass.');
    // comms
    if (linkMax.rate < 100) issue('fail', 'comms', 'No usable radio link at maximum distance', `At ${(geo.dMaxKm / C.AU_KM).toFixed(2)} AU the link supports only ${linkMax.rate.toFixed(0)} bit/s — not even basic telemetry.`, 'Use a high-gain antenna, more transmitter power, or Ka-band.');
    else if (returnRatio < 0.35) issue('warn', 'comms', 'Most science data will never reach Earth', `Instruments generate ${genDay.toFixed(2)} Gbit/day but the link returns ${dailyMean.toFixed(2)} Gbit/day on average (${pct(returnRatio)}). Data left on board doesn't count.`, 'Bigger antenna, more transmitter power, Ka-band or more ground-station hours.');
    if (!bufferOk && !isKbo) issue('warn', 'comms', 'Recorder too small', `${p.storage.gbit} Gbit cannot buffer ~${(genDay * (nearEarth ? 1 : 1.5)).toFixed(0)} Gbit generated between contacts.`, 'Choose a larger data recorder.');
    if (isKbo && ev.comms.flybyData > p.storage.gbit) issue('warn', 'comms', 'Flyby data overflows the recorder', `The encounter generates ~${ev.comms.flybyData.toFixed(0)} Gbit but only ${p.storage.gbit} Gbit can be stored. The rest is lost forever.`, 'Choose a larger recorder.');
    if (isKbo && ev.comms.flybyDownDays > sciDays) issue('warn', 'comms', 'Downlink phase too short', `Returning the stored flyby data needs ~${ev.comms.flybyDownDays.toFixed(0)} days at ${(linkMean.rate / 1000).toFixed(2)} kbit/s.`, 'Extend the downlink phase, add transmitter power or a larger dish.');
    if (lgaRate < 10 && !nearEarth) issue('info', 'comms', 'Safe-mode communication is very slow', `If the spacecraft enters safe mode and points its low-gain antenna at Earth, only ~${lgaRate.toFixed(1)} bit/s gets through at maximum distance. Recovery will be slow.`, 'Higher-autonomy computers recover from faults without waiting on Earth.');
    if (geo.conjunction) issue('info', 'comms', 'Solar conjunction during science', 'The Sun will pass between Earth and the spacecraft; expect a ~2-week communications blackout.', 'Plan for it: larger recorder or onboard autonomy.');
    // payload
    if (instruments.length === 0) issue('fail', 'payload', 'No scientific instruments', 'A science mission without instruments returns no science.', 'Select instruments that match the objectives.');
    objectives.forEach((o) => { if (!o.contrib.length) issue('warn', 'payload', `Objective not addressed: ${o.name}`, `None of your instruments can measure this (${o.inst.map((x) => (ORB.INSTRUMENT_BY_ID[x] || ORB.RADIO_SCIENCE).short).join(', ')} would).`, 'Add a suitable instrument.'); });
    sciList.filter((s) => s.rel < 0.35 && !s.radio).forEach((s) => issue('warn', 'payload', `${s.inst.short} is a poor match for this destination`, `Scientific relevance here is only ${pct(s.rel)}. ${s.inst.why}`, 'Swap for an instrument that serves the objectives.'));
    if (m.type === 'leo' && so.coverage < 1) issue('warn', 'traj', 'Incomplete global coverage', `A ${so.incDeg}° orbit never flies over high latitudes; objectives requiring global coverage are capped at ${pct(so.coverage)}.`, 'Use a sun-synchronous (near-polar) orbit.');
    if (m.type === 'moon' && so.coverage < 1) issue('warn', 'traj', 'Polar regions not visible', 'An equatorial lunar orbit never passes over the poles where water ice is expected.', 'Choose a polar orbit.');
    // trajectory
    if (!tr.feasible) issue('fail', 'traj', 'Trajectory infeasible', tr.reason, 'Adjust the trajectory settings.');
    if (tr.tooLong) issue('fail', 'traj', 'Travel time exceeds mission limit', `Arrival after ${(tr.tofD / 365.25).toFixed(1)} years exceeds the ${m.maxTravelYears}-year requirement.`, 'Increase launch C3 or use a gravity assist.');
    // radiation
    if (ev.radiation.ratio > 1) issue('fail', 'rad', 'Electronics will exceed radiation tolerance', `Expected dose ${ev.radiation.dose.toFixed(0)} krad vs. ${p.computer.tidKrad} krad tolerance of the ${p.computer.name}.`, 'Add a shielded vault, use a radiation-hardened computer, or shorten exposure.');
    else if (ev.radiation.ratio > 0.6) issue('warn', 'rad', 'High radiation exposure', `Dose ${ev.radiation.dose.toFixed(0)} krad is ${pct(ev.radiation.ratio)} of tolerance — expect upsets and degradation late in the mission.`, 'More shielding or a more tolerant computer.');
    // operations duration
    if (d.duration < m.duration.min) issue('warn', 'ops', 'Science phase shorter than required', `Minimum ${m.duration.min} days.`, 'Extend the science phase.');
    // reliability
    if (relMission < 0.65) issue('warn', 'rel', 'Low estimated reliability', `Estimated probability that all critical systems survive: ${pct(relMission)}.`, 'Use more reliable/redundant components or shorten the mission.');
    if (sciIndex < 40 && instruments.length > 0) issue('warn', 'payload', 'Low expected science return', `Projected objective completion is only ${sciIndex.toFixed(0)}%.`, 'Match instruments to objectives and make sure the data can get home.');

    /* ---------------- readiness checks ---------------- */
    const status = (sys) => (I.some((x) => x.sys === sys && x.sev === 'fail') ? 'fail' : I.some((x) => x.sys === sys && x.sev === 'warn') ? 'warn' : 'ok');
    const checks = [
      { sys: 'budget', name: 'Budget', detail: `${fm(total)} of ${fm(budget)}` },
      { sys: 'launch', name: 'Launch vehicle compatibility', detail: `${mass.launch.toFixed(0)} / ${capacity.toFixed(0)} kg · fairing ${ev.lv.envelope.toFixed(1)} / ${lv.fairingUse} m` },
      { sys: 'power', name: 'Power balance & battery', detail: `margin ${pct(margin)}${so.ecl > 0.02 ? ` · DoD ${pct(dod)}` : ''}` },
      { sys: 'thermal', name: 'Thermal control', detail: `${(ev.thermal.hotT - 273.15).toFixed(0)} °C hot · ${heaterOp.toFixed(0)} W heaters` },
      { sys: 'prop', name: 'Propulsion capability', detail: `${(dvCap * 1000).toFixed(0)} / ${(dvReq * 1000).toFixed(0)} m/s` },
      { sys: 'comms', name: 'Communications', detail: `${fmtRate(linkMax.rate)} worst · ${pct(returnRatio)} data return` },
      { sys: 'payload', name: 'Payload & objectives', detail: `${instruments.length} instruments · ${sciIndex.toFixed(0)}% projected` },
      { sys: 'traj', name: 'Orbit & trajectory feasibility', detail: tr.feasible ? `${(ev.time.cruiseD).toFixed(0)} d cruise` : 'infeasible' },
      { sys: 'rad', name: 'Radiation tolerance', detail: `${ev.radiation.dose.toFixed(0)} / ${p.computer.tidKrad} krad` },
      { sys: 'rel', name: 'Reliability', detail: `${pct(relMission)} estimated` },
    ].map((c) => ({ ...c, status: status(c.sys) }));
    const fails = checks.filter((c) => c.status === 'fail').length;
    const warns = I.filter((x) => x.sev === 'warn').length;
    const score = clamp(100 - fails * 18 - warns * 4 - (relMission < 0.8 ? 5 : 0), 0, 100);
    ev.readiness = { checks, fails, warns, score: fails ? Math.min(score, 49) : score, go: fails === 0, blocking: !ev.lv.fairingOk };
    return ev;
  };

  function fmtRate(bps) {
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(bps >= 1e7 ? 0 : 1)} Mbit/s`;
    if (bps >= 1e3) return `${(bps / 1e3).toFixed(bps >= 1e4 ? 0 : 1)} kbit/s`;
    return `${bps.toFixed(0)} bit/s`;
  }
  E.fmtRate = fmtRate;
})();
