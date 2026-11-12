/* ORBITAL — mission simulator
 * A time-stepped simulation of the spacecraft from separation to end of mission.
 * Driven entirely by the evaluated design (ev): power, thermal, comms, propellant, radiation and
 * science all use the same models as the design studio. Anomalies are hazard-rate events whose
 * rates depend on the hardware you chose and the environment you are in.
 */
(function () {
  const ORB = window.ORB;
  const P = ORB.phys, C = ORB.CONST;
  const clamp = P.clamp;
  const GAMEPLAY_RATE = 8; // anomaly rates are accelerated for gameplay (documented in Library)

  const fmtMET = (h) => {
    const d = Math.floor(h / 24), hh = Math.floor(h % 24), mm = Math.floor((h * 60) % 60);
    return `T+${d}d ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  ORB.fmtMET = fmtMET;

  class Sim {
    constructor(mission, design, opts, saved) {
      this.m = mission; this.d = design; this.opts = opts || {};
      this.ev = ORB.engine.evaluate(mission, design, { difficulty: this.opts.difficulty, budget: this.opts.budget });
      this.p = this.ev.parts;
      if (saved) { this.s = saved; return; }
      const ev = this.ev, d = design;
      const s = (this.s = {
        t: 0, phase: 'deploy', rng: (this.opts.seed >>> 0) || 12345,
        prop: d.propellant, soc: d.batteryWh * 0.9, battCap: d.batteryWh, arrayHealth: 1, arraysDeployed: false,
        temp: 288, dose: 0, compHealth: 1, wheels: this.p.acs.wheels, acsMode: 'nominal',
        inst: {}, storageUsed: 0, dataLost: 0, radioObs: 0,
        safe: false, safeReason: '', safeUntil: 0, powerSaver: false, powerSaverUntil: 0, heatersOn: true, nonEssentialOff: false,
        dsnHours: d.dsnHours, cruiseScience: this.m.type === 'kbo', hibernate: false,
        dvDone: 0, epHelioDone: false, inserted: false, sciStart: null, sciEnd: null, sciHours: 0, aeroEnd: null,
        tcm: [], tcmPenalty: 0, navError: 1, nextHazard: 0, cooldownUntil: 0,
        events: [], log: [], discoveries: [], decisions: [], opsScore: 0, extraCost: 0, pending: [], active: null, queue: [],
        hist: { t: [], soc: [], gen: [], load: [], temp: [], prop: [], stored: [], returned: [], dist: [], rate: [], sci: [] },
        histNext: 0, flags: {}, outcome: null, gen: 0, load: 0, rateNow: 0, distKm: 0, sunAU: 1, conj: false, owlt: 0,
        thetaSc: 0, rSc: 1, posX: 1, posY: 0, epPower: 0, eclDod: 0, shortfallDv: 0, autoDelegate: false, timeLossH: 0,
      });
      ev.parts && design.instruments.forEach((id) => {
        const sl = ev.sciList.find((x) => x.id === id);
        s.inst[id] = { on: true, health: 1, failed: false, stored: 0, storedQ: 0, returned: 0, returnedQ: 0, gen: 0, q: sl ? sl.q : 1, rel: sl ? sl.rel : 0.5 };
      });
      // cruise instruments off unless they are field/particle instruments on a cruise-science mission
      if (this.m.type !== 'leo') Object.entries(s.inst).forEach(([id, st]) => { st.cruise = ['particle', 'mag', 'rad'].includes(id); });
      if (this.m.type === 'kbo') s.dlPriority = design.instruments.filter((id) => { const sp = ORB.INSTRUMENT_BY_ID[id]; return sp && (sp.imaging || sp.optical); });
      this.horizonH = (ev.time.totalD + 60) * 24;
      s.histEvery = Math.max(1, this.horizonH / 900);
      this.planTCMs();
      const L = this.opts.launch || {};
      s.shortfallDv = L.shortfallDv || 0;
      this.log('Spacecraft separation confirmed. Mission elapsed time started.', 'good');
      if (L.anomalyNote) this.log(L.anomalyNote, 'warn');
      // a budget overrun is paid for by cutting operations: fewer ground-station hours
      if (ev.cost.remaining < 0) {
        const opsCost = ev.cost.items.filter((x) => x.group === 'ops').reduce((a, x) => a + x.M, 0);
        const cut = clamp(-ev.cost.remaining / Math.max(1, opsCost), 0, 0.7);
        s.dsnHours = Math.max(this.m.dsn.min, +(design.dsnHours * (1 - cut)).toFixed(1));
        s.flags.fundingCut = cut;
        this.log(`FUNDING SHORTFALL: the ${ORB.ui ? ORB.ui.money(-ev.cost.remaining) : -ev.cost.remaining.toFixed(0) + ' M'} overrun is covered by cutting operations — ground-station time reduced to ${s.dsnHours} h/day.`, 'bad');
      }
    }

    // ---------------------------------------------------------- helpers
    rand() { let a = (this.s.rng = (this.s.rng + 0x6d2b79f5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    log(msg, level = 'info') { this.s.log.push({ t: this.s.t, msg, level }); if (this.s.log.length > 400) this.s.log.shift(); }
    get days() { return this.s.t / 24; }
    get yrs() { return this.s.t / 8766; }
    get massNow() { return this.ev.mass.dry + this.s.prop; }
    burn(dvKms, label) {
      const isp = this.p.engine.isp;
      const m0 = this.massNow;
      const need = m0 * (1 - Math.exp((-dvKms * 1000) / (isp * C.G0)));
      if (need <= this.s.prop) { this.s.prop -= need; return 1; }
      const got = P.rocketDv(isp, m0, this.ev.mass.dry);
      this.s.prop = 0;
      if (label) this.log(`${label}: propellant exhausted after ${(got * 1000).toFixed(0)} of ${(dvKms * 1000).toFixed(0)} m/s.`, 'bad');
      return got / dvKms;
    }
    planTCMs() {
      const tr = this.ev.traj, s = this.s;
      const tcmItem = tr.items.find((x) => /correction/i.test(x.label));
      const total = tcmItem ? tcmItem.dv : 0.02;
      const T = this.ev.time.cruiseD;
      if (this.m.type === 'leo' || tr.ep) return;
      const fr = this.m.type === 'kbo' ? [0.02, 0.2, 0.6, 0.97] : this.m.type === 'moon' && tr.type === 'direct' ? [0.2, 0.75] : [0.04, 0.45, 0.92];
      s.tcm = fr.map((f, i) => ({ at: Math.max(6, T * f * 24), base: total / fr.length, done: false, n: i + 1 }));
    }
    get navFactor() { return { coldgas: 1.6, rw: 1.0, precision: 0.8 }[this.p.acs.id] * (this.p.computer.autonomy === 3 ? 0.9 : 1); }

    // ---------------------------------------------------------- geometry
    geometry() {
      const m = this.m, tr = this.ev.traj, s = this.s, tD = this.days;
      const nE = (2 * Math.PI) / C.YEAR_D;
      const thetaE = nE * tD;
      s.earthX = Math.cos(thetaE); s.earthY = Math.sin(thetaE);
      if (m.type === 'leo' || m.type === 'moon') {
        s.sunAU = 1; s.conj = false;
        if (m.type === 'leo') { s.distKm = this.ev.geo.dMeanKm; s.rSc = 1; }
        else {
          const T = this.ev.time.cruiseD * 24;
          let r;
          if (s.phase === 'cruise') {
            const f = tr.ep ? clamp(s.dvDone / Math.max(tr.epDv, 1e-6), 0, 1) : clamp(s.t / T, 0, 1);
            if (tr.type === 'blt') r = 6578 + (384400 - 6578) * f + 1.1e6 * Math.sin(Math.PI * f);
            else if (tr.ep) r = 24000 + (384400 - 24000) * f;
            else r = 6578 + (384400 - 6578) * (1 - Math.cos(Math.PI * f)) / 2;
            s.moonF = f;
          } else r = 384400;
          s.distKm = r;
        }
        return;
      }
      const tb = m.type === 'kbo' ? ORB.BODIES.halcyon : ORB.BODIES[m.dest];
      const nT = tb.periodD ? (2 * Math.PI) / tb.periodD : 0;
      const thetaT = (tr.thetaT0 || 0) + nT * tD;
      s.targetX = tb.aAU * Math.cos(thetaT); s.targetY = tb.aAU * Math.sin(thetaT);
      let x, y;
      if (s.phase === 'cruise' || s.phase === 'deploy') {
        if (m.type === 'kbo') {
          const path = tr.path; let i = 1;
          while (i < path.length - 1 && path[i].t < tD) i++;
          const a = path[i - 1], b = path[i], f = clamp((tD - a.t) / Math.max(1e-6, b.t - a.t), 0, 1);
          x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f;
        } else if (tr.ep) {
          const helio = tr.items[0].dv;
          const f = clamp(s.dvDone / helio, 0, 1);
          const r = 1 + (tb.aAU - 1) * (f * f * (3 - 2 * f));
          s.thetaSc = (s.thetaSc || 0) + 0; // advanced in step
          x = r * Math.cos(s.thetaSc); y = r * Math.sin(s.thetaSc);
        } else if (tr.type === 'ega' && tD < 730) {
          const pos = P.ellipsePos(1.5874, 0.37, tD * 86400);
          x = pos.r * Math.cos(pos.theta); y = pos.r * Math.sin(pos.theta);
        } else {
          const t0 = tr.type === 'ega' ? 730 : 0;
          const base = tr.base;
          const pos = P.ellipsePos(base.a, base.e, (tD - t0) * 86400);
          const rot = tr.type === 'ega' ? 0 : 0;
          x = pos.r * Math.cos(pos.theta + rot); y = pos.r * Math.sin(pos.theta + rot);
        }
      } else if (m.type === 'kbo') {
        const end = tr.path[tr.path.length - 1];
        const ang = Math.atan2(end.y, end.x);
        const rr = Math.hypot(end.x, end.y) + ((tr.vinfArr * 86400) / C.AU_KM) * Math.max(0, tD - this.ev.time.cruiseD);
        x = rr * Math.cos(ang); y = rr * Math.sin(ang);
        s.targetX = end.x; s.targetY = end.y;
      } else { x = s.targetX; y = s.targetY; }
      s.posX = x; s.posY = y;
      s.sunAU = Math.max(0.3, Math.hypot(x, y));
      const dx = x - s.earthX, dy = y - s.earthY, dAU = Math.hypot(dx, dy);
      s.distKm = Math.max(dAU * C.AU_KM, ORB.BODIES.earth.R + 300);
      const cosSep = (-s.earthX * dx - s.earthY * dy) / Math.max(dAU, 1e-9);
      s.sepDeg = (Math.acos(clamp(cosSep, -1, 1)) * 180) / Math.PI;
      s.conj = s.sepDeg < 2.5 && dAU > 0.2;
    }

    // ---------------------------------------------------------- power, thermal, comms helpers
    instruments() { return Object.entries(this.s.inst).map(([id, st]) => ({ id, st, spec: ORB.INSTRUMENT_BY_ID[id] })); }
    instActive(st, id) {
      const s = this.s;
      if (st.failed || !st.on || s.safe || s.powerSaver) return false;
      if (s.phase === 'science' || s.phase === 'downlink') return this.m.type === 'kbo' ? ['particle', 'mag', 'rad'].includes(id) : true;
      if (s.phase === 'encounter') return true;
      if (s.phase === 'cruise' && s.cruiseScience && st.cruise && !s.hibernate) return true;
      if (s.phase === 'aerobraking') return false;
      return false;
    }
    loads() {
      const p = this.p, s = this.s, ev = this.ev;
      const base = 25 + p.computer.powerW + p.storage.powerW + 8 + p.acs.powerW * (s.safe ? 0.5 : 1) - (s.nonEssentialOff ? 15 : 0);
      let inst = 0;
      this.instruments().forEach(({ id, st, spec }) => { if (this.instActive(st, id)) inst += spec.powerW; });
      if (s.flags.eclipseInstOff && ['science', 'commission'].includes(s.phase)) inst *= 1 - ev.orbit.ecl;
      const transmitting = this.m.type === 'kbo' && s.phase === 'encounter' ? 0 : 1;
      const duty = clamp(s.dsnHours / 24, 0, 1) * (s.conj ? 0 : 1);
      const tx = ev.power.loads['Transmitter (DC)'] * duty * transmitting * (this.m.type === 'kbo' && inst > 0 && s.phase !== 'cruise' ? 0.5 : 1);
      return { base, inst, tx, duty };
    }
    thermal(pDiss, dAU, qPlanet) {
      const ev = this.ev, d = this.d, tc = this.p.thermalCtrl;
      const args = { pDiss, dAU, qPlanet, aRad: d.radiatorArea, aBody: ev.mass.aBody, epsMli: this.p.insulation.effEmit, extraW: ev.thermal.rtgHeat };
      const open = P.thermalEq({ ...args, epsRad: 0.85 });
      if (tc.id === 'passive' || open.T >= 288) return { T: open.T, eq: open };
      const closed = P.thermalEq({ ...args, epsRad: tc.coldEps });
      const T = clamp(288, open.T, closed.T);
      return { T, eq: closed };
    }

    // ---------------------------------------------------------- main step
    step(dtH) {
      const s = this.s, ev = this.ev, p = this.p, m = this.m, d = this.d;
      if (s.outcome || s.active) return;
      s.t += dtH;
      this.geometry();
      if (s.conj && !s.flags.conjActive && ['science', 'downlink', 'aerobraking'].includes(s.phase)) { s.flags.conjActive = true; this.raise('conjunction', {}); }
      if (!s.conj) s.flags.conjActive = false;
      if (s.acsMode !== 'nominal') s.prop = Math.max(0, s.prop - ((s.acsMode === 'hybrid' ? 0.03 : 0.1) * dtH) / 24);
      this.phaseLogic(dtH);
      if (s.outcome || s.active) { this.record(); return; }
      if (s.safe && s.safeUntil && s.t >= s.safeUntil) { s.safe = false; s.safeUntil = 0; this.log('Safe mode exited — nominal operations resumed.', 'good'); }
      if (s.powerSaver && s.powerSaverUntil && s.t >= s.powerSaverUntil) { s.powerSaver = false; this.log('Power-saving period complete; instruments may resume.', 'info'); }

      // ---- power
      const yrs = this.yrs;
      const inOrbit = ['science', 'commission', 'aerobraking', 'downlink'].includes(s.phase) && m.type !== 'kbo';
      const ecl = inOrbit ? ev.orbit.ecl : 0;
      const genArr = s.arraysDeployed ? ev.powerFns.arrayW(s.sunAU, yrs) * s.arrayHealth : 0;
      const genRtg = ev.powerFns.rtgW(yrs);
      const xd = p.pmad.xd, etaRT = p.pmad.xe / p.pmad.xd;
      const genSun = (genArr + genRtg) * xd, genEcl = genRtg * xd;
      const L = this.loads();
      let load = L.base + L.inst + L.tx;
      // thermal & heaters
      const qPlanet = inOrbit ? (ev.orbit.qHot * (1 - ecl) + ev.orbit.qCold * ecl) : 0;
      const th = this.thermal(load - d.txPower * L.duty, s.sunAU, qPlanet);
      let heater = 0, Teq = th.T;
      if (Teq < ev.thermal.tMin && s.heatersOn) { heater = Math.min(400, P.heaterNeeded(th.eq, ev.thermal.tMin)); Teq = ev.thermal.tMin; }
      load += heater;
      // electric propulsion uses surplus power
      s.epPower = 0;
      if (s.phase === 'cruise' && ev.traj.ep && p.engine.type === 'ep' && !s.safe && !s.powerSaver) {
        s.epPower = clamp(genSun - load - 15, 0, p.engine.pMax);
        const F = P.epThrust(s.epPower, p.engine.isp, p.engine.eff) * 0.85;
        const mdot = F / (p.engine.isp * C.G0);
        const dm = Math.min(s.prop, mdot * dtH * 3600);
        if (dm > 0) {
          const dv = P.rocketDv(p.engine.isp, this.massNow, this.massNow - dm);
          s.prop -= dm; s.dvDone += dv;
        }
        load += s.epPower;
        if (m.type === 'helio') { const r = s.sunAU; s.thetaSc += (Math.sqrt(C.MU_SUN / Math.pow(r * C.AU_KM, 3)) * dtH * 3600); }
      } else if (m.type === 'helio' && ev.traj.ep && s.phase === 'cruise') { const r = s.sunAU; s.thetaSc += (Math.sqrt(C.MU_SUN / Math.pow(r * C.AU_KM, 3)) * dtH * 3600); }
      const avgGen = genSun * (1 - ecl) + genEcl * ecl;
      const net = avgGen - load;
      s.soc = clamp(s.soc + (net > 0 ? net * etaRT : net) * dtH, 0, s.battCap);
      s.gen = avgGen; s.load = load; s.genSun = genSun; s.heater = heater;
      // eclipse depth of discharge
      if (ecl > 0.01) {
        const Te = (ev.orbit.periodMin * ecl) / 60;
        const eE = Math.max(0, load - genEcl) * Te;
        s.eclDod = eE / Math.max(1, s.battCap);
        if (eE > s.soc * 0.98 && s.soc < 0.6 * s.battCap && !s.safe) { this.triggerSafe('Battery depleted during eclipse (brownout)'); }
        else if (s.eclDod > ev.power.dodMax * 1.2 && this.rand() < 0.02 * dtH) { s.battCap *= 0.995; }
      } else s.eclDod = 0;
      if (s.soc <= 0.5 && net < 0 && !s.safe) this.triggerSafe('Battery exhausted — loads exceed generation');
      if (s.soc <= 0.5 && net < 0 && s.safe) {
        s.flags.deadH = (s.flags.deadH || 0) + dtH;
        if (s.flags.deadH > 48) return this.finish('lost', 'The battery stayed flat for two days: survival heaters failed, electronics froze and contact was lost.');
      } else s.flags.deadH = 0;
      if (s.soc < 0.3 * s.battCap && net < 0 && !s.safe && !s.flags.powerWarned && s.phase !== 'deploy') {
        s.flags.powerWarned = true; this.raise('power_shortage', { net, gen: avgGen, load });
      }
      if (s.soc > 0.6 * s.battCap) s.flags.powerWarned = false;

      // ---- thermal
      s.temp += (Teq - s.temp) * (1 - Math.exp(-dtH / 6));
      if (s.temp > ev.thermal.tMax + 2 && !s.flags.hotWarned && !s.safe) { s.flags.hotWarned = true; this.raise('thermal_hot', {}); }
      if (s.temp < ev.thermal.tMax - 3) s.flags.hotWarned = false;
      if (s.temp < ev.thermal.tMin - 8 && !s.flags.coldWarned) { s.flags.coldWarned = true; this.raise('thermal_cold', {}); }
      if (s.temp > ev.thermal.tMin - 2) s.flags.coldWarned = false;

      // ---- radiation
      let env = ORB.ENV.cruise.rad;
      if (['science', 'aerobraking', 'commission', 'downlink', 'encounter'].includes(s.phase) && ev.orbit.env) env = ev.orbit.env.rad * ev.orbit.radMult;
      s.doseRate = env * ev.radiation.factor;
      s.dose += (s.doseRate * dtH) / 8766;

      // ---- comms
      const pointErr = s.acsMode === 'thrusters' ? 0.5 : s.acsMode === 'hybrid' ? 0.15 : p.acs.pointDeg;
      let rate = 0;
      if (!s.conj) {
        if (s.safe) {
          const lam = 0.299792458 / 8.4;
          rate = P.link({ ptW: d.txPower, gtDbi: 5, grDbi: P.dishGain(ev.comms.ground.D, lam, 0.6), distKm: s.distKm, lambdaM: lam, tsysK: m.type === 'leo' ? 160 : 30, lossDb: 2.3, capBps: 2e6 }).rate;
        } else rate = ev.comms.lk(s.distKm, d.txPower, ev.comms.gt, P.pointingLoss(p.antenna.D, ev.comms.lambda, pointErr)).rate;
      }
      s.rateNow = rate; s.owlt = s.distKm / C.C;
      // ---- science data
      this.science(dtH, rate, L);
      // ---- pending commands
      for (let i = s.pending.length - 1; i >= 0; i--) {
        const c = s.pending[i];
        if (s.t >= c.at) { s.pending.splice(i, 1); if (c.type === '__cmd') this.applyCmd(c); else this.applyOption(c.type, c.opt, c.data, true); }
      }
      // ---- hazards
      if (s.t >= s.cooldownUntil && !s.active) this.hazards(dtH);
      // ---- LEO drag
      if (m.type === 'leo' && ['science', 'commission'].includes(s.phase)) {
        const dvh = (ev.orbit.skPerYr * dtH) / 8766;
        if (s.prop > 0.01) this.burn(dvh);
        else {
          s.flags.decayH = (s.flags.decayH || 0) + dtH;
          if (!s.flags.decayLog) { s.flags.decayLog = true; this.log('Propellant exhausted — the orbit can no longer be maintained and is decaying.', 'bad'); }
          const life = 20 * Math.pow(2, (ev.orbit.alt - 300) / 50) * 24;
          if (s.flags.decayH > life) return this.finish('reentry', 'Atmospheric drag lowered the orbit until the spacecraft re-entered and burned up.');
        }
      }
      this.record();
    }

    science(dtH, rate, L) {
      const s = this.s, ev = this.ev, so = ev.orbit, m = this.m;
      const cap = this.p.storage.gbit;
      const days = dtH / 24;
      const encounter = s.phase === 'encounter';
      let genTot = 0;
      this.instruments().forEach(({ id, st, spec }) => {
        if (!this.instActive(st, id)) return;
        let g;
        if (encounter) { if (!(spec.imaging || spec.optical)) return; g = (spec.rate * 0.6 * so.res * days) / 2; }
        else if (s.phase === 'cruise') g = spec.rate * 0.3 * (s.cruiseDuty == null ? 1 : s.cruiseDuty) * days * (m.type === 'kbo' ? 0.05 : 1);
        else g = spec.rate * so.duty * days * (m.type === 'kbo' ? 0.05 : 1);
        g *= st.health > 0.6 ? 1 : 0.7;
        if (encounter && s.encLoss) g *= 1 - s.encLoss;
        if (s.flags.eclipseInstOff && s.phase === 'science') g *= 1 - so.ecl;
        let q = st.q * (st.health > 0.6 ? 1 : 0.5) * (s.acsMode === 'thrusters' && spec.imaging ? 0.65 / this.p.acs.pointQ : s.acsMode === 'hybrid' && spec.imaging ? 0.85 : 1);
        if (spec.coldNeeded && s.temp > 300) q *= 0.75;
        if (encounter) q *= clamp(1.15 - 0.15 * s.navError, 0.4, 1.1);
        const free = Math.max(0, cap - s.storageUsed);
        const stored = Math.min(g, free);
        s.dataLost += g - stored; s.storageUsed += stored;
        st.stored += stored; st.storedQ += stored * q; st.gen += g; genTot += g;
      });
      // radio science (needs link + HGA)
      if (s.phase === 'science' && rate > 0 && !s.safe && ev.sciList.some((x) => x.radio)) {
        const rs = ev.sciList.find((x) => x.radio);
        s.radioObs += days * so.duty * clamp(s.dsnHours / 8, 0.25, 1.2) * rs.q * (s.acsMode === 'nominal' ? 1 : 0.6);
      }
      // downlink
      const capG = (rate * s.dsnHours * 3600 * days * this.p.band.avail) / 1e9;
      if (capG > 0 && s.storageUsed > 0 && !(m.type === 'kbo' && encounter)) {
        let budget = Math.min(capG, s.storageUsed);
        const take = (st, amt) => { const mv = Math.min(amt, st.stored); if (mv <= 0) return 0; const mq = st.storedQ * (mv / st.stored); st.stored -= mv; st.storedQ -= mq; st.returned += mv; st.returnedQ += mq; s.storageUsed -= mv; return mv; };
        // priority instruments are downlinked first (operator choice), then the rest proportionally
        const share = (list) => { const tot = list.reduce((a, { st }) => a + st.stored, 0); if (budget > 0 && tot > 0) { const fr = Math.min(1, budget / tot); list.forEach(({ st }) => { budget -= take(st, st.stored * fr); }); } };
        const prio = s.dlPriority || [];
        share(this.instruments().filter(({ id, st }) => prio.includes(id) && st.stored > 0));
        share(this.instruments().filter(({ st }) => st.stored > 0));
        s.storageUsed = Math.max(0, s.storageUsed);
      }
      s.genNow = genTot / Math.max(days, 1e-9);
      // discoveries at science milestones
      if (['science', 'downlink', 'encounter'].includes(s.phase)) this.milestones();
    }

    obsDays(id) {
      const s = this.s;
      if (id === 'radio') return s.radioObs;
      const st = s.inst[id]; if (!st) return 0;
      const spec = ORB.INSTRUMENT_BY_ID[id];
      if (this.m.type === 'kbo' && (spec.imaging || spec.optical)) return (4 * st.returnedQ) / Math.max(1e-9, spec.rate * 0.6);
      return st.returnedQ / (spec.rate * (this.m.type === 'kbo' ? 0.05 : 1));
    }
    objectives() {
      const so = this.ev.orbit;
      return this.m.objectives.map((o) => {
        const acc = o.inst.reduce((sum, id) => sum + this.obsDays(id), 0);
        let c = clamp(acc / o.needDays, 0, 1);
        if (o.coverage) c *= so.coverage;
        return { ...o, completion: c, acc };
      });
    }
    sciIndex() { return this.objectives().reduce((a, o) => a + o.weight * o.completion, 0) * 100; }

    milestones() {
      const s = this.s;
      const objs = this.objectives();
      objs.forEach((o) => {
        [0.25, 0.6, 1].forEach((th) => {
          const key = `ms_${o.id}_${th}`;
          if (o.completion >= th && !s.flags[key]) {
            s.flags[key] = true;
            const lib = ORB.DISCOVERIES[this.m.id] || {};
            const list = lib[o.id] || [];
            const idx = th === 0.25 ? 0 : th === 0.6 ? 1 : 2;
            const text = list[idx];
            if (text) { s.discoveries.push({ t: s.t, obj: o.name, title: text[0], text: text[1], tier: idx }); this.log(`SCIENCE: ${text[0]}`, 'science'); this.notify && this.notify('science', text[0]); }
            if (th === 1) this.log(`Objective complete: ${o.name}.`, 'good');
          }
        });
      });
    }

    record() {
      const s = this.s;
      if (s.t < s.histNext) return;
      s.histNext = s.t + s.histEvery;
      const h = s.hist;
      h.t.push(+(s.t / 24).toFixed(2)); h.soc.push(+((s.soc / s.battCap) * 100).toFixed(1)); h.gen.push(Math.round(s.gen)); h.load.push(Math.round(s.load));
      h.temp.push(+(s.temp - 273.15).toFixed(1)); h.prop.push(+s.prop.toFixed(1)); h.stored.push(+s.storageUsed.toFixed(2));
      h.returned.push(+Object.values(s.inst).reduce((a, x) => a + x.returned, 0).toFixed(2)); h.dist.push(+(s.distKm / C.AU_KM).toFixed(4));
      h.rate.push(Math.round(s.rateNow)); h.sci.push(+this.sciIndex().toFixed(1));
    }

    // ---------------------------------------------------------- phases
    setPhase(ph, msg, level = 'good') { this.s.phase = ph; this.s.phaseStart = this.s.t; if (msg) this.log(msg, level); this.notify && this.notify('phase', ph); }
    phaseLogic(dtH) {
      const s = this.s, ev = this.ev, m = this.m, tr = ev.traj;
      if (s.phase === 'deploy') {
        if (!s.flags.acq && s.t >= 0.3) { s.flags.acq = true; this.log(`Signal acquisition: ${ev.comms.ground.name} has carrier lock. Telemetry flowing.`, 'good'); }
        if (!s.arraysDeployed && s.t >= 1 && !s.flags.deployTried) {
          s.flags.deployTried = true;
          if (this.d.solarArea > 0 && this.p.solar.id !== 'none') {
            if (this.rand() > this.p.solar.deployRel) { s.arraysDeployed = true; s.arrayHealth = 0.55; this.raise('array_deploy', {}); }
            else { s.arraysDeployed = true; this.log(`Solar arrays deployed and sun-pointed: ${(ev.powerFns.arrayW(s.sunAU, 0) * this.p.pmad.xd).toFixed(0)} W generated.`, 'good'); }
          } else this.log('Radioisotope power nominal. No arrays to deploy.', 'good');
        }
        if (s.t >= 3 && !s.flags.shortfall && s.shortfallDv > 0) {
          s.flags.shortfall = true;
          const f = this.burn(s.shortfallDv, 'Launch shortfall make-up burn');
          this.log(`Make-up burn of ${(s.shortfallDv * 1000).toFixed(0)} m/s performed to compensate for launch underperformance.`, 'warn');
          if (f < 0.999) return this.finish('stranded', 'The launch vehicle could not deliver the spacecraft to the required trajectory and the spacecraft lacked the propellant to make up the difference.');
        }
        if (s.t >= 6) {
          if (m.type === 'leo') this.setPhase('commission', 'Early orbit phase complete. Beginning in-orbit commissioning.');
          else { this.setPhase('cruise', m.type === 'kbo' ? 'Departure confirmed. Long cruise begins.' : 'Cruise phase begins.'); if (m.type === 'kbo') this.raise('hibernation', {}); }
        }
        return;
      }
      if (s.phase === 'commission') {
        if (s.t >= 30 * 24) this.startScience();
        return;
      }
      if (s.phase === 'cruise') {
        // TCMs
        s.tcm.forEach((c) => { if (!c.done && s.t >= c.at) { c.done = true; this.raise('tcm', { n: c.n, dv: c.base * this.navFactor * (0.5 + this.rand()) * (1 + s.tcmPenalty), last: c.n === s.tcm.length }); } });
        if (tr.type === 'ega' && !s.flags.dsm && this.days >= 365) { s.flags.dsm = true; const f = this.burn(0.75, 'Deep-space maneuver'); this.log(`Deep-space maneuver executed (750 m/s). Propellant remaining ${s.prop.toFixed(0)} kg.`, f < 1 ? 'bad' : 'good'); if (f < 1) return this.finish('stranded', 'Out of propellant during the deep-space maneuver.'); }
        if (tr.type === 'ega' && !s.flags.ega && this.days >= 730) { s.flags.ega = true; this.log('Earth gravity assist complete — the flyby added several km/s of heliocentric speed. Bound for Jupiter.', 'good'); this.notify && this.notify('milestone', 'Earth gravity assist'); }
        if (tr.jupiter && !s.flags.jga && this.days >= tr.jupiter.tD) { s.flags.jga = true; this.raise('jupiter_flyby', { gain: tr.jupiter.dvGain }); }
        // arrival
        const arrived = tr.ep ? s.dvDone >= tr.epDv : this.days >= ev.time.cruiseD;
        if (tr.ep && s.prop <= 0.01 && !arrived) return this.finish('stranded', 'Xenon exhausted before the low-thrust transfer was complete.');
        if (arrived) this.arrive();
        return;
      }
      if (s.phase === 'aerobraking') {
        if (s.t >= s.aeroEnd) { this.log('Aerobraking complete: periapsis raised out of the atmosphere. Science orbit achieved.', 'good'); this.startScience(); }
        return;
      }
      if (s.phase === 'encounter') {
        if (s.t >= s.encEnd) { this.setPhase('downlink', 'Encounter sequence complete. Beginning the long downlink of stored flyby data.'); s.sciStart = s.t; s.sciEnd = s.t + this.d.duration * 24; }
        return;
      }
      if (s.phase === 'science' || s.phase === 'downlink') {
        if (!s.safe) s.sciHours += dtH;
        if (s.t >= s.sciEnd) {
          if (m.type === 'leo' && ev.orbit.alt > 600) {
            const dv = tr.items.find((x) => /deorbit/i.test(x.label));
            const f = dv ? this.burn(dv.dv, 'Deorbit burn') : 1;
            if (f >= 0.999) this.log('End-of-life deorbit burn complete. Perigee lowered; re-entry will occur within months — debris guidelines met.', 'good');
            else { s.flags.debrisFail = true; this.log('Insufficient propellant for the deorbit burn: the spacecraft will remain as orbital debris for decades.', 'bad'); }
          }
          this.finish('complete', 'Primary mission complete.');
        }
      }
    }
    arrive() {
      const s = this.s, ev = this.ev, m = this.m, tr = ev.traj;
      if (m.type === 'kbo') { this.setPhase('encounter', 'Closest approach sequence started — the spacecraft is executing the flyby autonomously; Earth will know the result in ~6 hours.', 'good'); s.encEnd = s.t + 48; this.raise('encounter', {}); return; }
      if (tr.ep) { this.log('Low-thrust spiral complete — science orbit reached.', 'good'); return this.startScience(); }
      // insertion burn
      const ins = tr.items.find((x) => /insertion|Rendezvous/i.test(x.label));
      const dv = (ins ? ins.dv : 0) * (1 + s.tcmPenalty * 0.3);
      const engRoll = this.rand();
      let f = this.burn(dv, 'Orbit insertion');
      let note;
      if (engRoll > this.p.engine.rel + 0.005 && f >= 1) { note = 'Engine pressure anomaly cut the burn short; backup thrusters completed it at extra propellant cost.'; this.burn(dv * 0.08); }
      s.inserted = f >= 0.98;
      if (f >= 0.98) {
        this.raise('insertion', { ok: true, dv, note });
        if (m.id === 'mars' && ev.orbit.opt.aerobrake) { this.setPhase('aerobraking', 'Captured into a long ellipse. Aerobraking campaign begins.'); s.aeroEnd = s.t + 180 * 24; return; }
        this.startScience();
      } else if (f >= 0.8) {
        this.raise('insertion', { ok: false, partial: true, dv, f });
        s.flags.badOrbit = true;
        Object.values(s.inst).forEach((st) => (st.q *= 0.55));
        this.startScience();
      } else {
        this.raise('insertion', { ok: false, dv, f });
        // flyby science only
        s.flags.flybyOnly = true;
        this.startScience(3);
      }
    }
    startScience(days) {
      const s = this.s;
      const ph = this.m.type === 'kbo' ? 'downlink' : 'science';
      this.setPhase(ph, days ? 'Flyby science only — the spacecraft will pass the target and continue into deep space.' : 'Science operations begin!', days ? 'bad' : 'good');
      s.sciStart = s.t; s.sciEnd = s.t + (days || this.d.duration) * 24;
      if (days) s.sciEnd = s.t + days * 24 + 60 * 24; // allow downlink of flyby data
    }
    finish(status, reason) {
      const s = this.s;
      if (s.outcome) return;
      s.outcome = { status, reason, t: s.t };
      this.log(`MISSION ${status === 'complete' ? 'COMPLETE' : 'ENDED'}: ${reason}`, status === 'complete' ? 'good' : 'bad');
      this.record();
      this.notify && this.notify('end', status);
    }

    // ---------------------------------------------------------- events
    triggerSafe(reason) {
      const s = this.s;
      if (s.safe) return;
      s.safe = true; s.safeReason = reason; s.safeUntil = 0; s.safeSince = s.t;
      this.log(`SAFE MODE: ${reason}. Non-essential loads off, arrays sun-pointed, low-gain antenna to Earth.`, 'bad');
      this.raise('safe_mode', { reason });
    }
    hazards(dtH) {
      const s = this.s, ev = this.ev, p = this.p, m = this.m, y = dtH / 8766;
      const k = GAMEPLAY_RATE * (this.ev.difficulty.hazardMult || 1);
      const inOps = ['science', 'downlink', 'aerobraking', 'commission'].includes(s.phase);
      const envKey = inOps ? m.id : 'cruise';
      const env = ORB.ENV[envKey] || ORB.ENV.cruise;
      const doseRatio = s.dose / p.computer.tidKrad;
      const hot = s.temp > ev.thermal.tMax;
      const rates = [];
      // instrument faults
      this.instruments().forEach(({ id, st, spec }) => {
        if (st.failed || st.health < 0.6) return;
        if (!this.instActive(st, id) && s.phase !== 'cruise') return;
        rates.push(['inst_fault', k * -Math.log(spec.rel) * (1 + 2 * doseRatio) * (hot ? 2.5 : 1) * 0.6, { id }]);
      });
      if (s.arraysDeployed && this.d.solarArea > 0) rates.push(['array_degrade', Math.min(2, 0.2 + env.rad / 400 + env.mm * 5) * (p.solar.degr / 0.015) * 0.6, {}]);
      rates.push(['spe', env.spe * (this.ev.difficulty.hazardMult || 1), {}]);
      rates.push(['comp_upset', Math.min(2.5, p.computer.seu * clamp(s.doseRate / 10, 0.3, 6)) * 0.4 * (this.ev.difficulty.hazardMult || 1), {}]);
      if (s.wheels >= 3 && s.acsMode === 'nominal') rates.push(['wheel_fault', (p.acs.id === 'precision' ? 0.12 : 0.25) * (this.ev.difficulty.hazardMult || 1), {}]);
      if (inOps && ev.orbit.ecl > 0.02 && s.eclDod > ev.power.dodMax) rates.push(['battery_fade', 1.2, {}]);
      rates.push(['micrometeoroid', env.mm * 10 * (p.structure.id === 'cfrp' ? 1.3 : p.structure.id === 'reinforced' ? 0.6 : 1), {}]);
      if (m.type === 'leo' && inOps) rates.push(['debris', env.debris * (this.ev.difficulty.hazardMult || 1), {}]);
      if (s.phase === 'aerobraking') rates.push(['aero_heat', 5 * (p.structure.id === 'reinforced' ? 0.5 : p.structure.id === 'cfrp' ? 1.5 : 1) * (p.acs.id === 'coldgas' ? 1.6 : 1), {}]);
      if ((s.phase === 'science' || s.phase === 'downlink') && s.rateNow > 0 && !s.safe) {
        const act = this.instruments().filter(({ id, st }) => this.instActive(st, id));
        const potency = act.reduce((a, { st }) => a + st.rel * st.q, 0);
        if (potency > 0) rates.push(['discovery', 1.6 * potency / 2, {}]);
      }
      const quiet = m.type === 'kbo' && s.phase === 'cruise' ? 0.35 : 1; // hibernating cruise: fewer reportable anomalies
      for (const [type, rate, data] of rates) {
        if (this.rand() < 1 - Math.exp(-rate * y * quiet)) { this.raise(type, data); break; }
      }
    }
    raise(type, data) {
      const s = this.s;
      const def = ORB.EVENTS[type];
      if (!def) return;
      if (def.prepare) { const ok = def.prepare(this, data); if (ok === false) return; }
      const ev = { type, data, t: s.t, id: s.events.length + 1 };
      s.events.push({ type, t: s.t, title: def.title(this, data), sev: def.sev });
      if (def.auto) def.auto(this, data);
      if (!def.options) { this.log(def.title(this, data), def.sev === 'good' ? 'good' : 'info'); return; }
      s.active = ev;
      this.notify && this.notify('event', ev);
    }
    commandDelayH() {
      const s = this.s, m = this.m;
      if (m.type === 'leo') return 0.5 * 24 / Math.max(1, s.dsnHours / 0.17);
      const h = s.dsnHours;
      return (2 * s.owlt) / 3600 + Math.pow(24 - h, 2) / 48;
    }
    choose(optId) {
      const s = this.s; const a = s.active; if (!a) return;
      const def = ORB.EVENTS[a.type];
      const opts = def.options(this, a.data);
      const opt = opts.find((o) => o.id === optId); if (!opt) return;
      s.active = null;
      s.cooldownUntil = s.t + 24 * 3;
      const delay = def.instant ? 0 : this.commandDelayH();
      s.decisions.push({ t: s.t, event: def.title(this, a.data), choice: opt.label, score: opt.score || 0, delayH: delay });
      s.opsScore += opt.score || 0;
      if (delay > 0.05) {
        s.pending.push({ at: s.t + delay, type: a.type, opt: optId, data: a.data });
        this.log(`Command sent: "${opt.label}". Arrives in ${delay < 1 ? (delay * 60).toFixed(0) + ' min' : delay.toFixed(1) + ' h'} (light time + waiting for antenna contact).`, 'cmd');
      } else this.applyOption(a.type, optId, a.data, false);
    }
    applyOption(type, optId, data, delayed) {
      const def = ORB.EVENTS[type];
      const opt = def.options(this, data).find((o) => o.id === optId);
      if (!opt) return;
      const r = opt.effect ? opt.effect(this, data) : null;
      this.log(`${delayed ? 'Command executed' : 'Executed'}: ${opt.label}${r ? ' — ' + r : ''}`, 'cmd');
    }
    // operator commands from mission control (uplinked: subject to light time and contact windows)
    command(cmd) {
      const s = this.s;
      if (cmd.kind === 'dsn') { s.dsnHours = cmd.value; this.log(`Ground-station schedule changed to ${cmd.value} h/day.`, 'cmd'); return 0; }
      const delay = this.commandDelayH();
      s.pending.push({ at: s.t + delay, type: '__cmd', cmd });
      this.log(`Uplinking: ${cmd.label}. Arrives in ${delay < 1 ? (delay * 60).toFixed(0) + ' min' : delay.toFixed(1) + ' h'}.`, 'cmd');
      return delay;
    }
    applyCmd(c) {
      const s = this.s, cmd = c.cmd;
      if (cmd.kind === 'inst' && s.inst[cmd.id] && !s.inst[cmd.id].failed) s.inst[cmd.id].on = cmd.value;
      if (cmd.kind === 'saver') { s.powerSaver = cmd.value; s.powerSaverUntil = 0; }
      if (cmd.kind === 'heaters') s.heatersOn = cmd.value;
      if (cmd.kind === 'prio') s.dlPriority = cmd.value ? [cmd.value] : (this.m.type === 'kbo' ? s.dlPriority : []);
      if (cmd.kind === 'safeexit') { s.safe = false; s.safeUntil = 0; }
      this.log(`Command executed: ${cmd.label}.`, 'cmd');
    }
    delegate() { // flight team picks recommended option
      const a = this.s.active; if (!a) return;
      const opts = ORB.EVENTS[a.type].options(this, a.data);
      const rec = opts.find((o) => o.rec) || opts[0];
      this.choose(rec.id);
    }

    // ---------------------------------------------------------- summary
    summary() {
      const s = this.s, objs = this.objectives();
      const returned = Object.values(s.inst).reduce((a, x) => a + x.returned, 0);
      const gen = Object.values(s.inst).reduce((a, x) => a + x.gen, 0);
      return { objs, sci: this.sciIndex(), returned, gen, lost: s.dataLost, onboard: s.storageUsed };
    }
    toJSON() { return this.s; }
  }
  ORB.Sim = Sim;
})();
