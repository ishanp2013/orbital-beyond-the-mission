/* ORBITAL — Launch: physics-consistent outcome + cinematic sequence */
(function () {
  const ORB = window.ORB, U = ORB.ui, P = ORB.phys;
  const { esc, f, pct } = U;

  /* Decide what the launch actually achieves, from the design (deterministic per seed). */
  ORB.computeLaunch = (ev, seed, allowFailure) => {
    const rnd = P.rng(seed ^ 0x5bd1e995);
    const lv = ev.parts.lv, d = ev.design, tr = ev.traj, mass = ev.mass.launch;
    const res = { catastrophic: false, shortfallDv: 0, c3Req: tr.c3, c3Ach: tr.c3, note: '', anomalyNote: '', mode: tr.mode, events: [] };
    const muE = ORB.BODIES.earth.mu, rP = ORB.BODIES.earth.R + 200, vesc2 = (2 * muE) / rP;
    // performance shortfall from overweight
    if (tr.mode === 'leo') {
      const ratio = mass / ev.lv.capacity;
      if (ratio > 1) {
        const dv = 0.45 * 3.43 * Math.log(ratio);
        if (dv > 0.25) { res.catastrophic = true; res.failPhase = 'orbit'; res.note = `The ${lv.name} was carrying ${pct(ratio - 1)} more than it can lift. It ran out of propellant ${(dv * 1000).toFixed(0)} m/s short of orbital velocity; the upper stage and spacecraft re-entered over the ocean.`; }
        else { res.shortfallDv = dv; res.anomalyNote = `Overweight launch: the upper stage depleted ${(dv * 1000).toFixed(0)} m/s short of the target orbit. The spacecraft must make up the difference with its own propellant.`; }
      }
    } else {
      const ach = P.lvAchievedC3(lv, mass, d.kick, ev.parts.site.lat);
      if (ach < tr.c3 - 0.05) {
        res.c3Ach = ach;
        if (ach < -45) { res.catastrophic = true; res.failPhase = 'orbit'; res.note = `The spacecraft was far too heavy for the ${lv.name}: it could not even reach a stable parking orbit (achieved C3 ${ach.toFixed(0)} km²/s²).`; }
        else {
          const v = (c3) => Math.sqrt(Math.max(0, c3 + vesc2));
          res.shortfallDv = v(tr.c3) - v(ach);
          res.anomalyNote = `Overweight launch: departure energy C3 ${ach.toFixed(1)} instead of ${tr.c3.toFixed(1)} km²/s². The spacecraft must burn ${(res.shortfallDv * 1000).toFixed(0)} m/s of its own Δv to get back on course.`;
        }
      }
    }
    // random vehicle anomaly (reliability)
    if (!res.catastrophic) {
      const roll = rnd();
      const rel = ev.lv.rel;
      if (roll > rel) {
        if (allowFailure && rnd() < 0.35) { res.catastrophic = true; res.failPhase = rnd() < 0.5 ? 'stage1' : 'stage2'; res.note = `A ${res.failPhase === 'stage1' ? 'first-stage engine' : 'second-stage turbopump'} failure destroyed the vehicle. The ${lv.name} has ${pct(rel, 1)} reliability — about 1 launch in ${Math.round(1 / (1 - rel))} fails.`; }
        else { const dv = 0.03 + rnd() * 0.05; res.shortfallDv += dv; res.anomalyNote = (res.anomalyNote ? res.anomalyNote + ' ' : '') + `Upper-stage underperformance left the spacecraft ${(dv * 1000).toFixed(0)} m/s short; it will correct with its own propellant.`; }
      }
    }
    return res;
  };

  ORB.screens.launch = {
    title: 'Launch',
    render(el) {
      const S = ORB.store, m = S.mission(), ev = S.evaluate();
      const lv = ev.parts.lv;
      if (!S.run.launch) S.run.launch = ORB.computeLaunch(ev, S.run.seed + S.run.attempt * 7919, S.profile.launchFailures);
      const L = S.run.launch;
      const leo = ev.traj.mode === 'leo';
      const sepT = leo ? 620 : d2(ev) ? 3300 : 2900;
      function d2() { return ev.design.kick; }
      const vTarget = leo ? ORB.phys.vCirc(ORB.BODIES.earth.mu, ORB.BODIES.earth.R + ev.orbit.alt) : Math.sqrt(Math.max(0, L.c3Ach + (2 * ORB.BODIES.earth.mu) / (ORB.BODIES.earth.R + 200)));
      const failT = L.catastrophic ? (L.failPhase === 'stage1' ? 95 : L.failPhase === 'stage2' ? 330 : 520) : Infinity;
      const EV = [
        [-10, 'Launch director: all stations, final poll complete. Terminal count.', 'info'], [-6, 'Range: GO · Weather: GO · Flight dynamics: GO', 'good'], [-4, `Spacecraft: ${ev.power.launchOk ? 'on internal power, GO' : 'on internal power — battery marginal'}`, ev.power.launchOk ? 'good' : 'warn'],
        [-2, S.run.overrode ? 'Flight director: proceeding under review-board waiver.' : 'Flight director: GO for launch.', S.run.overrode ? 'warn' : 'good'], [-0.5, 'Ignition sequence start.', 'info'],
        [0, `Liftoff! ${lv.name} has cleared the pad with ${esc(m.name)}.`, 'good'], [12, 'Tower cleared. Roll program initiated.', 'info'], [62, 'Max-Q — maximum aerodynamic pressure.', 'warn'],
        ...(lv.boosters ? [[115, 'Booster separation confirmed.', 'info']] : []), [160, 'MECO — main engine cutoff.', 'info'], [164, 'Stage separation.', 'info'], [170, 'Second-stage ignition.', 'info'], [215, 'Fairing separation — the spacecraft sees space for the first time.', 'good'],
        [540, leo ? 'SECO — orbit insertion burn complete.' : 'SECO-1 — parking orbit reached. Coasting to departure point.', 'good'],
        ...(!leo ? [[1500, `Second burn: ${ev.traj.c3 < 0 ? 'translunar injection' : 'Earth departure burn'}.`, 'info']] : []), ...(!leo && ev.design.kick ? [[2200, 'Kick-stage burn: adding energy for the outer solar system.', 'info']] : []),
        [sepT - 60, L.anomalyNote ? L.anomalyNote : 'Upper stage cutoff: trajectory nominal.', L.anomalyNote ? 'warn' : 'good'], [sepT, 'Spacecraft separation confirmed!', 'good'],
      ].filter((e) => e[0] < failT);
      if (L.catastrophic) EV.push([failT, L.failPhase === 'orbit' ? 'Velocity insufficient for orbit — vehicle and spacecraft lost.' : 'Telemetry lost. Vehicle anomaly — range safety confirms loss of vehicle.', 'bad']);
      const endT = L.catastrophic ? failT + 4 : sepT + 20;
      // wall-clock → mission-time mapping (fast-forward after fairing separation)
      const segs = [[-10, 0, 1.2], [0, 220, 12], [220, 600, 60], [600, 4000, 260]];
      const missionT = (wall) => { let w = wall, t = -10; for (const [a, b, sp] of segs) { const dur = (b - a) / sp; if (w <= dur) return a + w * sp; w -= dur; t = b; } return t; };

      el.innerHTML = `<div class="launch-screen screen"><canvas id="lc"></canvas>
        <div class="launch-hud">
          <div class="hud-side stack"><div class="hud-panel"><div class="eyebrow">Vehicle telemetry</div>
            <div class="hud-row"><span>Altitude</span><span id="t-alt">0 km</span></div><div class="hud-row"><span>Velocity</span><span id="t-vel">0 m/s</span></div>
            <div class="hud-row"><span>Downrange</span><span id="t-dr">0 km</span></div><div class="hud-row"><span>Acceleration</span><span id="t-acc">0.0 g</span></div><div class="hud-row"><span>Stage</span><span id="t-stg">1</span></div></div>
            <div class="hud-panel small"><div class="eyebrow">Payload</div><div class="hud-row"><span>Vehicle</span><span>${esc(lv.name)}</span></div><div class="hud-row"><span>Launch mass</span><span>${f(ev.mass.launch)} kg</span></div>
              <div class="hud-row"><span>Capability</span><span class="${ev.lv.margin < 0 ? 'bad' : ''}">${f(ev.lv.capacity)} kg</span></div><div class="hud-row"><span>Target</span><span>${leo ? `${ev.orbit.alt} km orbit` : `C3 ${ev.traj.c3.toFixed(1)}`}</span></div></div></div>
          <div class="hud-center" style="display:flex;flex-direction:column;align-items:center;gap:8px"><div class="hud-panel" style="min-width:260px;text-align:center"><div class="eyebrow" id="t-phase">TERMINAL COUNT</div><div class="hud-big" id="t-clock">T−00:10</div></div>
            <button class="btn sm" id="skip">Skip to separation ▶▶</button></div>
          <div class="hud-side"><div class="hud-panel"><div class="eyebrow">Mission control loop</div><div class="callouts" id="calls"></div></div></div></div></div>`;

      const cv = el.querySelector('#lc');
      const calls = el.querySelector('#calls');
      let shown = 0, raf, done = false, skip = false;
      const t0 = performance.now();
      const parts = [];
      const debris = [];
      const stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3 }));
      const alt = (t) => (t <= 0 ? 0 : t < 160 ? 70 * Math.pow(t / 160, 1.6) : t < 540 ? 70 + (Math.min(200, leo ? ev.orbit.alt : 200) - 70) * (1 - Math.pow(1 - (t - 160) / 380, 2)) : t < 1500 ? (leo ? ev.orbit.alt : 200) : 200 + (t - 1500) * 0.9);
      const vel = (t) => (t <= 0 ? 0 : t < 160 ? 2300 * Math.pow(t / 160, 1.5) : t < 540 ? 2300 + (7790 - 2300) * ((t - 160) / 380) : t < 1500 ? 7790 : t < 1500 + 400 ? 7790 + (vTarget * 1000 - 7790) * ((t - 1500) / 400) : vTarget * 1000);
      const draw = () => {
        const wall = (performance.now() - t0) / 1000;
        let t = skip ? endT : missionT(wall);
        const { ctx, w, h } = U.fitCanvas(cv, cv.parentElement.clientHeight);
        const A = alt(t), V = vel(t);
        // sky
        const k = Math.min(1, A / 90);
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, `rgb(${Math.round(30 * (1 - k))},${Math.round(80 * (1 - k)) + 2},${Math.round(160 * (1 - k)) + 8})`);
        g.addColorStop(1, `rgb(${Math.round(120 * (1 - k)) + 2},${Math.round(170 * (1 - k)) + 6},${Math.round(220 * (1 - k)) + 16})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        stars.forEach((s) => { ctx.fillStyle = `rgba(255,255,255,${k * 0.9})`; ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 6.283); ctx.fill(); });
        // Earth limb when high
        if (A > 60) { const lim = h + 2600 - Math.min(2400, A * 6); ctx.fillStyle = '#0d3a7a'; ctx.beginPath(); ctx.arc(w / 2, lim, 2600, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(120,200,255,.6)'; ctx.lineWidth = 6; ctx.stroke(); ctx.lineWidth = 1; }
        // ground & pad
        const scale = Math.min(h / 140, 5.2);
        const rx = w / 2, baseY0 = h - 70;
        const climb = Math.min(h * 0.42, A * 1000 * 0.25);
        const ybPre = A > 0 ? Math.max(h * 0.62, baseY0 - climb) : baseY0;
        const groundY = ybPre + A * 250;
        if (groundY < h + 400) {
          ctx.fillStyle = '#0b1220'; ctx.fillRect(0, groundY, w, h);
          ctx.fillStyle = '#1b2638'; ctx.fillRect(rx - 120, groundY - 6, 240, 8);
          ctx.fillStyle = '#334055'; ctx.fillRect(rx + lv.fairingD * scale * 0.7 + 8, groundY - lv.heightM * scale * 1.05, 10, lv.heightM * scale * 1.05);
        }
        const rocketBase = Math.min(baseY0, groundY) - 2;
        const ry = A > 0 ? baseY0 - climb * 0 : baseY0;
        const yb = (A > 0 ? Math.max(h * 0.62, baseY0 - climb) : baseY0) + (t > 0 && t < 4 ? Math.random() * 1.5 : 0);
        const stage = t < 164 ? 1 : 2;
        const fairing = t < 215;
        // rocket
        const sc = scale * (A > 100 ? Math.max(0.55, 1 - (A - 100) / 400) : 1);
        const bw = Math.max(10, lv.fairingD * sc * 0.9);
        const H1 = lv.heightM * sc * 0.55, H2 = lv.heightM * sc * 0.25, HF = lv.heightM * sc * 0.2;
        const lost = L.catastrophic && t >= failT;
        if (!lost && t < sepT + 1) {
          let y = yb;
          const flame = t >= -0.5 ? (t < 0 ? 0.4 : 1) : 0;
          if (flame) {
            const fl = (stage === 1 ? 70 : 40) * sc / 4 * (0.85 + Math.random() * 0.3) * (A > 50 ? 1.6 : 1);
            const fg = ctx.createLinearGradient(0, y, 0, y + fl);
            fg.addColorStop(0, 'rgba(255,255,230,1)'); fg.addColorStop(0.3, 'rgba(255,190,90,.9)'); fg.addColorStop(1, 'rgba(255,90,30,0)');
            ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(rx - bw * 0.35, y); ctx.lineTo(rx + bw * 0.35, y); ctx.lineTo(rx + bw * (A > 50 ? 0.9 : 0.15), y + fl); ctx.lineTo(rx - bw * (A > 50 ? 0.9 : 0.15), y + fl); ctx.closePath(); ctx.fill();
            if (A < 30 && t > 0) for (let i = 0; i < 4; i++) parts.push({ x: rx + (Math.random() - 0.5) * bw, y: y + fl * 0.6, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, life: 1 });
          }
          if (stage === 1) {
            ctx.fillStyle = '#e9eef6'; ctx.fillRect(rx - bw / 2, y - H1, bw, H1);
            ctx.fillStyle = lv.color; ctx.fillRect(rx - bw / 2, y - H1 * 0.6, bw, 4);
            if (lv.boosters && t < 115) for (const s of [-1, 1]) { ctx.fillStyle = '#d9e0ea'; ctx.fillRect(rx + s * (bw / 2 + bw * 0.2) - bw * 0.2, y - H1 * 0.55, bw * 0.4, H1 * 0.55); }
            y -= H1;
          }
          ctx.fillStyle = '#f1f4f9'; ctx.fillRect(rx - bw / 2, y - H2, bw, H2); ctx.fillStyle = lv.color; ctx.fillRect(rx - bw / 2, y - H2 + 3, bw, 3); y -= H2;
          if (fairing) { ctx.fillStyle = '#f7f9fc'; ctx.beginPath(); ctx.moveTo(rx - bw / 2, y); ctx.bezierCurveTo(rx - bw / 2, y - HF * 0.7, rx - bw * 0.1, y - HF, rx, y - HF); ctx.bezierCurveTo(rx + bw * 0.1, y - HF, rx + bw / 2, y - HF * 0.7, rx + bw / 2, y); ctx.fill(); }
          else { ctx.fillStyle = '#e8c26a'; ctx.fillRect(rx - bw * 0.3, y - bw * 0.5, bw * 0.6, bw * 0.5); }
          if (t > 55 && t < 70) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(rx, yb - H1 * 0.7, bw * 1.4, H1 * 0.3, 0, 0, 6.283); ctx.fill(); }
        }
        if (t >= sepT && !lost) { const dx = Math.min(80, (t - sepT) * 6); ctx.fillStyle = '#e8c26a'; ctx.fillRect(rx - 8 + dx, yb - H2 - 30 - dx * 0.3, 16, 12); ctx.fillStyle = '#2b5fc4'; ctx.fillRect(rx - 26 + dx, yb - H2 - 26 - dx * 0.3, 16, 4); ctx.fillRect(rx + 10 + dx, yb - H2 - 26 - dx * 0.3, 16, 4); }
        if (lost) { for (let i = 0; i < 6; i++) parts.push({ x: rx + (Math.random() - 0.5) * 60, y: yb - 40 + (Math.random() - 0.5) * 60, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1, fire: true }); }
        // particles
        for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.012; if (p.life <= 0) { parts.splice(i, 1); continue; } ctx.fillStyle = p.fire ? `rgba(255,${120 + Math.random() * 100},40,${p.life})` : `rgba(220,225,235,${p.life * 0.5})`; ctx.beginPath(); ctx.arc(p.x, p.y, (1.6 - p.life) * 14, 0, 6.283); ctx.fill(); }
        if (parts.length > 500) parts.splice(0, parts.length - 500);
        // HUD
        const clk = el.querySelector('#t-clock');
        const tt = Math.abs(t), mm = Math.floor(tt / 60), ss = Math.floor(tt % 60);
        clk.textContent = `${t < 0 ? 'T−' : 'T+'}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
        el.querySelector('#t-alt').textContent = `${f(A, A < 10 ? 2 : 0)} km`;
        el.querySelector('#t-vel').textContent = `${f(V)} m/s`;
        el.querySelector('#t-dr').textContent = `${f(t > 0 ? (A * A) / 30 + V * t / 3000 : 0)} km`;
        el.querySelector('#t-acc').textContent = `${(t > 0 && t < 540 ? (stage === 1 ? 1.2 + (t / 160) * 3 : 0.8 + ((t - 160) / 380) * 3) : 0).toFixed(1)} g`;
        el.querySelector('#t-stg').textContent = t < 0 ? 'pad' : t < 164 ? `1${lv.boosters && t < 115 ? ' + boosters' : ''}` : t < sepT ? (ev.design.kick && t > 2200 ? 'kick stage' : '2') : 'spacecraft free';
        el.querySelector('#t-phase').textContent = t < 0 ? 'TERMINAL COUNT' : t < 215 ? 'ATMOSPHERIC ASCENT' : t < 540 ? 'ORBITAL INSERTION' : t < sepT ? (leo ? 'ORBIT TRIM' : 'DEPARTURE') : 'SEPARATION';
        while (shown < EV.length && EV[shown][0] <= t) {
          const [, msg, kind] = EV[shown++];
          const div = document.createElement('div'); div.className = `callout ${kind}`; div.textContent = msg; calls.prepend(div);
        }
        if (t >= endT && !done) { done = true; finish(); }
        raf = requestAnimationFrame(draw);
      };
      const finish = () => {
        S.run.launched = true; S.saveRun();
        S.sim = null;
        const sim = S.getSim();
        if (L.catastrophic) sim.finish('launch_failure', L.note);
        S.saveRun();
        const box = document.createElement('div');
        box.className = 'panel launch-result';
        box.innerHTML = L.catastrophic
          ? `<div class="go-badge nogo">LAUNCH FAILURE</div><p style="margin-top:14px">${esc(L.note)}</p><p class="small muted">Space is unforgiving. The mission report explains what happened and how to avoid it.</p><button class="btn primary lg" data-r="report">View mission report</button>`
          : `<div class="go-badge go">SPACECRAFT SEPARATION</div><p style="margin-top:14px">${esc(m.name)} is flying free${leo ? ` in a ${ev.orbit.alt} km orbit` : ` on a C3 ${L.c3Ach.toFixed(1)} km²/s² trajectory`}.${L.anomalyNote ? ` <span class="warn">${esc(L.anomalyNote)}</span>` : ' The launch vehicle performed nominally.'}</p><button class="btn primary lg" data-r="ops">Enter Mission Control →</button>`;
        el.querySelector('.launch-screen').appendChild(box);
        box.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) ORB.app.go(b.dataset.r); });
      };
      el.querySelector('#skip').addEventListener('click', () => { skip = true; });
      raf = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(raf);
    },
  };
})();
