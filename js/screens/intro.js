/* ORBITAL — Landing, Mission Select, Briefing */
(function () {
  const ORB = window.ORB, U = ORB.ui, P = ORB.phys;
  const { esc, f, money, pct } = U;

  /* live model-validation figures (computed by the same engine the game uses) */
  ORB.validation = () => {
    const B = ORB.BODIES;
    const mars = P.helioTransfer(1, B.mars.aAU, B.mars.aAU);
    const jup = P.helioTransfer(1, B.jupiter.aAU, B.jupiter.aAU);
    const a53 = P.smaFromPeriod(B.jupiter.mu, 53 * 86400), rp = 1.06 * B.jupiter.R;
    const joi = P.captureDv(B.jupiter.mu, jup.vinfArr, rp, 2 * a53 - rp);
    const nh = P.integrateOutbound({ c3: 157.7, targetAU: 32.9, jga: { rpRJ: 32 } });
    const lro = P.periodS(B.moon.mu, B.moon.R + 50) / 60;
    const iss = P.periodS(B.earth.mu, B.earth.R + 420) / 60;
    return [
      ['Earth → Mars Hohmann transfer time', `${mars.tofD.toFixed(0)} days`, '≈ 259 days (textbook value)'],
      ['Jupiter orbit insertion into a 53-day orbit (Juno-like)', `${(joi * 1000).toFixed(0)} m/s`, '≈ 542 m/s (Juno, 2016)'],
      ['Launch C3 157.7 km²/s² + Jupiter assist: time to Jupiter', `${(nh.jupiter.tD / 365.25).toFixed(2)} yr`, '≈ 1.1 yr (New Horizons, 2006→2007)'],
      ['…and time to reach 32.9 AU (Pluto\'s distance in 2015)', `${(nh.tofD / 365.25).toFixed(1)} yr`, '≈ 9.5 yr (New Horizons)'],
      ['Orbital period at 50 km above the Moon', `${lro.toFixed(0)} min`, '≈ 113 min (LRO mapping orbit)'],
      ['Orbital period at 420 km above Earth', `${iss.toFixed(1)} min`, '≈ 92–93 min (ISS)'],
    ];
  };

  /* ===================================================================== LANDING */
  ORB.screens.home = {
    title: 'Home',
    render(el) {
      const S = ORB.store;
      const run = S.run, m = run && S.mission();
      el.innerHTML = `<div class="screen">
        <section class="hero">
          <div>
            <div class="eyebrow">NASA Space Apps Challenge · Mission design simulator</div>
            <h1>ORBITAL</h1>
            <div class="beyond">Beyond the Mission</div>
            <p class="lede">You are the mission director. Design a spacecraft, choose its rocket and route, launch it — then fly it through solar storms, failing hardware and hours-long light delays. Every number is computed from real physics, and every decision has consequences.</p>
            <div class="hero-cta">
              ${run ? `<button class="btn primary lg" data-go="resume">▶ Resume ${esc(m.name)}</button><button class="btn lg" data-go="missions">New mission</button>` : `<button class="btn primary lg" data-go="missions">Begin mission campaign →</button>`}
              <button class="btn lg ghost" data-go="library">How it works</button>
            </div>
            <div class="hero-stats"><div><b>6</b>mission classes</div><div><b>40+</b>components & instruments</div><div><b>15</b>lifecycle phases</div><div><b>100%</b>physics-driven telemetry</div></div>
          </div>
          <div class="hero-canvas-wrap"><canvas id="hero-cv"></canvas></div>
        </section>
        <section class="section">
          <div class="eyebrow">The game loop</div><h2>From concept to final report — one connected system</h2>
          <div class="grid g4" style="margin-top:20px">
            ${[['01', 'Design', 'Configure power, propulsion, telecom, thermal, structure, computing and instruments. A live engineering summary recomputes mass, power, Δv, cost and reliability as you go.'],
              ['02', 'Plan', 'Pick a launch vehicle and a trajectory: Hohmann, fast transfers, gravity assists or electric spirals — computed with patched conics and Kepler\'s equation.'],
              ['03', 'Launch & operate', 'Watch your rocket fly. Then run mission control: telemetry from your actual design, anomalies driven by your choices, decisions delayed by light time.'],
              ['04', 'Evaluate', 'A presentation-ready mission report scores science, engineering, budget and operations — and explains which decisions helped or hurt.']]
              .map(([n, t, d]) => `<div class="panel feature"><div class="num">${n}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
          </div>
        </section>
        <section class="section" style="padding-top:0">
          <div class="grid g2">
            <div class="panel panel-pad"><div class="eyebrow">Scientifically grounded</div><h3 style="margin-top:6px">The model reproduces real missions</h3>
              <p class="small muted">Computed live by the same engine you play with, compared with published values. <span class="tag model">model</span> vs <span class="tag real">real</span></p>
              ${ORB.validation().map(([a, b, c]) => `<div class="validation-row"><span>${a}</span><span class="mono cyan">${b}</span><span class="small muted">${c}</span></div>`).join('')}</div>
            <div class="panel panel-pad"><div class="eyebrow">Full lifecycle</div><h3 style="margin-top:6px">Fifteen phases of a real mission</h3>
              <div class="lifecycle" style="margin-top:12px">${['Mission briefing', 'Objectives', 'Destination', 'Spacecraft architecture', 'Instruments', 'Launch vehicle', 'Budget & resources', 'Trajectory & orbit', 'Readiness review', 'Launch', 'Flight operations', 'Science collection', 'Communications', 'Mission completion', 'Final report'].map((s, i) => `<span><i>${String(i + 1).padStart(2, '0')}</i>${s}</span>`).join('')}</div>
              <div class="sep"></div>
              <p class="small muted">Values are labelled throughout: <span class="tag real">real</span> physical facts & constants, <span class="tag model">model</span> simplified educational approximations, <span class="tag game">fictional</span> game hardware, vehicles, costs and the agency itself.</p></div>
          </div>
        </section>
        <footer class="footer">ORBITAL: Beyond the Mission — an independent educational project created for the NASA Space Apps Challenge. Not affiliated with, produced by or endorsed by NASA. The "Orbital Exploration Directorate (OXD)", its missions, hardware, rockets and costs are fictional. <a href="#/library">Sources & assumptions</a></footer></div>`;
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-go]'); if (!b) return;
        const g = b.dataset.go;
        if (g === 'resume') ORB.app.resume(); else ORB.app.go(g);
      });
      // hero animation: Earth → Mars transfer with a probe
      const cv = el.querySelector('#hero-cv');
      const tr = P.helioTransfer(1, 1.52368, 1.52368);
      const path = Array.from({ length: 120 }, (_, i) => { const t = (tr.tofD * i) / 119; const p = P.ellipsePos(tr.a, tr.e, t * 86400); return { x: p.r * Math.cos(p.theta), y: p.r * Math.sin(p.theta), t }; });
      const thetaT0 = Math.PI - (2 * Math.PI * tr.tofD) / ORB.BODIES.mars.periodD;
      let raf; const t0 = performance.now();
      const draw = () => {
        const { ctx, w, h } = U.fitCanvas(cv, cv.clientWidth);
        const ts = (performance.now() - t0) / 1000, loop = 12, tD = ((ts % loop) / loop) * tr.tofD * 1.1;
        let i = 0; while (i < path.length - 1 && path[i].t < tD) i++;
        const a = path[Math.max(0, i - 1)], b = path[i];
        const thE = (2 * Math.PI * tD) / 365.25, thM = thetaT0 + (2 * Math.PI * tD) / ORB.BODIES.mars.periodD;
        ORB.art.drawHelio(ctx, w, h, { orbits: [{ r: 0.387, color: '#9a9aa6', dash: [2, 5] }, { r: 0.723, color: '#e8c26a', dash: [2, 5] }, { r: 1, color: '#4aa3ff' }, { r: 1.524, color: '#e2694a' }], maxR: 1.75, path, pathSplit: i,
          sc: { x: b.x, y: b.y, ang: Math.atan2(-(b.y - a.y), b.x - a.x) }, earth: { x: Math.cos(thE), y: Math.sin(thE) }, target: { x: 1.524 * Math.cos(thM), y: 1.524 * Math.sin(thM), color: '#e2694a', label: 'Mars' }, comm: true }, ts);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(raf);
    },
  };

  /* ===================================================================== MISSION SELECT */
  ORB.screens.missions = {
    title: 'Missions',
    render(el) {
      const S = ORB.store, pf = S.profile;
      let diff = pf.difficulty || 'engineer';
      let sbMission = 'mars', sbBudget = ORB.SANDBOX_BUDGET.def;
      const draw = () => {
        el.innerHTML = `<div class="wrap screen">
          <div class="row between" style="align-items:flex-end;margin-bottom:18px"><div><div class="eyebrow">Orbital Exploration Directorate · Mission Board</div><h1 style="margin:6px 0 0">Select your mission</h1>
            <p class="muted" style="max-width:640px;margin-top:6px">Six mission classes, each with its own engineering problem. Complete a mission with at least a Partial Success to unlock the next ones.</p></div>
            <div class="stack" style="text-align:right"><div class="small muted">Difficulty</div><div class="seg" role="radiogroup">${ORB.DIFFICULTY.map((d) => `<button class="${diff === d.id ? 'on' : ''}" data-diff="${d.id}" title="${esc(d.desc)}">${d.name}</button>`).join('')}</div>
              <div class="small dim">${esc(ORB.DIFFICULTY.find((x) => x.id === diff).desc)}</div></div></div>
          <div class="grid g3">${ORB.MISSIONS.map((m) => {
            const un = S.isUnlocked(m), best = pf.best[m.id];
            return `<div class="panel mission-card ${un ? '' : 'locked'}" data-mission="${m.id}" tabindex="${un ? 0 : -1}" role="button" aria-disabled="${!un}">
              ${un ? '' : '<span class="chip lock-badge">🔒 Locked</span>'}
              <div class="art">${ORB.art.missionArt(m)}</div>
              <div class="body"><div class="cat" style="color:${m.color}">${esc(m.category)}</div><h3>${esc(m.name)}</h3><div class="tagline">${esc(m.tagline)}</div>
                <div class="meta"><span class="chip"><span class="diff-pips">${[1, 2, 3, 4].map((i) => `<i class="${i <= m.difficulty ? 'on' : ''}"></i>`).join('')}</span> ${m.diffLabel}</span>
                  <span class="chip">budget <b>${money(m.budget * ORB.DIFFICULTY.find((x) => x.id === diff).budgetMult)}</b></span>
                  ${best ? `<span class="chip good">best ${best.score} · ${esc(best.rating)}</span>` : ''}</div></div></div>`;
          }).join('')}</div>
          <div class="panel panel-pad" style="margin-top:22px"><div class="row between"><div><div class="eyebrow" style="color:var(--violet)">Free-design sandbox</div><h3 style="margin:6px 0 4px">Sandbox mode</h3>
            <p class="small muted" style="margin:0;max-width:640px">Any destination, your own budget, no campaign locks. Perfect for experimenting with extreme designs — sandbox results don't count toward personal bests.</p></div>
            <div class="row"><select id="sb-m" aria-label="Sandbox destination">${ORB.MISSIONS.map((m) => `<option value="${m.id}" ${sbMission === m.id ? 'selected' : ''}>${esc(m.category)} — ${esc(m.name)}</option>`).join('')}</select>
              <div style="min-width:220px"><div class="field-h" style="margin:0 0 4px"><span class="small muted">Budget</span><span class="val mono cyan" id="sb-bv">${money(sbBudget)}</span></div><input type="range" id="sb-b" min="${ORB.SANDBOX_BUDGET.min}" max="${ORB.SANDBOX_BUDGET.max}" step="10" value="${sbBudget}"></div>
              <button class="btn violet" data-sandbox>Open sandbox →</button></div></div></div>
          <div class="row" style="margin-top:16px;justify-content:space-between"><label class="switch"><input type="checkbox" id="unlock-all" ${pf.unlockAll ? 'checked' : ''}><span class="track"></span><span class="lbl">Unlock all missions (demo / judging mode)</span></label>
            <label class="switch"><input type="checkbox" id="launch-fail" ${pf.launchFailures ? 'checked' : ''}><span class="track"></span><span class="lbl">Realistic launch failures</span></label></div></div>`;
        const r = el.querySelector('#sb-b'); U.setRange(r);
        r.addEventListener('input', () => { sbBudget = +r.value; U.setRange(r); el.querySelector('#sb-bv').textContent = money(sbBudget); });
        el.querySelector('#sb-m').addEventListener('change', (e) => { sbMission = e.target.value; });
        el.querySelector('#unlock-all').addEventListener('change', (e) => { pf.unlockAll = e.target.checked; S.saveProfile(); draw(); });
        el.querySelector('#launch-fail').addEventListener('change', (e) => { pf.launchFailures = e.target.checked; S.saveProfile(); });
      };
      const start = async (id, sandbox) => {
        if (S.run && S.run.launched && !S.run.simState?.outcome) {
          const ok = await U.confirm('Abandon current mission?', `${esc(S.mission().name)} is still in flight. Starting a new mission will end it.`, 'Start new mission', true);
          if (!ok) return;
        }
        S.newRun(id, { difficulty: diff, sandbox, budget: sandbox ? sbBudget : null });
        ORB.app.go('briefing');
      };
      el.addEventListener('click', (e) => {
        const d = e.target.closest('[data-diff]'); if (d) { diff = d.dataset.diff; pf.difficulty = diff; S.saveProfile(); draw(); return; }
        const c = e.target.closest('[data-mission]');
        if (c) { const m = ORB.MISSION_BY_ID[c.dataset.mission]; if (!S.isUnlocked(m)) { U.toast(`Complete an earlier mission to unlock ${esc(m.name)} — or enable demo mode below.`, 'warn', '🔒'); return; } start(m.id, false); return; }
        if (e.target.closest('[data-sandbox]')) start(sbMission, true);
      });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.mission) e.target.click(); });
      draw();
    },
  };

  /* ===================================================================== BRIEFING */
  const FACTS = {
    eo: [['Earth mean radius', '6,371 km', 'real'], ['Orbital speed at 700 km', '7.5 km/s', 'real'], ['Orbits per day at 700 km', '≈ 14.6', 'real'], ['Battery cycles per year (eclipse each orbit)', '≈ 5,300', 'real'], ['Radio delay to ground', '< 0.01 s', 'real']],
    moon: [['Mean distance from Earth', '384,400 km', 'real'], ['Surface gravity', '1.62 m/s²', 'real'], ['One-way light time', '≈ 1.3 s', 'real'], ['Atmosphere', 'none', 'real'], ['Solar day', '29.5 Earth days', 'real']],
    mars: [['Mean distance from Sun', '1.52 AU', 'real'], ['Sunlight vs Earth', '≈ 36–52%', 'real'], ['Distance from Earth', '0.37 – 2.68 AU', 'real'], ['One-way light time', '3 – 22 min', 'real'], ['Surface gravity', '3.71 m/s²', 'real']],
    asteroid: [['Orbit (semi-major axis)', '1.32 AU', 'game'], ['Diameter', '≈ 700 m', 'game'], ['Surface gravity', '≈ 0.00004 m/s²', 'game'], ['Orbit tilt vs Earth', '3°', 'game'], ['Type', 'carbon-rich rubble pile', 'game']],
    jupiter: [['Mean distance from Sun', '5.2 AU', 'real'], ['Sunlight vs Earth', '≈ 3.7% (1/27)', 'real'], ['Equatorial radius', '71,492 km', 'real'], ['One-way light time', '33 – 53 min', 'real'], ['Radiation', 'most intense belts of any planet', 'real']],
    kbo: [['Distance from Sun', '44 AU', 'game'], ['Sunlight vs Earth', '≈ 0.05% (1/1,936)', 'real'], ['One-way light time', '≈ 6.1 h', 'real'], ['Diameter', '≈ 30 km, two-lobed', 'game'], ['Surface temperature', '≈ 40 K (−233 °C)', 'model']],
  };
  const CHALLENGES = {
    eo: ['Atmospheric drag slowly lowers low orbits — carry propellant or fly higher.', 'An eclipse every ~100 minutes means thousands of battery cycles per year.', 'Orbital-debris rules require disposal within 25 years.', 'The orbit plane sets the lighting your cameras see.'],
    moon: ['Lunar orbit insertion requires a ~0.8 km/s braking burn.', 'Lumpy lunar gravity (mascons) disturbs low orbits.', 'Only a polar orbit sees the poles.', 'The sunlit lunar surface radiates intense heat at the spacecraft.'],
    mars: ['Launch windows open only every ~26 months.', 'Earth–Mars distance varies 7×: the radio link must work at 2.7 AU.', 'Capture costs ~2 km/s — or months of risky aerobraking.', 'Solar conjunction cuts contact for weeks.'],
    asteroid: ['No useful gravity to help capture: ~2.3 km/s of rendezvous Δv from the spacecraft alone.', 'Electric propulsion could do it with far less propellant — if you can power it.', 'Weak, lumpy gravity makes close orbits delicate.'],
    jupiter: ['Sunlight is 27× weaker: enormous arrays or radioisotope power.', 'Radiation can destroy unshielded electronics.', 'A 5–6 year cruise and a ~0.5–0.9 km/s insertion burn.', 'Light time of up to 53 minutes each way.'],
    kbo: ['Solar power is useless: you need radioisotope power.', 'Even Jupiter\'s slingshot leaves a ~15-year cruise.', 'The flyby is a one-shot, fully autonomous event.', 'Data trickles home at hundreds of bits per second.'],
  };
  ORB.screens.briefing = {
    title: 'Briefing',
    render(el) {
      const S = ORB.store, m = S.mission(), ev = S.evaluate();
      const diff = ORB.DIFFICULTY.find((x) => x.id === S.run.difficulty);
      el.innerHTML = `<div class="wrap screen">
        <div class="panel panel-pad" style="display:flex;gap:26px;align-items:center;flex-wrap:wrap;background:linear-gradient(120deg,rgba(10,24,52,.8),rgba(30,16,60,.5))">
          ${ORB.art.patch(m, 150)}
          <div style="flex:1;min-width:260px"><div class="transmission">INCOMING TRANSMISSION · OXD MISSION DIRECTORATE</div>
            <h1 style="margin:8px 0 2px;letter-spacing:.08em">${esc(m.name)}</h1><div class="eyebrow" style="color:${m.color}">${esc(m.category)} · ${S.run.sandbox ? 'Sandbox' : diff.name} · Budget ${money(ev.cost.budget)}</div>
            <p class="story typed" id="story" style="margin-top:14px"></p></div></div>
        <div class="briefing-grid" style="margin-top:18px">
          <div class="stack">
            <div class="panel"><div class="panel-h"><h3>Mission objectives</h3><span class="small muted">weighted toward your science score</span></div><div class="panel-pad" style="padding-top:4px">
              ${m.objectives.map((o) => `<div class="obj"><span class="w">${pct(o.weight)}</span><div><b>${esc(o.name)}</b><div class="small muted">${esc(o.desc)}</div>
                <div class="row" style="gap:4px;margin-top:6px">${o.inst.map((id) => `<span class="chip">${esc((ORB.INSTRUMENT_BY_ID[id] || ORB.RADIO_SCIENCE).short)}</span>`).join('')}</div></div><span class="small dim">${o.needDays} obs-days</span></div>`).join('')}</div></div>
            <div class="panel panel-pad"><h3>Engineering challenges</h3><ul style="margin:6px 0 0 18px;padding:0;color:#cddcf2">${CHALLENGES[m.id].map((c) => `<li style="margin:6px 0">${c}</li>`).join('')}</ul></div>
          </div>
          <div class="stack">
            <div class="panel panel-pad"><div class="row" style="gap:14px;align-items:center">${ORB.art.planet(ORB.art.destKind(m), 72)}<div><h3 style="margin:0">Destination</h3><div class="muted small">${esc(m.id === 'eo' ? 'Low Earth orbit' : (ORB.BODIES[m.dest] || {}).name || '')}${ORB.BODIES[m.dest] && ORB.BODIES[m.dest].fictional ? ' <span class="tag game">fictional</span>' : ''}</div></div></div>
              <div style="margin-top:10px">${FACTS[m.id].map(([a, b, t]) => `<div class="fact"><span>${a} <span class="tag ${t}">${t === 'game' ? 'fictional' : t}</span></span><span>${b}</span></div>`).join('')}</div></div>
            <div class="panel panel-pad"><h3>Constraints</h3>${m.constraints.map((c) => `<div class="fact"><span>•</span><span style="font-family:var(--font);text-align:left;flex:1">${esc(c)}</span></div>`).join('')}</div>
            <div class="panel panel-pad" style="border-color:${ev.readiness.go ? 'rgba(255,194,77,.35)' : 'rgba(255,92,122,.4)'}"><div class="eyebrow" style="color:var(--warn)">Status of the draft design</div>
              <p style="margin:8px 0">Engineering has prepared a draft spacecraft. It currently has <b class="bad">${ev.readiness.fails} blocking issue${ev.readiness.fails === 1 ? '' : 's'}</b> and <b class="warn">${ev.readiness.warns} warning${ev.readiness.warns === 1 ? '' : 's'}</b>, with projected science of <b>${ev.science.index.toFixed(0)}%</b>. Your job: fix it, then make it great.</p>
              <button class="btn primary lg" style="width:100%" data-go="design">Enter the Design Studio →</button></div>
          </div></div></div>`;
      // typewriter
      const story = el.querySelector('#story'); const txt = m.story; let i = 0;
      const iv = setInterval(() => { i += 3; story.textContent = txt.slice(0, i); if (i >= txt.length) { clearInterval(iv); story.classList.remove('typed'); } }, 16);
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) ORB.app.go(b.dataset.go); });
      return () => clearInterval(iv);
    },
  };
})();
