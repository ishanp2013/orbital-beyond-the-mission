/* ORBITAL — Library: tutorials, glossary, model assumptions, validation, references */
(function () {
  const ORB = window.ORB, U = ORB.ui, P = ORB.phys;
  const { esc, f, pct } = U;

  const TUTORIALS = [
    { id: 'rocket', t: 'The rocket equation', body: () => `<p>Every maneuver costs <b>Δv</b>. How much Δv a spacecraft has depends on its engine efficiency (Isp) and how much of its mass is propellant:</p>
        <div class="formula">Δv = Isp · g₀ · ln(m_wet / m_dry)</div>
        <div class="grid g2"><div>${['isp|Specific impulse (s)|200|3500|10|318', 'dry|Dry mass (kg)|100|3000|10|600', 'prop|Propellant (kg)|0|4000|10|900'].map((s) => { const [k, l, a, b, st, v] = s.split('|'); return `<div class="field"><div class="field-h"><label>${l}</label><span class="val" id="tv-${k}">${v}</span></div><input type="range" data-tk="${k}" min="${a}" max="${b}" step="${st}" value="${v}"></div>`; }).join('')}</div>
        <div class="big-stats" style="align-content:center"><div class="big-stat"><div class="l">Δv</div><div class="v" id="t-dv">—</div></div><div class="big-stat"><div class="l">Mass ratio</div><div class="v" id="t-mr">—</div></div><div class="big-stat"><div class="l">Enough for Mars capture (~2.1 km/s)?</div><div class="v" id="t-ok">—</div></div></div></div>` },
    { id: 'power', t: 'Power budgets', body: () => `<p>Solar power falls with the square of distance from the Sun. At Mars you get ~43% of Earth's sunlight; at Jupiter ~3.7%. Arrays also degrade every year, and the battery must carry the spacecraft through every eclipse — then be recharged.</p><div class="formula">P = 1361 W/m² ÷ d² × Area × efficiency × losses</div><p>That is why designers size power for the <b>worst case</b> and keep a margin, and why missions beyond Jupiter use radioisotope power.</p>` },
    { id: 'link', t: 'Talking across the Solar System', body: () => `<p>Radio signals spread out as they travel: received power drops with distance squared. A spacecraft at Mars at 2.5 AU receives over a <b>trillion trillion times</b> less power than it transmits. Big dishes (gain ∝ diameter²), more power, higher frequencies and long listening time on large ground antennas make communication possible.</p><div class="formula">rate ∝ P_t · G_t · G_r / (d² · T_noise)</div><p>Signals travel at light speed: commands to Jupiter take 33–53 minutes, so spacecraft must protect themselves.</p>` },
    { id: 'thermal', t: 'Staying warm (and cool)', body: () => `<p>In vacuum, heat leaves only by radiation (Stefan–Boltzmann: P = εσAT⁴). Multi-layer insulation wraps the spacecraft; a radiator dumps waste heat. The design must work in the <b>hot case</b> (near the Sun, everything on) and the <b>cold case</b> (far away, in shadow, minimal power) — louvers and heaters bridge the gap.</p>` },
    { id: 'orbits', t: 'Transfers, windows & gravity assists', body: () => { const m = P.helioTransfer(1, 1.524, 1.524); return `<p>The cheapest way between two circular orbits is a <b>Hohmann transfer</b> — half an ellipse touching both. Earth→Mars takes ${m.tofD.toFixed(0)} days and needs Mars to be ${(180 - (360 * m.tofD) / 686.98).toFixed(0)}° ahead of Earth at launch, which happens every ~26 months: the <b>launch window</b>.</p><p>A <b>gravity assist</b> flies close to a planet; in the Sun's frame the spacecraft leaves faster (or slower), borrowing the planet's orbital momentum. New Horizons gained several km/s at Jupiter.</p>`; } },
    { id: 'margins', t: 'Margins & reviews', body: () => `<p>Early in a project, mass and power estimates are uncertain and tend to grow. Engineers therefore keep <b>margins</b> — spare launch capability, power, Δv and budget — and independent review boards check designs before launch. In ORBITAL the readiness review flags every margin that is negative (blocking) or thin (warning).</p>` },
  ];

  ORB.screens.library = {
    title: 'Library',
    render(el, params) {
      let tab = (params && params.tab) || 'learn';
      let q = '';
      const draw = () => {
        const tabs = [['learn', 'Engineering tutorials'], ['glossary', 'Glossary'], ['model', 'Model & assumptions'], ['validation', 'Validation'], ['refs', 'References & credits']];
        let body = '';
        if (tab === 'learn') body = `<div class="grid g2">${TUTORIALS.map((t) => `<div class="panel panel-pad"><h3>${t.t}</h3>${t.body()}</div>`).join('')}</div>`;
        if (tab === 'glossary') {
          const items = Object.entries(ORB.GLOSSARY).filter(([, [t, d]]) => !q || (t + d).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a[1][0].localeCompare(b[1][0]));
          body = `<div class="panel panel-pad"><input id="gq" placeholder="Search terms…" value="${esc(q)}" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line2);background:rgba(10,20,40,.7);color:var(--text);font:inherit" aria-label="Search glossary">
            <div style="columns:2 380px;column-gap:28px;margin-top:10px">${items.map(([, [t, d]]) => `<div class="glossary-item" style="break-inside:avoid"><b>${esc(t)}</b><div class="small" style="color:#cbd9ee">${esc(d)}</div></div>`).join('') || '<p class="muted">No matches.</p>'}</div></div>`;
        }
        if (tab === 'model') body = `<div class="grid g3">
          <div class="panel panel-pad"><span class="tag real">Real</span><h3 style="margin-top:8px">Physical facts & constants</h3><ul class="small" style="padding-left:18px;color:#cbd9ee"><li>Gravitational parameters, radii and orbits of the Sun, Earth, Moon, Mars, Jupiter (NASA NSSDCA fact sheets)</li><li>Solar irradiance 1361 W/m² at 1 AU; inverse-square law</li><li>Speed of light, Boltzmann constant, Stefan–Boltzmann law</li><li>Tsiolkovsky rocket equation, vis-viva, Kepler's equation</li><li>Pu-238 half-life (87.7 yr) and MMRTG output class (~110 W)</li><li>Concepts: C3, Hohmann transfers, gravity assists, aerobraking, conjunction, SSO and terminator orbits</li></ul></div>
          <div class="panel panel-pad"><span class="tag model">Model</span><h3 style="margin-top:8px">Simplified educational models</h3><ul class="small" style="padding-left:18px;color:#cbd9ee"><li>Patched conics with circular, coplanar planetary orbits (Tessera tilted 3°); planets assumed phased for the chosen window; window-offset penalty is an approximation</li><li>Kuiper Belt cruise numerically integrated (2-D, Sun only) with an instantaneous Jupiter flyby</li><li>Low-thrust Δv via Edelbaum's approximation; thrust from P = ½·F·v_e efficiency relation</li><li>Launch-vehicle capability vs C3 as an exponential fit to typical performance curves</li><li>Single-node radiative thermal balance with MLI leak and one radiator</li><li>Link budget with ideal parabolic gains, 3 dB margin, Eb/N0 = 1 dB; X/Ka band, 34 m (deep space) or 11 m (LEO) ground antenna</li><li>Radiation dose: illustrative environment rates and exponential shielding factor</li><li>Drag and lunar mascon station-keeping: order-of-magnitude rates</li><li>Anomaly rates are derived from component reliabilities but <b>accelerated ~8× for gameplay</b></li></ul></div>
          <div class="panel panel-pad"><span class="tag game">Fictional</span><h3 style="margin-top:8px">Game specifications</h3><ul class="small" style="padding-left:18px;color:#cbd9ee"><li>The Orbital Exploration Directorate (OXD) and all missions</li><li>Tessera (asteroid) and Halcyon (Kuiper Belt object)</li><li>Launch vehicles Pathfinder-S, Meridian-M, Titanis-H, Colossus-SH (inspired by real vehicle classes, not real data)</li><li>All component and instrument masses, powers, costs and reliabilities (physically plausible, not taken from specific products)</li><li>All costs and budgets</li><li>All "discoveries" are simulated narrative outcomes, not real findings</li></ul></div></div>
          <div class="panel panel-pad" style="margin-top:16px"><h3>What this is — and isn't</h3><p class="muted">ORBITAL is an educational game. Its numbers come from real equations and are internally consistent, so trade-offs behave like the real ones: more Δv costs exponentially more propellant, distance destroys data rate, sunlight fades with distance, radiation needs mass. It is <b>not</b> a flight-dynamics, thermal-analysis or cost-estimating tool, and should not be used to design real spacecraft.</p></div>`;
        if (tab === 'validation') body = `<div class="panel panel-pad"><h3>Model vs. real missions</h3><p class="small muted">Each value on the left is computed live by ORBITAL's physics engine; the right column shows published or textbook figures.</p>
          ${ORB.validation().map(([a, b, c]) => `<div class="validation-row"><span>${a}</span><span class="mono cyan">${b}</span><span class="small muted">${c}</span></div>`).join('')}
          ${(() => { const mars = ORB.MISSION_BY_ID.mars; const ev = ORB.engine.evaluate(mars, { ...mars.baseline, antenna: 'hga35', txPower: 100, band: 'x', acs: 'precision' }); return `<div class="validation-row"><span>X-band link from Mars at 1.5 AU, 3.5 m dish, 100 W, 34 m ground antenna</span><span class="mono cyan">${U.rate(ev.comms.lk(1.5 * ORB.CONST.AU_KM).rate)}</span><span class="small muted">order of 1 Mbit/s (MRO-class orbiters, 3 m dish)</span></div>`; })()}
          <div class="validation-row"><span>Eclipse at 100 km lunar orbit</span><span class="mono cyan">${(P.eclipseFraction(1737.4, 1837.4) * P.periodS(4902.8, 1837.4) / 60).toFixed(0)} min</span><span class="small muted">≈ 47 min maximum (LRO-class orbit)</span></div></div>`;
        if (tab === 'refs') body = `<div class="grid g2"><div class="panel panel-pad"><h3>References</h3><p class="small muted">Sources used to ground the physics, concepts and validation cases.</p>${ORB.REFERENCES.map((r) => `<div class="ref"><b>${esc(r.t)}</b> — ${esc(r.a)}${r.u ? `<br><a href="${r.u}" target="_blank" rel="noopener">${esc(r.u)}</a>` : ''}<div class="small muted">Used for: ${esc(r.use)}</div></div>`).join('')}</div>
          <div class="stack"><div class="panel panel-pad"><h3>Disclaimer</h3><p>ORBITAL: Beyond the Mission is an independent educational project created for the NASA Space Apps Challenge. It is <b>not</b> an official NASA product and is not endorsed by NASA. References to NASA missions and publications are for educational context and model validation only. All agencies, missions, vehicles, hardware, costs and discoveries in the game are fictional unless explicitly labelled as real.</p></div>
            <div class="panel panel-pad"><h3>Credits</h3><p class="small muted">Design, physics models, simulation, artwork (procedurally generated), and code: ORBITAL team. No third-party code libraries; typefaces: Space Grotesk, Inter and JetBrains Mono (Google Fonts, SIL Open Font License).</p></div>
            <div class="panel panel-pad"><h3>Your data</h3><p class="small muted">Progress, unlocks and personal bests are stored only in this browser (localStorage).</p><button class="btn sm danger" id="wipe">Reset all progress</button></div></div></div>`;
        el.innerHTML = `<div class="wrap screen"><div class="eyebrow">Mission Library</div><h1 style="margin:6px 0 14px">Learn the engineering</h1>
          <div class="seg" style="margin-bottom:18px">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-lt="${k}">${l}</button>`).join('')}</div>${body}</div>`;
        if (tab === 'learn') {
          const calc = () => {
            const v = (k) => +el.querySelector(`[data-tk=${k}]`).value;
            ['isp', 'dry', 'prop'].forEach((k) => (el.querySelector('#tv-' + k).textContent = v(k)));
            const dv = P.rocketDv(v('isp'), v('dry') + v('prop'), v('dry'));
            el.querySelector('#t-dv').textContent = `${(dv * 1000).toFixed(0)} m/s`;
            el.querySelector('#t-mr').textContent = ((v('dry') + v('prop')) / v('dry')).toFixed(2);
            el.querySelector('#t-ok').innerHTML = dv >= 2.1 ? '<span class="good">Yes</span>' : '<span class="bad">No</span>';
          };
          U.$$('[data-tk]', el).forEach((i) => { U.setRange(i); i.addEventListener('input', () => { U.setRange(i); calc(); }); });
          calc();
        }
        if (tab === 'glossary') { const gi = el.querySelector('#gq'); gi.addEventListener('input', () => { q = gi.value; const pos = gi.selectionStart; draw(); const n = el.querySelector('#gq'); n.focus(); n.setSelectionRange(pos, pos); }); }
        const w = el.querySelector('#wipe');
        if (w) w.addEventListener('click', async () => { if (await U.confirm('Reset all progress?', 'Unlocks, personal bests and the current mission will be erased from this browser.', 'Reset everything', true)) { try { localStorage.removeItem('orbital.profile.v1'); localStorage.removeItem('orbital.run.v1'); } catch (e) { /* ignore */ } location.hash = '#/home'; location.reload(); } });
      };
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-lt]'); if (b) { tab = b.dataset.lt; draw(); } });
      draw();
    },
  };

  /* first-visit tutorial in the design studio */
  ORB.tutorial = () => {
    const S = ORB.store;
    const steps = [
      ['Welcome to the Design Studio', 'You are configuring a real-physics spacecraft. Pick components with the cards, tune sizes with the sliders.'],
      ['The engineering summary', 'On the right (or the bar at the bottom on small screens), every metric — mass, power, Δv, budget, data return, temperature, radiation — recomputes instantly. Green is healthy, amber is a thin margin, red blocks launch.'],
      ['Follow the flags', 'Each engineering flag explains <b>why</b> something is a problem and how to fix it. Click "Fix" to jump to the right subsystem.'],
      ['Learning mode', 'Purple "Engineering notebook" boxes explain the physics with your live numbers. Toggle them with <b>Learning mode</b> in the top bar. Dotted-underlined terms show definitions.'],
    ];
    let i = 0;
    const show = () => {
      const [t, b] = steps[i];
      const md = U.modal(`<div class="modal-h"><div class="modal-ic">✦</div><div><div class="eyebrow">Quick tour · ${i + 1}/${steps.length}</div><h3 style="margin:4px 0 0">${t}</h3></div></div>
        <div class="modal-b"><p>${b}</p><div class="row" style="justify-content:space-between"><button class="btn sm ghost" data-x="skip">Skip tour</button><button class="btn primary" data-x="next">${i < steps.length - 1 ? 'Next →' : 'Start designing'}</button></div></div>`, { onClose: () => { S.profile.tutorialSeen = true; S.saveProfile(); } });
      md.root.querySelector('[data-x=next]').onclick = () => { if (i < steps.length - 1) { i++; show(); } else md.close(); };
      md.root.querySelector('[data-x=skip]').onclick = () => md.close();
    };
    show();
  };
})();
