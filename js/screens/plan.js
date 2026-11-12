/* ORBITAL — Payload, Launch Vehicle and Trajectory planning screens */
(function () {
  const ORB = window.ORB, U = ORB.ui, P = ORB.phys, C = ORB.CONST;
  const { esc, f, money, pct, kg, W, term } = U;
  const shell = ORB.shell;

  /* ===================================================================== PAYLOAD */
  ORB.screens.payload = {
    title: 'Payload',
    render(el) {
      return shell.mount(el, {
        eyebrow: 'Science Payload', title: 'Choose your scientific instruments', sub: 'Instruments are why the mission exists — but each one costs mass, power, money and data volume. Match them to the objectives.',
        prev: ['design', 'Spacecraft'], next: ['launcher', 'Launch vehicle'],
        body: (ev) => {
          const d = ev.design, m = ev.mission;
          const cards = ORB.INSTRUMENTS.map((i) => {
            const on = d.instruments.includes(i.id);
            const rel = i.rel_[m.id] ?? 0.3;
            const stars = Math.round(rel * 5);
            return `<button class="inst-card ${on ? 'on' : ''}" data-inst="${i.id}" aria-pressed="${on}">
              <div class="ih"><span class="glyph">${i.icon}</span><div><div style="font-weight:600">${esc(i.name)}</div><div class="stars" title="Relevance to this mission: ${pct(rel)}">${'★'.repeat(stars)}<span class="off">${'★'.repeat(5 - stars)}</span> <span class="small muted">relevance</span></div></div><span class="tog">${on ? '✓' : '+'}</span></div>
              <div class="small muted">${esc(i.why)}</div>
              <div class="specs" style="display:flex;flex-wrap:wrap;gap:4px">${[`${i.massKg} kg`, `${i.powerW} W`, `$${i.cost} M`, `${i.rate} Gbit/day`, `rel. ${pct(i.rel, 1)}/yr`].map((s) => `<span class="chip">${s}</span>`).join('')}</div></button>`;
          }).join('');
          return `<div class="tab-body"><div class="opt-grid" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr))">${cards}</div>
            ${shell.slider('duration', 'Primary science phase', d.duration, m.duration.min, m.duration.max, 5, 'days', `Longer operations return more science but cost ≈ ${money(m.opsPerDay * 365)} per year in operations and expose hardware to more wear and radiation.`)}
            <div data-derived>${this.derivedHTML(ev)}</div></div>`;
        },
        derived: (ev) => this.derivedHTML(ev),
      });
    },
    derivedHTML(ev) {
      const sl = ev.science, d = ev.design;
      const inst = d.instruments.map((id) => ORB.INSTRUMENT_BY_ID[id]);
      const tot = (k) => inst.reduce((a, i) => a + i[k], 0);
      const radio = ev.sciList.find((x) => x.radio);
      return `<div class="subhead"><h4>Mission objectives — projected completion</h4><span class="chip ${sl.index < 40 ? 'warn' : 'good'}">${sl.index.toFixed(0)}% overall</span></div>
        ${sl.objectives.map((o) => `<div class="obj-prog" style="border-bottom:1px solid var(--line);padding:12px 0">
          <div class="mh"><b>${esc(o.name)} <span class="muted small">· weight ${pct(o.weight)}</span></b><span class="mono">${pct(o.expected)}</span></div>
          ${U.bar(o.expected, o.expected < 0.3 ? 'bad' : o.expected < 0.7 ? 'warn' : 'good')}
          <div class="small muted" style="margin-top:6px">${esc(o.desc)} · Needs ${o.needDays} observation-days of returned data${o.coverage ? ' + global coverage' : ''}.</div>
          <div class="row" style="gap:4px;margin-top:6px">${o.inst.map((id) => { const sp = ORB.INSTRUMENT_BY_ID[id] || ORB.RADIO_SCIENCE; const have = id === 'radio' ? !!radio : d.instruments.includes(id); return `<span class="chip ${have ? 'good' : ''}">${have ? '✓' : '○'} ${esc(sp.short)}</span>`; }).join('')}</div></div>`).join('')}
        <div class="big-stats" style="margin-top:14px"><div class="big-stat"><div class="l">Payload mass</div><div class="v">${kg(tot('massKg'))}</div></div><div class="big-stat"><div class="l">Payload power</div><div class="v">${W(tot('powerW'))}</div></div>
          <div class="big-stat"><div class="l">Payload cost</div><div class="v">${money(tot('cost'))}</div></div><div class="big-stat"><div class="l">Data generated</div><div class="v">${ev.comms.genDay.toFixed(2)} Gbit/day</div><div class="s">${pct(ev.comms.returnRatio)} can be returned</div></div></div>
        ${radio ? `<div class="note"><div class="nh">⌁ Bonus: radio science</div>${esc(ORB.RADIO_SCIENCE.why)} Your high-gain antenna enables it at no extra mass.</div>` : ''}
        ${shell.note('Choosing a payload', `Instruments with low relevance to this destination add mass and cost but little science (an atmospheric sounder at an airless asteroid measures nothing). Science only counts once it reaches Earth: if instruments generate more data than the radio link can return, the extra is wasted. Data quality also depends on the spacecraft: pointing stability, orbit altitude, lighting and detector temperature.`)}`;
    },
  };

  /* ===================================================================== LAUNCH VEHICLE */
  const rocketSVG = (lv, hPx, selected) => {
    const H = hPx, Wd = Math.max(16, (lv.fairingD / 8.4) * 62);
    const fairH = Wd * 1.7, body = H - fairH;
    const x0 = 40 - Wd / 2;
    let boosters = '';
    if (lv.boosters) { const bw = Wd * 0.38, bh = body * 0.42; for (const s of [-1, 1]) boosters += `<rect x="${40 + s * (Wd / 2 + bw / 2) - bw / 2}" y="${H - bh}" width="${bw}" height="${bh}" rx="${bw / 2}" fill="#dfe6f2" stroke="#8090a8"/><path d="M${40 + s * (Wd / 2 + bw / 2) - bw / 2} ${H - bh + bw / 2} Q ${40 + s * (Wd / 2 + bw / 2)} ${H - bh - bw} ${40 + s * (Wd / 2 + bw / 2) + bw / 2} ${H - bh + bw / 2}" fill="#dfe6f2"/>`; }
    const bands = Array.from({ length: lv.stages }, (_, i) => `<rect x="${x0}" y="${fairH + (body * (i + 1)) / (lv.stages + 0.6)}" width="${Wd}" height="2" fill="${lv.color}" opacity=".7"/>`).join('');
    return `<svg viewBox="0 0 80 ${H + 14}" width="80" height="${H + 14}" style="overflow:visible">
      ${selected ? `<ellipse cx="40" cy="${H + 6}" rx="38" ry="6" fill="${lv.color}" opacity=".35"/>` : ''}
      ${boosters}<rect x="${x0}" y="${fairH}" width="${Wd}" height="${body}" fill="#eef2f8" stroke="#8090a8"/>${bands}
      <path d="M${x0} ${fairH} C ${x0} ${fairH * 0.35} ${40 - Wd * 0.15} 0 40 0 C ${40 + Wd * 0.15} 0 ${x0 + Wd} ${fairH * 0.35} ${x0 + Wd} ${fairH} Z" fill="#f7f9fc" stroke="#8090a8"/>
      <rect x="${x0}" y="${fairH + body * 0.15}" width="${Wd}" height="${Math.min(14, body * 0.05)}" fill="${lv.color}"/>
      <path d="M${40 - Wd * 0.3} ${H} L${40 - Wd * 0.4} ${H + 8} L${40 + Wd * 0.4} ${H + 8} L${40 + Wd * 0.3} ${H} Z" fill="#555e70"/></svg>`;
  };
  ORB.art.rocketSVG = rocketSVG;

  ORB.screens.launcher = {
    title: 'Launch vehicle',
    render(el) {
      return shell.mount(el, {
        eyebrow: 'Launch Vehicle Selection', title: 'Choose your ride to space', sub: 'The rocket must lift the fully-fuelled spacecraft to the energy your trajectory needs, and the stowed spacecraft must fit inside its fairing.',
        prev: ['payload', 'Payload'], next: ['trajectory', 'Trajectory & orbit'],
        body: (ev) => {
          const d = ev.design, tr = ev.traj;
          const maxH = Math.max(...ORB.LAUNCHERS.map((l) => l.heightM));
          const capFor = (lv) => (tr.mode === 'leo' ? P.lvCapacityLEO(lv, ev.orbit.alt, ev.orbit.incDeg, ev.parts.site.lat) : P.lvCapacityC3(lv, tr.c3, d.kick, ev.parts.site.lat));
          const lineup = ORB.LAUNCHERS.map((lv) => {
            const cap = capFor(lv), fits = ev.mass.launch <= cap, sel = d.lv === lv.id;
            return `<button class="opt ${sel ? 'on' : ''}" data-set data-k="lv" data-v="${lv.id}" style="align-items:center;text-align:center">
              <div style="height:250px;display:flex;align-items:flex-end;justify-content:center">${rocketSVG(lv, (lv.heightM / maxH) * 230, sel)}</div>
              <span class="t" style="padding:0">${lv.name}</span><span class="small muted">${lv.cls} <span class="tag game">fictional</span></span>
              <div style="width:100%;margin-top:6px">${U.bar(Math.min(1, ev.mass.launch / cap), fits ? (ev.mass.launch / cap > 0.9 ? 'warn' : 'good') : 'bad')}</div>
              <span class="small mono ${fits ? '' : 'bad'}">${f(ev.mass.launch)} / ${f(cap)} kg</span>
              <span class="specs" style="justify-content:center">${[`LEO ${f(lv.leo)} kg`, `fairing ${lv.fairingD} m`, money(lv.cost), `${pct(lv.rel, 1)} reliable`].map((s) => `<span>${s}</span>`).join('')}</span></button>`;
          }).join('');
          return `<div class="tab-body"><div class="opt-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${lineup}</div>
            <p class="small muted" style="margin-top:10px">Bars: your launch mass (spacecraft + propellant + ${ev.mass.adapter} kg adapter) vs. each vehicle's capability ${tr.mode === 'leo' ? `to ${ev.orbit.alt} km at ${ev.orbit.incDeg}°` : `at ${term('c3', 'C3')} = ${tr.c3.toFixed(1)} km²/s²`}. All vehicles are fictional, with performance modelled on real vehicle classes.</p>
            <h3 style="margin-top:22px">Launch site</h3>
            <div class="opt-grid">${ORB.LAUNCH_SITES.map((s) => shell.opt('site', s.id, d.site, `${s.name} (${s.lat}°)`, s.desc)).join('')}</div>
            <h3 style="margin-top:22px">Upper stage option</h3>
            <div class="opt-grid">${shell.opt('kick', false, d.kick, 'No kick stage', 'Standard configuration.')}${shell.opt('kick', true, d.kick, `${ORB.KICK_STAGE.name} (+${money(ORB.KICK_STAGE.cost)})`, ORB.KICK_STAGE.desc)}</div>
            <div data-derived>${this.derivedHTML(ev)}</div></div>`;
        },
        derived: (ev) => this.derivedHTML(ev),
        post: (root, ev) => this.post(root, ev),
      });
    },
    derivedHTML(ev) {
      const lv = ev.lv;
      const fd = lv.lv.fairingUse, env = lv.envelope;
      return `<div class="grid g2" style="margin-top:20px">
        <div><div class="subhead"><h4>${ev.traj.mode === 'leo' ? 'Capability to your orbit' : 'Capability vs departure energy (C3)'}</h4></div><div id="ch-lv"></div></div>
        <div><div class="subhead"><h4>${term('fairing', 'Fairing fit')}</h4><span class="chip ${lv.fairingOk ? 'good' : 'bad'}">${lv.fairingOk ? 'fits' : 'does not fit'}</span></div>
          <svg viewBox="0 0 200 200" width="100%" style="max-height:220px"><rect x="${100 - (fd / 8.4) * 90}" y="20" width="${(fd / 8.4) * 180}" height="170" rx="6" fill="none" stroke="#8fb3ff" stroke-dasharray="4 4"/>
            <rect x="${100 - (env / 8.4) * 90}" y="${190 - (env / 8.4) * 140}" width="${(env / 8.4) * 180}" height="${(env / 8.4) * 140}" rx="4" fill="${lv.fairingOk ? 'rgba(62,230,160,.25)' : 'rgba(255,92,122,.3)'}" stroke="${lv.fairingOk ? '#3ee6a0' : '#ff5c7a'}"/>
            <text x="100" y="14" text-anchor="middle" fill="#9fb3d1" font-size="10" font-family="JetBrains Mono">usable fairing ${fd} m</text>
            <text x="100" y="${185 - (env / 8.4) * 140}" text-anchor="middle" fill="#e8f2ff" font-size="10" font-family="JetBrains Mono">stowed spacecraft ${env.toFixed(1)} m</text></svg>
          <div class="kv"><span>Launch mass</span><span>${kg(ev.mass.launch)}</span><span>Capability</span><span>${kg(lv.capacity)}</span><span>Margin</span><span class="${lv.margin < 0 ? 'bad' : lv.margin < 0.1 ? 'warn' : 'good'}">${pct(lv.margin)}</span><span>Vehicle reliability</span><span>${pct(lv.rel, 1)}</span></div></div></div>
        ${shell.note('Characteristic energy (C3)', `<div class="formula">C3 = v∞²  (km²/s²) — the square of the speed left over after escaping Earth</div>A rocket can send a big payload to low orbit, a smaller one to the Moon (C3 ≈ −2), and much less to Mars (C3 ≈ 9) or Jupiter (C3 ≈ 77 direct). Every km/s of extra departure speed costs the rocket a large fraction of its payload. Launching east from near the equator borrows up to 465 m/s from Earth's rotation.`)}`;
    },
    post(root, ev) {
      const host = root.querySelector('#ch-lv'); if (!host) return;
      const d = ev.design;
      if (ev.traj.mode === 'leo') {
        const alts = Array.from({ length: 30 }, (_, i) => 300 + i * 30);
        U.lineChart(host, { x: alts, xName: 'Altitude', xFmt: (v) => v.toFixed(0) + ' km', yFmt: (v) => U.short(v) + ' kg', h: 220, logY: true, yMin: 100, yLabel: 'kg (log)',
          series: ORB.LAUNCHERS.map((lv) => ({ label: lv.name, color: lv.color, data: alts.map((a) => P.lvCapacityLEO(lv, a, ev.orbit.incDeg, ev.parts.site.lat)), width: lv.id === d.lv ? 3 : 1.5 })),
          points: [{ x: ev.orbit.alt, y: ev.mass.launch, color: '#fff', label: 'your spacecraft' }] });
      } else {
        const xs = Array.from({ length: 50 }, (_, i) => -20 + i * 5);
        U.lineChart(host, { x: xs, xName: 'C3', xFmt: (v) => v.toFixed(0), yFmt: (v) => U.short(v) + ' kg', h: 220, logY: true, yMin: 100, yLabel: 'kg (log)',
          series: ORB.LAUNCHERS.map((lv) => ({ label: lv.name, color: lv.color, data: xs.map((c3) => P.lvCapacityC3(lv, c3, d.kick, ev.parts.site.lat)), width: lv.id === d.lv ? 3 : 1.5 })),
          points: [{ x: ev.traj.c3, y: ev.mass.launch, color: '#fff', label: 'your spacecraft' }], markers: [{ x: ev.traj.c3, label: 'mission C3', color: '#ffc24d' }] });
      }
    },
  };

  /* ===================================================================== TRAJECTORY & ORBIT */
  // builds the orbit-view model for the planner (also reused by mission control for the cruise path)
  ORB.trajModel = (ev) => {
    const m = ev.mission, tr = ev.traj;
    if (m.type === 'helio' || m.type === 'kbo') {
      const tb = m.type === 'kbo' ? ORB.BODIES.halcyon : ORB.BODIES[m.dest];
      const path = [];
      if (m.type === 'kbo') tr.path.forEach((p) => path.push({ x: p.x, y: p.y, t: p.t }));
      else if (tr.ep) {
        const n = 160, T = ev.time.cruiseD; let th = 0;
        for (let i = 0; i <= n; i++) { const fr = i / n; const r = 1 + (tb.aAU - 1) * (fr * fr * (3 - 2 * fr)); path.push({ x: r * Math.cos(th), y: r * Math.sin(th), t: fr * T }); th += (Math.sqrt(C.MU_SUN / Math.pow(r * C.AU_KM, 3)) * (T / n) * 86400); }
      } else {
        const n = 160;
        if (tr.type === 'ega') for (let i = 0; i <= 80; i++) { const t = (730 * i) / 80; const p = P.ellipsePos(1.5874, 0.37, t * 86400); path.push({ x: p.r * Math.cos(p.theta), y: p.r * Math.sin(p.theta), t }); }
        const t0 = tr.type === 'ega' ? 730 : 0;
        for (let i = 0; i <= n; i++) { const t = (tr.base.tofD * i) / n; const p = P.ellipsePos(tr.base.a, tr.base.e, t * 86400); path.push({ x: p.r * Math.cos(p.theta), y: p.r * Math.sin(p.theta), t: t0 + t }); }
      }
      const orbits = [{ r: 1, color: '#4aa3ff', label: '' }, { r: tb.aAU, color: m.color, label: '' }];
      if (m.id !== 'mars') orbits.push({ r: 1.524, color: '#e2694a', label: '', dash: [2, 4] });
      if (m.type === 'kbo') orbits.push({ r: 5.2, color: '#d8b48a', label: '', dash: [2, 4] });
      return { kind: 'helio', path, orbits, maxR: m.type === 'kbo' ? 46 : tb.aAU * 1.12, sqrt: m.type === 'kbo' || m.id === 'jupiter', tb };
    }
    return { kind: m.type };
  };
  const helioState = (ev, model, tD) => {
    const tr = ev.traj, tb = model.tb;
    const T = ev.time.cruiseD;
    const tt = Math.min(tD, T);
    let i = 0; while (i < model.path.length - 1 && model.path[i].t < tt) i++;
    const a = model.path[Math.max(0, i - 1)], b = model.path[i]; const fr = b.t > a.t ? (tt - a.t) / (b.t - a.t) : 0;
    const sc = { x: a.x + (b.x - a.x) * fr, y: a.y + (b.y - a.y) * fr, ang: Math.atan2(-(b.y - a.y), b.x - a.x) };
    const thE = (2 * Math.PI * tD) / C.YEAR_D;
    let target;
    if (ev.mission.type === 'kbo') { const e = model.path[model.path.length - 1]; target = { x: e.x, y: e.y, color: ev.mission.color, label: 'Halcyon', r: 4 }; }
    else { const th = (tr.thetaT0 || 0) + ((2 * Math.PI) / tb.periodD) * tD; target = { x: tb.aAU * Math.cos(th), y: tb.aAU * Math.sin(th), color: ev.mission.color, label: tb.name }; }
    const extra = [];
    if (tr.jupiter) { const thJ = Math.atan2(tr.jupiter.y, tr.jupiter.x) - (2 * Math.PI / 4332.59) * (tr.jupiter.tD - tD); extra.push({ x: 5.2 * Math.cos(thJ), y: 5.2 * Math.sin(thJ), color: '#d8b48a', label: 'Jupiter', r: 5 }); }
    return { sc, earth: { x: Math.cos(thE), y: Math.sin(thE) }, target, extra, pathSplit: i };
  };
  ORB.helioState = helioState;

  ORB.screens.trajectory = {
    title: 'Trajectory',
    render(el) {
      let raf = 0, t0 = performance.now();
      const draw = () => {
        const cv = el.querySelector('#orbit-cv');
        const ev = shell.ev && shell.ev();
        if (cv && ev) {
          const { ctx, w, h } = U.fitCanvas(cv, Math.min(520, Math.max(320, cv.clientWidth * 0.68)));
          const ts = (performance.now() - t0) / 1000;
          const m = ev.mission, tr = ev.traj;
          if (m.type === 'helio' || m.type === 'kbo') {
            const model = this._model;
            const T = ev.time.cruiseD; const loop = 9;
            const tD = ((ts % loop) / loop) * T * 1.08;
            const s = helioState(ev, model, tD);
            ORB.art.drawHelio(ctx, w, h, { ...model, ...s, comm: false }, ts);
            const lab = el.querySelector('#orbit-time'); if (lab) lab.textContent = `Day ${Math.min(tD, T).toFixed(0)} of ${T.toFixed(0)} · ${(Math.min(tD, T) / 365.25).toFixed(2)} yr`;
          } else if (m.type === 'moon') {
            const T = 6, f = (ts % T) / T;
            const path = []; const n = 80;
            for (let i = 0; i <= n; i++) {
              const q = i / n; let r, a;
              if (tr.type === 'blt') { r = 6578 + (384400 - 6578) * q + 1.1e6 * Math.sin(Math.PI * q); a = Math.PI * 0.95 * q + 0.6 * Math.sin(Math.PI * q); }
              else if (tr.ep) { r = 24000 + (384400 - 24000) * q; a = q * 2 * Math.PI * 9; }
              else { r = 6578 + (384400 - 6578) * (1 - Math.cos(Math.PI * q)) / 2; a = Math.PI * q; }
              path.push({ x: r * Math.cos(a + Math.PI), y: r * Math.sin(a + Math.PI) });
            }
            const k = Math.floor(f * n);
            ORB.art.drawEarthMoon(ctx, w, h, { moonAngle: 0, path, split: k, sc: { ...path[k], ang: 0 }, bltOut: tr.type === 'blt' }, ts);
            const lab = el.querySelector('#orbit-time'); if (lab) lab.textContent = `Transfer: ${U.days(ev.time.cruiseD)}`;
          } else {
            const so = ev.orbit;
            const R = ORB.BODIES.earth.R;
            ORB.art.drawLocal(ctx, w, h, { kind: 'earth', bodyFrac: 0.27, orbit: { aFrac: (R + so.alt) / R, e: 0, viewTilt: Math.max(0.12, Math.abs(Math.cos((so.incDeg * Math.PI) / 180))) * 0.9 + 0.1, rot: -0.15 }, phase: (ts / 6) % 1, eclipse: so.ecl > 0.02, label: `${so.alt} km · ${so.incDeg}° · period ${so.periodMin.toFixed(0)} min` }, ts);
            const lab = el.querySelector('#orbit-time'); if (lab) lab.textContent = `${ev.orbit.label}`;
          }
        }
        raf = requestAnimationFrame(draw);
      };
      const cleanup = shell.mount(el, {
        eyebrow: 'Orbit & Trajectory Planning', title: 'Plan the route', sub: 'Choose how to get there and which orbit to fly once you arrive. Faster routes and lower orbits cost Δv; slower routes cost time and operations money.',
        prev: ['launcher', 'Launch vehicle'], next: ['review', 'Readiness review'],
        body: (ev) => { this._model = ORB.trajModel(ev); return this.bodyHTML(ev); },
        derived: (ev) => { this._model = ORB.trajModel(ev); return this.derivedHTML(ev); },
        post: (root, ev) => this.post(root, ev),
      });
      raf = requestAnimationFrame(draw);
      return () => { cancelAnimationFrame(raf); cleanup && cleanup(); };
    },
    bodyHTML(ev) {
      const m = ev.mission, d = ev.design, tr = ev.traj;
      const isEP = ev.parts.engine.type === 'ep';
      let trajOpts = '';
      if (m.type !== 'leo') {
        trajOpts = `<h3>Transfer trajectory</h3><div class="opt-grid">${m.trajectories.map((id) => {
          const ti = ORB.TRAJ_INFO[id];
          const need = id === 'ep' ? (isEP ? '✓ electric engine fitted' : 'needs electric propulsion') : isEP && m.type !== 'kbo' ? 'needs a chemical engine' : '';
          return shell.opt('trajectory.type', id, d.trajectory.type, ti.name, ti.desc, need ? [need] : []);
        }).join('')}</div>`;
        if (tr.type === 'fast') trajOpts += shell.slider('trajectory.speed', 'Transfer speed (aphelion beyond target)', d.trajectory.speed || 0, 0, 1, 0.02, 'speed', 'Higher = shorter trip, higher C3 and faster arrival to brake.');
        if (m.type === 'helio' && !tr.ep) trajOpts += shell.slider('trajectory.offset', 'Departure date vs. optimum', d.trajectory.offset || 0, -60, 60, 1, 'off', `Launching away from the ideal date raises C3 and arrival speed. Window: ±${2 * (m.window ? m.window.halfWidth : 25)} days.`);
        if (m.type === 'kbo') {
          trajOpts += shell.slider('trajectory.c3', `Launch energy ${term('c3', 'C3')}`, d.trajectory.c3, 80, 220, 1, 'c3', 'More launch energy = faster cruise, but the rocket can lift much less.');
          if (tr.type === 'jga') trajOpts += shell.slider('trajectory.rpRJ', 'Jupiter flyby distance', d.trajectory.rpRJ, 4, 80, 1, 'rj', 'Closer flyby = bigger slingshot, but much more radiation (dose ∝ 1/r²).');
        }
      }
      let orbitOpts = '';
      const O = ORB.ORBITS;
      if (m.type === 'leo') orbitOpts = `<h3>Science orbit</h3>${shell.slider('orbit.alt', 'Altitude', d.orbit.alt, 350, 1100, 10, 'km', 'Lower = sharper images but more atmospheric drag (propellant) and shorter passes over ground stations.')}<div class="opt-grid">${O.eoInc.map((x) => shell.opt('orbit.inc', x.id, d.orbit.inc, x.name, x.desc, [`${x.incDeg}°`, `coverage ${pct(x.coverage)}`])).join('')}</div>`;
      if (m.type === 'moon') orbitOpts = `<h3>Lunar science orbit</h3><div class="opt-grid">${m.orbitOptions.alts.map((a) => shell.opt('orbit.alt', a, d.orbit.alt, `${a} km altitude`, a === 50 ? 'Sharpest data; lumpy gravity makes it costly to maintain.' : a === 100 ? 'Balanced resolution and stability.' : 'Stable and cheap to maintain; lower resolution.')).join('')}</div>
        <div class="opt-grid" style="margin-top:10px">${O.moonInc.map((x) => shell.opt('orbit.inc', x.id, d.orbit.inc, x.name, x.desc)).join('')}</div>`;
      if (m.id === 'mars') orbitOpts = `<h3>Mars science orbit</h3><div class="opt-grid">${O.mars.map((x) => shell.opt('orbit.id', x.id, d.orbit.id, x.name, x.desc)).join('')}</div>`;
      if (m.id === 'asteroid') orbitOpts = `<h3>Proximity operations</h3><div class="opt-grid">${O.asteroid.map((x) => shell.opt('orbit.id', x.id, d.orbit.id, x.name, x.desc)).join('')}</div>`;
      if (m.id === 'jupiter') orbitOpts = `<h3>Jupiter science orbit</h3><div class="opt-grid">${O.jupiter.map((x) => shell.opt('orbit.id', x.id, d.orbit.id, x.name, x.desc)).join('')}</div>`;
      if (m.type === 'kbo') orbitOpts = `<h3>Flyby geometry</h3><div class="opt-grid">${O.kboFlyby.map((x) => shell.opt('orbit.flybyKm', x.km, d.orbit.flybyKm, x.label, `Resolution ×${x.res}; navigation difficulty ×${x.navRisk}.`)).join('')}</div>`;
      return `<div class="tab-body">
        <div class="orbit-canvas-wrap"><canvas id="orbit-cv"></canvas><div class="orbit-overlay" id="orbit-time"></div><div class="orbit-overlay-r"><span class="chip">${esc(tr.windowText || '')}</span></div></div>
        <div class="grid g2" style="margin-top:16px"><div>${trajOpts || '<h3>Direct insertion</h3><p class="muted">The launch vehicle places the spacecraft directly into its science orbit — the trade-offs here are altitude and inclination.</p>'}</div><div>${orbitOpts}</div></div>
        <div data-derived>${this.derivedHTML(ev)}</div></div>`;
    },
    derivedHTML(ev) {
      const tr = ev.traj, m = ev.mission, so = ev.orbit;
      const E = ORB.BODIES.earth;
      const ins = tr.items.find((x) => /insertion|Rendezvous/i.test(x.label));
      const stats = [];
      if (m.type === 'leo') {
        stats.push(['Orbital velocity', `${so.v.toFixed(2)} km/s`, term('orbital-velocity', 'v = √(μ/r)')], ['Orbital period', `${so.periodMin.toFixed(1)} min`, `${(1440 / so.periodMin).toFixed(1)} orbits/day`], ['Eclipse per orbit', `${(so.ecl * so.periodMin).toFixed(0)} min`, so.ecl < 0.02 ? 'dawn–dusk: almost none' : ''], ['Drag make-up', `${(so.skPerYr * 1000).toFixed(1)} m/s/yr`, ''], ['Ground coverage', pct(so.coverage), `${so.incDeg}° inclination`], ['Launch capability', kg(ev.lv.capacity), `incl. inclination & altitude penalties`]);
      } else {
        stats.push([term('c3', 'Launch C3'), `${tr.c3.toFixed(1)} km²/s²`, tr.c3 > 0 ? `v∞ = ${Math.sqrt(tr.c3).toFixed(2)} km/s` : 'bound to Earth'], ['Cruise duration', U.days(ev.time.cruiseD), tr.extraD ? `+${tr.extraD} d aerobraking` : ''],
          [m.type === 'kbo' ? 'Flyby speed' : 'Arrival v∞', `${tr.vinfArr.toFixed(2)} km/s`, ''], [ins ? 'Insertion Δv' : 'Spacecraft Δv', `${((ins ? ins.dv : ev.prop.dvReq) * 1000).toFixed(0)} m/s`, ''],
          [term('light-time', 'Light time at target'), U.dur(ev.geo.owltMeanS), `max ${U.dur(ev.geo.owltMaxS)}`]);
        if (tr.synodicD) stats.push([term('synodic', 'Launch windows'), `every ${(tr.synodicD / 30.44).toFixed(1)} mo`, `${tr.synodicD.toFixed(0)}-day synodic period`]);
        if (tr.jupiter) stats.push(['Jupiter boost', `+${tr.jupiter.dvGain.toFixed(2)} km/s`, `turn ${tr.jupiter.turnDeg.toFixed(1)}° at ${(tr.jupiter.tD / 365.25).toFixed(2)} yr`]);
        if (so.periodMin) stats.push(['Science orbit period', so.periodMin > 2880 ? U.days(so.periodMin / 1440) : `${so.periodMin.toFixed(0)} min`, so.label]);
      }
      const vEsc = Math.sqrt((2 * E.mu) / (E.R + 200)), vC = Math.sqrt(E.mu / (E.R + 200));
      return `<div class="big-stats" style="margin-top:16px">${stats.map(([l, v, s]) => `<div class="big-stat"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`).join('')}</div>
        ${!ev.traj.feasible ? `<div class="note" style="border-color:rgba(255,92,122,.5)"><b class="bad">Infeasible:</b> ${ev.traj.reason}</div>` : ''}
        ${m.type === 'helio' && !tr.ep && tr.type !== 'ega' ? '<div class="subhead"><h4>Trade-off: trip time vs. energy</h4><span class="small muted">sweep of transfer speed</span></div><div id="ch-traj"></div>' : ''}
        ${m.type === 'kbo' ? '<div class="subhead"><h4>Trade-off: launch energy vs. arrival time</h4><span class="small muted">numerically integrated trajectories</span></div><div id="ch-traj"></div>' : ''}
        ${shell.note('Orbital mechanics in this model', `At 200 km, circular ${term('orbital-velocity', 'orbital velocity')} is ${vC.toFixed(2)} km/s and ${term('escape-velocity', 'escape velocity')} is ${vEsc.toFixed(2)} km/s. Interplanetary transfers use <b>patched conics</b>: the Sun's gravity dominates during cruise; the planet's gravity near departure and arrival. ${term('hohmann', 'Hohmann transfers')} use the least energy; faster ellipses trade energy for time (solved with ${term('kepler', 'Kepler\'s equation')}). ${term('gravity-assist', 'Gravity assists')} bend the path around a planet to gain speed. <i>Assumptions: circular, coplanar planetary orbits (except Tessera's 3° tilt); planets assumed phased for the chosen window. Not a flight-dynamics tool.</i>`)}`;
    },
    post(root, ev) {
      const host = root.querySelector('#ch-traj'); if (!host) return;
      const m = ev.mission, d = ev.design;
      if (m.type === 'kbo') {
        const xs = Array.from({ length: 15 }, (_, i) => 90 + i * 9);
        const run = (c3, j) => { const r = ORB.engine.trajectory(m, { ...d, trajectory: { ...d.trajectory, type: j ? 'jga' : 'direct', c3 } }, ev.orbit); return r.feasible ? r.tofD / 365.25 : NaN; };
        U.lineChart(host, { x: xs, xName: 'C3', xFmt: (v) => v.toFixed(0), yFmt: (v) => v.toFixed(1) + ' yr', h: 210, yMin: 0, yMax: 40, yLabel: 'years to 44 AU',
          series: [{ label: 'Direct', color: '#a184ff', data: xs.map((c) => run(c, false)) }, { label: 'Jupiter assist', color: '#4fd8ff', data: xs.map((c) => run(c, true)) }],
          hlines: [{ y: m.maxTravelYears, label: 'mission limit', color: '#ff5c7a' }], points: [{ x: d.trajectory.c3, y: ev.traj.tofD / 365.25, color: '#fff', label: 'you' }] });
        return;
      }
      const xs = Array.from({ length: 21 }, (_, i) => i / 20);
      const res = xs.map((s) => {
        const r = ORB.engine.trajectory(m, { ...d, trajectory: { ...d.trajectory, type: s === 0 ? 'hohmann' : 'fast', speed: s } }, ev.orbit);
        return { tof: r.tofD, c3: r.c3, dv: r.items.reduce((a, x) => a + x.dv, 0) * 1000 };
      });
      U.lineChart(host, { x: xs.map((s) => s * 100), xName: 'Transfer speed', xFmt: (v) => v.toFixed(0) + '%', h: 210, yLabel: 'trip (days)', yFmt: (v) => v.toFixed(0), yFmtR: (v) => U.short(v),
        series: [{ label: 'Trip time (days)', color: '#4fd8ff', data: res.map((r) => r.tof) }, { label: 'Launch C3', color: '#ffc24d', data: res.map((r) => r.c3), axis: 'r' }, { label: 'Spacecraft Δv (m/s ÷ 100)', color: '#a184ff', data: res.map((r) => r.dv / 100), axis: 'r' }],
        markers: [{ x: (ev.traj.type === 'fast' ? d.trajectory.speed || 0 : 0) * 100, label: 'you', color: '#fff' }] });
    },
  };
})();
