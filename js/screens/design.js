/* ORBITAL — Design Studio shell + Spacecraft subsystem tabs */
(function () {
  const ORB = window.ORB, U = ORB.ui, K = ORB.COMPONENTS;
  const { esc, f, money, pct, kg, W, term } = U;
  ORB.screens = ORB.screens || {};

  /* ===================================================================== shared shell */
  const FMT = {
    m2: (v) => `${(+v).toFixed(1)} m²`, wh: (v) => `${f(+v)} Wh`, kg: (v) => `${f(+v)} kg`, w: (v) => `${f(+v)} W`, mm: (v) => `${(+v).toFixed(0)} mm`,
    days: (v) => `${f(+v)} days (${(v / 365.25).toFixed(1)} yr)`, h: (v) => `${(+v).toFixed(1)} h/day`, km: (v) => `${f(+v)} km`, c3: (v) => `${(+v).toFixed(0)} km²/s²`,
    rj: (v) => `${(+v).toFixed(0)} R♃`, off: (v) => `${v > 0 ? '+' : ''}${(+v).toFixed(0)} days`, speed: (v) => `${(+v * 100).toFixed(0)}%`, budget: (v) => money(+v),
  };
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
  const parseV = (v) => (v === 'true' ? true : v === 'false' ? false : v !== '' && !isNaN(+v) ? +v : v);

  const SYS_TAB = { power: 'power', thermal: 'thermal', prop: 'propulsion', comms: 'comms', rad: 'structure', payload: '@payload', launch: '@launcher', traj: '@trajectory', budget: null, rel: null, ops: '@payload' };
  ORB.SYS_TAB = SYS_TAB;

  const shell = (ORB.shell = {});
  shell.summaryHTML = (ev, compact) => {
    const r = ev.readiness;
    const col = r.go ? (r.score >= 80 ? 'var(--good)' : 'var(--warn)') : 'var(--bad)';
    const c = ev.cost, lv = ev.lv, pw = ev.power, pr = ev.prop, cm = ev.comms;
    const bcls = (bad, warn) => (bad ? 'bad' : warn ? 'warn' : 'good');
    const metric = (label, val, frac, cls, mark, tip) => `<div class="metric"><div class="mh"><span>${label}</span><b class="${cls === 'bad' ? 'bad' : cls === 'warn' ? 'warn' : ''}">${val}</b></div>${U.bar(frac, cls, mark)}${tip ? `<div class="small dim" style="margin-top:4px">${tip}</div>` : ''}</div>`;
    const loadFrac = pw.required / Math.max(pw.genSun, 1);
    const issues = ev.issues.slice().sort((a, b) => ({ fail: 0, warn: 1, info: 2 }[a.sev] - { fail: 0, warn: 1, info: 2 }[b.sev]));
    return `
      <div class="sum-head">${U.ring(r.score, 100, col, 'READY')}
        <div style="flex:1;min-width:0"><div class="eyebrow" style="color:${col}">${r.go ? (r.warns ? 'GO · with warnings' : 'GO for launch') : 'NO-GO'}</div>
        <div class="small muted">${r.fails} blocking · ${r.warns} warnings</div>
        <button class="btn sm" style="margin-top:6px" data-nav="review">Readiness review →</button></div></div>
      ${compact ? '' : `<div class="craft-view" style="margin:10px">${ORB.art.spacecraft(ev.design, ev)}<div class="craft-caption">LIVE CONFIGURATION</div></div>`}
      <div class="row" style="padding:0 16px 10px;gap:6px">
        <span class="chip">dry <b>${kg(ev.mass.dry)}</b></span><span class="chip">wet <b>${kg(ev.mass.wet)}</b></span><span class="chip">payload <b>${kg(ev.mass.payload)}</b></span>
        <span class="chip">${term('delta-v', 'Δv')} <b>${(pr.dvCap * 1000).toFixed(0)} m/s</b></span><span class="chip">power <b>${W(pw.genSun)}</b></span>
      </div>
      ${metric('Budget', `${money(c.total)} / ${money(c.budget)}`, c.total / c.budget, bcls(c.remaining < 0, c.remaining < c.budget * 0.05))}
      ${metric(`Launch mass vs ${esc(lv.lv.name)}`, `${f(ev.mass.launch)} / ${f(lv.capacity)} kg`, ev.mass.launch / lv.capacity, bcls(lv.margin < 0, lv.margin < 0.1))}
      ${metric(term('power-margin', 'Power margin (worst case)'), `${pw.margin >= 0 ? '+' : ''}${pct(pw.margin)}`, loadFrac, bcls(pw.margin < 0, pw.margin < 0.15), null, `need ${W(pw.required)} · have ${W(pw.genSun)} at ${pw.sMax.toFixed(2)} AU`)}
      ${metric(term('delta-v', 'Δv required vs capability'), `${(pr.dvReq * 1000).toFixed(0)} / ${(pr.dvCap * 1000).toFixed(0)} m/s`, pr.dvReq / Math.max(pr.dvCap, 1e-6), bcls(pr.margin < 0, pr.margin < 0.1))}
      ${metric(term('downlink', 'Science data returned'), pct(cm.returnRatio), cm.returnRatio, bcls(cm.returnRatio < 0.15, cm.returnRatio < 0.5), null, `${cm.genDay.toFixed(2)} Gbit/day generated · ${cm.dailyMean.toFixed(2)} Gbit/day downlink`)}
      ${metric('Thermal (hot case)', U.temp(ev.thermal.hotT), (ev.thermal.hotT - 200) / (ev.thermal.tMax - 200), bcls(ev.thermal.hotT > ev.thermal.tMax + 10, ev.thermal.hotT > ev.thermal.tMax), null, `heaters ${W(ev.thermal.heaterOp)} · limit ${U.temp(ev.thermal.tMax)}`)}
      ${metric(term('rad-hard', 'Radiation dose / tolerance'), `${f(ev.radiation.dose, 1)} / ${ev.radiation.tid} krad`, ev.radiation.ratio, bcls(ev.radiation.ratio > 1, ev.radiation.ratio > 0.6))}
      ${metric(term('reliability', 'Estimated reliability'), pct(ev.reliability.mission), ev.reliability.mission, bcls(false, ev.reliability.mission < 0.75))}
      ${metric('Projected science', `${ev.science.index.toFixed(0)}%`, ev.science.index / 100, bcls(ev.science.index < 20, ev.science.index < 50))}
      <div class="panel-h" style="border-top:1px solid var(--line)"><h4>Engineering flags</h4><span class="small muted">${issues.length}</span></div>
      ${issues.length ? issues.slice(0, compact ? 3 : 6).map((i) => shell.issueHTML(i)).join('') : '<div class="issue"><span class="ic good">✓</span><div class="small muted">No issues detected.</div></div>'}`;
  };
  shell.issueHTML = (i, withFix = true) => {
    const ic = { fail: '<span class="bad">⛔</span>', warn: '<span class="warn">⚠</span>', info: '<span class="cyan">ℹ</span>' }[i.sev];
    const tab = SYS_TAB[i.sys];
    return `<div class="issue"><span class="ic">${ic}</span><div><div class="it">${esc(i.title)}</div><div class="iw">${i.why}</div>${withFix ? `<div class="if">→ ${i.fix}${tab ? ` <a href="#" data-goto="${tab}">Fix</a>` : ''}</div>` : ''}</div></div>`;
  };
  shell.tabStatus = (ev) => {
    const st = {};
    ev.issues.forEach((i) => { const t = SYS_TAB[i.sys]; if (!t) return; const cur = st[t]; const v = i.sev === 'fail' ? 'fail' : i.sev === 'warn' ? 'warn' : cur || 'ok'; if (cur !== 'fail') st[t] = cur === 'warn' && v === 'ok' ? 'warn' : v; });
    return st;
  };

  /* mount(el, {screen, title, sub, body(ev)->html, post(root, ev), derived?(ev)->html, prev, next}) */
  shell.mount = (el, cfg) => {
    const S = ORB.store;
    const m = S.mission();
    el.innerHTML = `<div class="wrap-wide screen"><div class="studio">
      <div class="studio-main">
        <div class="row between" style="margin:4px 2px 14px"><div><div class="eyebrow">${esc(m.name)} · ${esc(cfg.eyebrow || 'Design')}</div><h2 style="margin:4px 0 0">${cfg.title}</h2>${cfg.sub ? `<div class="muted small" style="max-width:760px">${cfg.sub}</div>` : ''}</div>
          <div class="row"><button class="btn sm ghost" data-reset title="Restore the agency's draft design">↺ Reset to draft</button></div></div>
        <div class="panel" id="shell-body"></div>
        <div class="nav-foot">${cfg.prev ? `<button class="btn" data-nav="${cfg.prev[0]}">← ${cfg.prev[1]}</button>` : '<span></span>'}${cfg.next ? `<button class="btn primary" data-nav="${cfg.next[0]}">${cfg.next[1]} →</button>` : ''}</div>
        <div class="mobile-sum panel" id="mobile-sum"></div>
      </div>
      <aside class="studio-side panel" id="shell-side"></aside></div></div>`;
    const body = el.querySelector('#shell-body'), side = el.querySelector('#shell-side'), mob = el.querySelector('#mobile-sum');
    let ev = S.evaluate();
    let mobOpen = false;
    const renderSide = () => {
      side.innerHTML = shell.summaryHTML(ev);
      const r = ev.readiness;
      mob.innerHTML = `<div class="row between" style="padding:10px 14px;cursor:pointer" data-mob><div class="row" style="gap:10px"><span class="status-dot ${r.go ? (r.warns ? 'warn' : 'ok') : 'fail'}"></span><b>Readiness ${r.score}</b><span class="small muted">${money(ev.cost.total)} · ${f(ev.mass.launch)} kg · P ${pct(ev.power.margin)} · Δv ${pct(ev.prop.margin)}</span></div><span>${mobOpen ? '▼' : '▲'}</span></div>${mobOpen ? shell.summaryHTML(ev) : ''}`;
    };
    const renderBody = () => { body.innerHTML = cfg.body(ev); wire(); cfg.post && cfg.post(body, ev); };
    const refreshDerived = () => {
      const dv = body.querySelector('[data-derived]');
      if (dv && cfg.derived) dv.innerHTML = cfg.derived(ev);
      cfg.post && cfg.post(body, ev, true);
    };
    const changed = (full) => {
      ev = S.evaluate();
      S.saveRun();
      renderSide();
      if (full) renderBody(); else refreshDerived();
      cfg.onChange && cfg.onChange(ev);
      ORB.app.renderTopbar();
    };
    shell.changed = changed;
    shell.ev = () => ev;
    function wire() {
      U.$$('input[type=range][data-k]', body).forEach((inp) => {
        U.setRange(inp);
        inp.addEventListener('input', () => {
          U.setRange(inp);
          setPath(S.run.design, inp.dataset.k, +inp.value);
          const lab = body.querySelector(`[data-val-for="${inp.dataset.k}"]`);
          if (lab) lab.textContent = (FMT[inp.dataset.fmt] || String)(inp.value);
          changed(false);
        });
      });
    }
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-set],[data-inst],[data-stepk],[data-nav],[data-goto],[data-reset],[data-mob]');
      if (!t) return;
      if (t.dataset.set !== undefined && t.dataset.k) {
        if (t.classList.contains('disabled')) return;
        setPath(S.run.design, t.dataset.k, parseV(t.dataset.v));
        if (cfg.onSet) cfg.onSet(t.dataset.k, parseV(t.dataset.v));
        changed(true);
      } else if (t.dataset.inst) {
        const list = S.run.design.instruments; const id = t.dataset.inst;
        const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else list.push(id);
        changed(true);
      } else if (t.dataset.stepk) {
        const k = t.dataset.stepk, cur = getPath(S.run.design, k) || 0;
        setPath(S.run.design, k, Math.max(+t.dataset.min, Math.min(+t.dataset.max, cur + +t.dataset.d)));
        changed(true);
      } else if (t.dataset.nav) { e.preventDefault(); ORB.app.go(t.dataset.nav); }
      else if (t.dataset.goto) { e.preventDefault(); const g = t.dataset.goto; if (g.startsWith('@')) ORB.app.go(g.slice(1)); else ORB.app.go('design', { tab: g }); }
      else if (t.dataset.reset !== undefined) {
        U.confirm('Reset to the agency draft?', 'All your changes to this mission design will be replaced by the original draft.', 'Reset').then((ok) => { if (ok) { S.run.design = ORB.engine.defaultDesign(S.mission()); changed(true); } });
      } else if (t.dataset.mob !== undefined) { mobOpen = !mobOpen; renderSide(); }
    });
    renderSide(); renderBody();
    return () => { shell.changed = null; };
  };

  /* helpers for option cards & sliders */
  const opt = (k, v, cur, title, desc, specs = [], disabled = false) =>
    `<button class="opt ${cur === v ? 'on' : ''} ${disabled ? 'disabled' : ''}" data-set data-k="${k}" data-v="${v}" ${disabled ? 'aria-disabled="true"' : ''}><span class="t">${title}</span>${desc ? `<span class="d">${desc}</span>` : ''}${specs.length ? `<span class="specs">${specs.map((s) => `<span>${s}</span>`).join('')}</span>` : ''}</button>`;
  const slider = (k, label, val, min, max, step, fmt, hint) =>
    `<div class="field"><div class="field-h"><label for="sl-${k}">${label}</label><span class="val" data-val-for="${k}">${FMT[fmt](val)}</span></div>
      <input id="sl-${k}" type="range" data-k="${k}" data-fmt="${fmt}" min="${min}" max="${max}" step="${step}" value="${val}">${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  const note = (title, html) => `<div class="note learn"><div class="nh">✦ Engineering notebook · ${title}</div>${html}</div>`;
  shell.opt = opt; shell.slider = slider; shell.note = note; shell.FMT = FMT;

  /* ===================================================================== Spacecraft subsystem tabs */
  const TABS = [
    { id: 'power', label: 'Power', icon: '⚡' }, { id: 'propulsion', label: 'Propulsion & ADCS', icon: '➹' }, { id: 'comms', label: 'Communications', icon: '📡' },
    { id: 'thermal', label: 'Thermal', icon: '🌡' }, { id: 'structure', label: 'Structure & Shielding', icon: '⬡' }, { id: 'avionics', label: 'Computing & Data', icon: '⌬' },
  ];

  const T = {};
  T.power = {
    controls: (ev, d) => `
      <h3>Power generation</h3>
      <p class="muted small">Sunlight at ${ev.power.sMax.toFixed(2)} AU (worst case for this mission) is ${pct(1 / ev.power.sMax ** 2)} of what it is at Earth — ${term('inverse-square', 'inverse-square law')}.</p>
      <div class="opt-grid">${K.solar.map((s) => opt('solarType', s.id, d.solarType, s.name, s.desc, s.id === 'none' ? [] : [`η ${pct(s.eff, 1)}`, `${s.areal} kg/m²`, `$${s.costM2} M/m²`, `−${pct(s.degr, 1)}/yr`])).join('')}</div>
      ${d.solarType !== 'none' ? slider('solarArea', 'Solar array area', d.solarArea, 0, 90, 0.5, 'm2', 'Bigger arrays = more power, more mass and cost.') : ''}
      <div class="field"><div class="field-h"><label>${term('rtg', 'Radioisotope power units')} <span class="tag game">MMRTG-class</span></label>
        <span class="stepper-input"><button data-stepk="rtgCount" data-d="-1" data-min="0" data-max="4" aria-label="fewer">−</button><span>${d.rtgCount}</span><button data-stepk="rtgCount" data-d="1" data-min="0" data-max="4" aria-label="more">+</button></span></div>
        <div class="hint">${esc(K.rtg.desc)} Each: ${K.rtg.massKg} kg, ~${K.rtg.powerW} W, ${money(K.rtg.cost)} (+${money(K.rtg.approval)} launch approval once).</div></div>
      <h3 style="margin-top:22px">Energy storage</h3>
      <div class="opt-grid">${K.battery.map((b) => opt('batteryType', b.id, d.batteryType, b.name, b.desc, [`${b.whKg} Wh/kg`, `fade ${pct(b.fade, 1)}/yr`])).join('')}</div>
      ${slider('batteryWh', 'Battery capacity', d.batteryWh, 200, 8000, 50, 'wh', `Mass ≈ ${kg((d.batteryWh / ev.parts.battery.whKg) * 1.1)}.`)}
      <h3 style="margin-top:22px">${term('mppt', 'Power management & distribution')}</h3>
      <div class="opt-grid">${K.pmad.map((p) => opt('pmad', p.id, d.pmad, p.name, p.desc, [`${p.massKg} kg`, `$${p.cost} M`, `eff ${pct(p.xd)}`])).join('')}</div>`,
    derived: (ev) => {
      const p = ev.power;
      const rows = Object.entries(p.loads).filter(([, v]) => v > 0.5);
      const max = Math.max(p.genSun, p.required);
      return `<div class="subhead"><h4>Power budget — worst case (end of life, ${p.sMax.toFixed(2)} AU)</h4><span class="chip ${p.margin < 0 ? 'bad' : p.margin < 0.15 ? 'warn' : 'good'}">margin ${p.margin >= 0 ? '+' : ''}${pct(p.margin)}</span></div>
        <div class="grid g2"><div><table class="t"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td class="n">${v.toFixed(0)} W</td><td style="width:40%">${U.bar(v / max)}</td></tr>`).join('')}
          ${p.ebatt > 0 ? `<tr><td>Battery recharge (after ${p.eclMin.toFixed(0)}-min eclipse)</td><td class="n">${(p.required - p.peak).toFixed(0)} W</td><td>${U.bar((p.required - p.peak) / max, 'warn')}</td></tr>` : ''}
          <tr class="tot"><td>Required</td><td class="n">${p.required.toFixed(0)} W</td><td>${U.bar(p.required / max, p.margin < 0 ? 'bad' : '')}</td></tr>
          <tr class="tot"><td>Delivered by power system</td><td class="n">${p.genSun.toFixed(0)} W</td><td>${U.bar(p.genSun / max, 'good')}</td></tr></tbody></table></div>
        <div><div class="big-stats">
          <div class="big-stat"><div class="l">Arrays at 1 AU (new)</div><div class="v">${W(ev.powerFns.arrayW(1, 0))}</div></div>
          <div class="big-stat"><div class="l">${term('eclipse', 'Eclipse')}</div><div class="v">${p.eclMin > 0.5 ? p.eclMin.toFixed(0) + ' min' : 'none'}</div><div class="s">${p.periodMin ? `per ${p.periodMin.toFixed(0)}-min orbit` : ''}</div></div>
          <div class="big-stat"><div class="l">${term('dod', 'Depth of discharge')}</div><div class="v ${p.dod > p.dodMax ? 'warn' : ''}">${p.ebatt > 0 ? pct(p.dod) : '—'}</div><div class="s">limit ${pct(p.dodMax)} for ${f(p.cyclesYr)} cycles/yr</div></div>
          <div class="big-stat"><div class="l">Launch-phase energy</div><div class="v ${p.launchOk ? '' : 'bad'}">${f(p.launchE)} Wh</div><div class="s">battery usable ${f(ev.design.batteryWh * 0.8)} Wh</div></div></div></div></div>
        <div class="subhead"><h4>Delivered power vs distance from the Sun</h4><span class="small muted">hover to read values</span></div><div id="ch-power"></div>
        <div class="legend"><span><i style="background:#4fd8ff"></i>Delivered (new)</span><span><i style="background:#a184ff"></i>Delivered (end of life)</span><span><i style="background:#ff5c7a"></i>Required</span></div>
        ${note('Sizing a power system', `<div class="formula">P_array = S₀/d² × A × η × packing × degradation = 1361/${p.sMax.toFixed(2)}² × ${ev.design.solarArea} m² × ${ev.parts.solar.eff} × …</div>
          Generation must cover the <b>worst case</b>: farthest from the Sun, at end of life, while also recharging the battery after each eclipse. The textbook sizing formula (SMAD) is <span class="mono">P_sa = (P_e·T_e/X_e + P_d·T_d/X_d) / T_d</span>, where X are power-path efficiencies — your ${esc(ev.parts.pmad.name)} has X_d = ${ev.parts.pmad.xd}, X_e = ${ev.parts.pmad.xe}.`)}`;
    },
    post: (root, ev) => {
      const host = root.querySelector('#ch-power'); if (!host) return;
      const maxAU = Math.max(1.6, ev.power.sMax * 1.25);
      const xs = Array.from({ length: 60 }, (_, i) => 0.8 + (i / 59) * (maxAU - 0.8));
      const xd = ev.parts.pmad.xd, y = ev.time.yrsTotal;
      U.lineChart(host, { x: xs, xName: 'Sun distance', xFmt: (v) => v.toFixed(1) + ' AU', yFmt: (v) => U.short(v) + ' W', h: 210, yLabel: 'Watts',
        series: [
          { label: 'New', color: '#4fd8ff', data: xs.map((d) => (ev.powerFns.arrayW(d, 0) + ev.powerFns.rtgW(0)) * xd), fill: true },
          { label: 'End of life', color: '#a184ff', data: xs.map((d) => (ev.powerFns.arrayW(d, y) + ev.powerFns.rtgW(y)) * xd) },
          { label: 'Required', color: '#ff5c7a', data: xs.map(() => ev.power.required), dash: [5, 4] },
        ], markers: [{ x: ev.power.sMax, label: 'worst case', color: '#ffc24d' }, { x: 1, label: 'Earth', color: '#4aa3ff' }] });
    },
  };

  T.propulsion = {
    controls: (ev, d) => `
      <h3>Main propulsion</h3>
      <div class="opt-grid">${K.engine.map((e) => opt('engine', e.id, d.engine, e.name, e.desc, [`${term('isp', 'Isp')} ${e.isp} s`, e.type === 'ep' ? `${e.pMax / 1000} kW max` : `${e.thrustN} N`, `${e.massKg} kg`, `$${e.cost} M`])).join('')}</div>
      ${slider('propellant', `Propellant load (${ev.parts.engine.type === 'ep' ? 'xenon' : 'hydrazine/oxidizer'})`, d.propellant, 0, 4000, 5, 'kg', `Tanks add ${pct(ev.parts.engine.tankFrac)} of propellant mass. Needed for this mission: ≈ ${kg(ev.prop.propNeeded)}.`)}
      <h3 style="margin-top:22px">Attitude determination & control</h3>
      <div class="opt-grid">${K.acs.map((a) => opt('acs', a.id, d.acs, a.name, a.desc, [`±${a.pointDeg}°`, `${a.massKg} kg`, `${a.powerW} W`, `$${a.cost} M`])).join('')}</div>`,
    derived: (ev) => {
      const pr = ev.prop, ep = ev.ep;
      return `<div class="subhead"><h4>${term('delta-v', 'Δv budget')}</h4><span class="chip ${pr.margin < 0 ? 'bad' : pr.margin < 0.1 ? 'warn' : 'good'}">margin ${pr.margin >= 0 ? '+' : ''}${pct(pr.margin)}</span></div>
        <table class="t"><tbody>${pr.dvItems.map((x) => `<tr><td>${esc(x.label)}${x.hint ? `<div class="small dim">${esc(x.hint)}</div>` : ''}</td><td class="n">${(x.dv * 1000).toFixed(0)} m/s</td></tr>`).join('')}
          <tr class="tot"><td>Total required</td><td class="n">${(pr.dvReq * 1000).toFixed(0)} m/s</td></tr><tr class="tot"><td>Spacecraft capability</td><td class="n ${pr.margin < 0 ? 'bad' : 'good'}">${(pr.dvCap * 1000).toFixed(0)} m/s</td></tr></tbody></table>
        ${ep.power ? `<div class="big-stats" style="margin-top:12px"><div class="big-stat"><div class="l">EP input power</div><div class="v">${W(ep.power)}</div></div><div class="big-stat"><div class="l">Thrust</div><div class="v">${(ep.thrustN * 1000).toFixed(0)} mN</div><div class="s">≈ weight of ${(ep.thrustN / 9.81 * 1000).toFixed(0)} g on Earth</div></div>${ev.ep.burnDays ? `<div class="big-stat"><div class="l">Thrusting time</div><div class="v">${U.days(ev.ep.burnDays)}</div></div>` : ''}</div>` : ''}
        <div class="subhead"><h4>Δv vs propellant — the tyranny of the rocket equation</h4></div><div id="ch-dv"></div>
        ${note('Tsiolkovsky rocket equation', `<div class="formula">Δv = Isp · g₀ · ln(m_wet / m_dry) = ${ev.parts.engine.isp} s × 9.81 × ln(${f(ev.mass.wet)} / ${f(ev.mass.dry)}) = ${(pr.dvCap * 1000).toFixed(0)} m/s</div>
          The curve flattens: each extra kilogram of propellant must also push all the propellant still on board. Higher ${term('isp', 'Isp')} shifts the whole curve up — that is why electric propulsion can deliver several km/s with modest propellant, but its tiny thrust can't do quick braking burns.`)}`;
    },
    post: (root, ev) => {
      const host = root.querySelector('#ch-dv'); if (!host) return;
      const dryBase = ev.mass.dry - ev.design.propellant * ev.parts.engine.tankFrac;
      const xs = Array.from({ length: 60 }, (_, i) => (i / 59) * 4000);
      const dv = (isp, p, tf) => ORB.phys.rocketDv(isp, dryBase + p * tf + p, dryBase + p * tf) * 1000;
      U.lineChart(host, { x: xs, xName: 'Propellant', xFmt: (v) => U.short(v) + ' kg', yFmt: (v) => U.short(v) + ' m/s', h: 210, yLabel: 'Δv (m/s)',
        series: [{ label: `${ev.parts.engine.name} (Isp ${ev.parts.engine.isp} s)`, color: '#4fd8ff', data: xs.map((p) => dv(ev.parts.engine.isp, p, ev.parts.engine.tankFrac)), fill: true },
          { label: 'Requirement', color: '#ff5c7a', data: xs.map(() => ev.prop.dvReq * 1000), dash: [5, 4] }],
        points: [{ x: ev.design.propellant, y: ev.prop.dvCap * 1000, color: '#fff', label: 'you' }] });
    },
  };

  T.comms = {
    controls: (ev, d) => `
      <h3>Antenna</h3>
      <div class="opt-grid">${K.antenna.map((a) => opt('antenna', a.id, d.antenna, a.name, a.desc, [a.D ? `${ORB.phys.dishGain(a.D, ev.comms.lambda).toFixed(1)} dBi` : `${a.gainDbi} dBi`, `${a.massKg} kg`, `$${a.cost} M`])).join('')}</div>
      <h3 style="margin-top:22px">Radio band</h3>
      <div class="opt-grid">${K.band.map((b) => opt('band', b.id, d.band, b.name, b.desc, [`${b.freqGHz} GHz`, `≤ ${b.capMbps} Mbit/s`, b.cost ? `+$${b.cost} M` : 'baseline'])).join('')}</div>
      ${slider('txPower', 'Transmitter RF power', d.txPower, 5, 100, 1, 'w', `Draws ≈ ${W(ev.power.txDC)} of electrical power while transmitting.`)}
      ${slider('dsnHours', `${esc(ev.mission.dsn.label)} per day`, d.dsnHours, ev.mission.dsn.min, ev.mission.dsn.max, 0.5, 'h', `Ground antenna time costs money: ≈ ${money(ev.mission.dsn.costH * 1000)} per 1,000 hours.`)}`,
    derived: (ev) => {
      const c = ev.comms, g = ev.geo, l = c.linkMax;
      return `<div class="subhead"><h4>${term('link-budget', 'Link budget')} at maximum distance (${U.dist(g.dMaxKm)})</h4><span class="chip ${c.rateMax < 100 ? 'bad' : 'good'}">${U.rate(c.rateMax)}</span></div>
        <div class="grid g2"><table class="t"><tbody>
          <tr><td>Transmit power</td><td class="n">${l.ptDbw.toFixed(1)} dBW</td></tr><tr><td>Spacecraft antenna gain</td><td class="n">+${c.gt.toFixed(1)} ${term('dbi', 'dBi')}</td></tr>
          <tr><td>Ground antenna gain (${c.ground.name})</td><td class="n">+${c.gr.toFixed(1)} dBi</td></tr><tr><td>Free-space path loss</td><td class="n bad">−${l.fsplDb.toFixed(1)} dB</td></tr>
          <tr><td>Pointing loss (${ev.parts.acs.pointDeg}° error)</td><td class="n">−${c.pointLossDb.toFixed(1)} dB</td></tr><tr><td>Atmosphere & system losses</td><td class="n">−${(2 + ev.parts.band.lossDb).toFixed(1)} dB</td></tr>
          <tr class="tot"><td>Received power</td><td class="n">${l.prDbw.toFixed(1)} dBW</td></tr><tr><td>Signal-to-noise density (P/N₀)</td><td class="n">${l.prn0.toFixed(1)} dB-Hz</td></tr></tbody></table>
        <div class="big-stats"><div class="big-stat"><div class="l">${term('light-time', 'One-way light time')}</div><div class="v">${U.dur(g.owltMeanS)}</div><div class="s">max ${U.dur(g.owltMaxS)}</div></div>
          <div class="big-stat"><div class="l">Avg. data rate</div><div class="v">${U.rate(c.rateAvg)}</div><div class="s">best ${U.rate(c.rateMin)}</div></div>
          <div class="big-stat"><div class="l">Downlink / day</div><div class="v">${c.dailyMean.toFixed(2)} Gbit</div><div class="s">instruments make ${c.genDay.toFixed(2)}</div></div>
          <div class="big-stat"><div class="l">Data returned</div><div class="v ${c.returnRatio < 0.5 ? 'warn' : 'good'}">${pct(c.returnRatio)}</div><div class="s">${c.flybyData ? `flyby ${c.flybyData.toFixed(1)} Gbit → ${f(c.flybyDownDays)} days` : 'of generated science'}</div></div></div></div>
        <div class="subhead"><h4>Achievable data rate vs distance</h4></div><div id="ch-link"></div>
        ${note('Why distance hurts so much', `<div class="formula">P_received = P_t · G_t · G_r · (λ / 4πd)²</div>Received power falls with the <b>square</b> of distance: doubling the distance quarters the data rate. Engineers fight back with bigger dishes (gain ∝ D²), more power, higher frequency (Ka-band: smaller λ, narrower beam) and more ground-station time. Radio waves travel at light speed, so commands to ${esc(ev.mission.name)} take ${U.dur(g.owltMeanS)} one way.`)}`;
    },
    post: (root, ev) => {
      const host = root.querySelector('#ch-link'); if (!host) return;
      const g = ev.geo, AU = ORB.CONST.AU_KM;
      const lo = Math.max(g.dMinKm * 0.5, 300), hi = g.dMaxKm * 1.6;
      const xs = Array.from({ length: 70 }, (_, i) => lo * Math.pow(hi / lo, i / 69));
      const useAU = g.dMaxKm > 0.02 * AU;
      U.lineChart(host, { x: xs.map((x) => (useAU ? x / AU : x / 1000)), xName: 'Distance', xFmt: (v) => (useAU ? v.toFixed(2) + ' AU' : U.short(v) + ' Mm'), h: 210, logY: true, yMin: 1, yFmt: (v) => U.rate(v), yLabel: 'bit/s (log)',
        series: [{ label: 'Data rate', color: '#4fd8ff', data: xs.map((x) => ev.comms.lk(x).rate), fill: false, fmt: (v) => U.rate(v) }],
        markers: [{ x: useAU ? g.dMinKm / AU : g.dMinKm / 1000, label: 'min', color: '#3ee6a0' }, { x: useAU ? g.dMaxKm / AU : g.dMaxKm / 1000, label: 'max', color: '#ff5c7a' }] });
    },
  };

  T.thermal = {
    controls: (ev, d) => `
      <h3>Insulation</h3>
      <div class="opt-grid">${K.insulation.map((x) => opt('insulation', x.id, d.insulation, x.name, x.desc, [`ε* ${x.effEmit}`])).join('')}</div>
      ${slider('radiatorArea', `${term('radiator', 'Radiator area')}`, d.radiatorArea, 0.2, 6, 0.1, 'm2', 'Rejects waste heat to space. Too small → overheating; too big → heaters needed when cold.')}
      <h3 style="margin-top:22px">Active thermal control</h3>
      <div class="opt-grid">${K.thermalCtrl.map((x) => opt('thermalCtrl', x.id, d.thermalCtrl, x.name, x.desc, [`${x.massKg} kg`, `$${x.cost} M`])).join('')}</div>`,
    derived: (ev) => {
      const th = ev.thermal, lo = 180, hi = 380;
      const pos = (T) => U.clamp(((T - lo) / (hi - lo)) * 100, 0, 100);
      return `<div class="subhead"><h4>Equilibrium temperatures</h4></div>
        <div style="position:relative;height:74px;margin:8px 4px 28px">
          <div style="position:absolute;left:0;right:0;top:30px;height:12px;border-radius:12px;background:linear-gradient(90deg,#3a6cff,#4fd8ff 35%,#3ee6a0 50%,#ffc24d 70%,#ff5c7a)"></div>
          <div style="position:absolute;left:${pos(th.tMin)}%;width:${pos(th.tMax) - pos(th.tMin)}%;top:24px;height:24px;border:2px solid #fff;border-radius:8px;opacity:.7"></div>
          ${[['Hot case', th.hotT, '#ff8a5c'], ['Cold ops (unheated)', th.opColdT, '#4fd8ff'], ['Survival (unheated)', th.survT, '#a184ff']].map(([l, T, c], i) => `<div style="position:absolute;left:${pos(T)}%;top:${i === 0 ? 0 : 52}px;transform:translateX(-50%);text-align:center;white-space:nowrap" class="small"><span style="color:${c}">▼ ${l}: ${U.temp(T)}</span></div>`).join('')}
          <div class="small dim" style="position:absolute;left:${pos(th.tMin)}%;top:-2px;transform:translateX(-50%)">${U.temp(th.tMin)}</div><div class="small dim" style="position:absolute;left:${pos(th.tMax)}%;top:-2px;transform:translateX(-50%)">${U.temp(th.tMax)}</div></div>
        <div class="big-stats"><div class="big-stat"><div class="l">Heater power (operations)</div><div class="v">${W(th.heaterOp)}</div></div><div class="big-stat"><div class="l">Heater power (survival)</div><div class="v">${W(th.heaterSurv)}</div></div>
          <div class="big-stat"><div class="l">Allowable range</div><div class="v">${U.temp(th.tMin)} … ${U.temp(th.tMax)}</div></div>${th.rtgHeat ? `<div class="big-stat"><div class="l">RTG waste heat used</div><div class="v">${W(th.rtgHeat)}</div></div>` : ''}</div>
        <div class="subhead"><h4>Unheated internal temperature vs Sun distance</h4></div><div id="ch-th"></div>
        ${note('Radiative balance', `<div class="formula">Q_internal + Q_environment = ε·σ·A_radiator·T⁴ + ε*·σ·A_body·T⁴</div>In vacuum there is no air to carry heat away; the only exit is infrared radiation. Your electronics dissipate ≈${W(ev.power.peak)} as heat. The radiator must dump it in the <b>hot case</b> (closest to the Sun, all systems on), while heaters keep things above ${U.temp(th.tMin)} in the <b>cold case</b>. Louvers resolve the conflict by closing when cold.`)}`;
    },
    post: (root, ev) => {
      const host = root.querySelector('#ch-th'); if (!host) return;
      const d = ev.design, tc = ev.parts.thermalCtrl, ins = ev.parts.insulation;
      const maxAU = Math.max(1.6, ev.power.sMax * 1.2);
      const xs = Array.from({ length: 50 }, (_, i) => 0.8 + (i / 49) * (maxAU - 0.8));
      const T = (dAU, pd, eps) => ORB.phys.thermalEq({ pDiss: pd, dAU, qPlanet: 0, aRad: d.radiatorArea, epsRad: eps, aBody: ev.mass.aBody, epsMli: ins.effEmit, extraW: ev.thermal.rtgHeat }).T - 273.15;
      U.lineChart(host, { x: xs, xName: 'Sun distance', xFmt: (v) => v.toFixed(1) + ' AU', yFmt: (v) => v.toFixed(0) + ' °C', h: 200, yMin: -150, yMax: 80, yLabel: '°C',
        series: [{ label: 'All systems on', color: '#ff8a5c', data: xs.map((x) => T(x, ev.power.peak - ev.power.loads.Heaters, 0.85)) },
          { label: 'Survival loads' + (tc.id !== 'passive' ? ' (louvers closed)' : ''), color: '#4fd8ff', data: xs.map((x) => T(x, ev.power.survW - ev.thermal.heaterSurv, tc.coldEps)) }],
        hlines: [{ y: ev.thermal.tMax - 273.15, label: 'hot limit', color: '#ff5c7a' }, { y: ev.thermal.tMin - 273.15, label: 'cold limit', color: '#4d8dff' }] });
    },
  };

  T.structure = {
    controls: (ev, d) => `
      <h3>Primary structure</h3>
      <div class="opt-grid">${K.structure.map((x) => opt('structure', x.id, d.structure, x.name, x.desc, [`${pct(x.frac)} of dry mass`, `${x.shieldMm} mm shielding`])).join('')}</div>
      ${slider('shielding', `Electronics ${term('rad-hard', 'radiation vault')} thickness`, d.shielding, 0, 20, 1, 'mm', `Each mm adds ≈ 5.4 kg and $0.3 M. Total shielding ${ev.radiation.shieldMm.toFixed(1)} mm Al-equivalent.`)}`,
    derived: (ev) => {
      const r = ev.radiation;
      return `<div class="big-stats" style="margin-top:6px"><div class="big-stat"><div class="l">Structure mass</div><div class="v">${kg(ev.mass.items.find((x) => x.label.startsWith('Primary')).kg)}</div></div>
          <div class="big-stat"><div class="l">Mission radiation dose</div><div class="v ${r.ratio > 1 ? 'bad' : r.ratio > 0.6 ? 'warn' : ''}">${f(r.dose, 1)} krad</div><div class="s">${f(r.doseRaw, 0)} krad unshielded-equiv.</div></div>
          <div class="big-stat"><div class="l">Computer tolerance</div><div class="v">${r.tid} krad</div></div><div class="big-stat"><div class="l">Dose reduction</div><div class="v">×${(1 / r.factor).toFixed(1)}</div></div></div>
        <div class="subhead"><h4>Mass breakdown</h4></div>
        <div class="row" style="align-items:center;gap:20px">${U.donut(Object.entries(ev.mass.byKey).map(([k2, v], i) => ({ l: k2, v, c: U.PALETTE[i] })), 150, f(ev.mass.dry) + ' kg')}
          <div class="legend" style="flex-direction:column;gap:4px">${Object.entries(ev.mass.byKey).map(([k2, v], i) => `<span><i style="background:${U.PALETTE[i]}"></i>${{ power: 'Power', prop: 'Propulsion', adcs: 'Attitude control', comms: 'Telecom', thermal: 'Thermal', avionics: 'Avionics', struct: 'Structure & harness', payload: 'Science payload' }[k2] || k2}: <b>${kg(v)}</b></span>`).join('')}</div></div>
        <div class="subhead"><h4>Dose vs shielding thickness</h4></div><div id="ch-rad"></div>
        ${note('Shielding trade-off', 'Energetic particles are stopped by mass. The first few millimetres remove most low-energy particles; beyond that, returns diminish because high-energy particles penetrate anyway. Jupiter\'s belts are so intense that missions there put electronics in a thick-walled vault.')}`;
    },
    post: (root, ev) => {
      const host = root.querySelector('#ch-rad'); if (!host) return;
      const xs = Array.from({ length: 41 }, (_, i) => i * 0.5 + ev.parts.structure.shieldMm);
      U.lineChart(host, { x: xs, xName: 'Shielding', xFmt: (v) => v.toFixed(0) + ' mm', h: 190, logY: true, yMin: 0.1, yFmt: (v) => U.short(v) + ' krad', yLabel: 'krad (log)',
        series: [{ label: 'Mission dose', color: '#ffc24d', data: xs.map((x) => ev.radiation.doseRaw * ORB.engine.shieldFactor(x)) }, { label: 'Computer tolerance', color: '#ff5c7a', data: xs.map(() => ev.radiation.tid), dash: [5, 4] }],
        points: [{ x: ev.radiation.shieldMm, y: ev.radiation.dose, color: '#fff', label: 'you' }] });
    },
  };

  T.avionics = {
    controls: (ev, d) => `
      <h3>Flight computer</h3>
      <div class="opt-grid">${K.computer.map((x) => opt('computer', x.id, d.computer, x.name, x.desc, [`${x.tidKrad} krad`, `autonomy L${x.autonomy}`, `${x.powerW} W`, `$${x.cost} M`])).join('')}</div>
      <h3 style="margin-top:22px">Onboard data storage</h3>
      <div class="opt-grid">${K.storage.map((x) => opt('storage', x.id, d.storage, x.name, '', [`${x.massKg} kg`, `${x.powerW} W`, `$${x.cost} M`])).join('')}</div>`,
    derived: (ev) => {
      const c = ev.comms, owlt = ev.geo.owltMaxS;
      return `<div class="big-stats" style="margin-top:6px"><div class="big-stat"><div class="l">Round-trip light time (max)</div><div class="v">${U.dur(2 * owlt)}</div></div>
        <div class="big-stat"><div class="l">Data generated / day</div><div class="v">${c.genDay.toFixed(2)} Gbit</div></div><div class="big-stat"><div class="l">Recorder</div><div class="v ${c.bufferOk ? '' : 'warn'}">${ev.parts.storage.gbit} Gbit</div><div class="s">${c.bufferOk ? 'buffers between contacts' : 'too small to buffer'}</div></div></div>
        ${note('Why autonomy matters', `When something goes wrong, the spacecraft must protect itself first and ask questions later. With a round-trip light time of ${U.dur(2 * owlt)} — plus waiting for the next ground-station pass — a slow response can mean hours or days of a drained battery or idle instruments. Autonomy level 3 lets the spacecraft diagnose and recover from common faults on its own; level 1 needs Earth for everything.`)}`;
    },
  };

  ORB.screens.design = {
    title: 'Spacecraft',
    render(el, params) {
      const S = ORB.store;
      let tab = (params && params.tab) || S.run.designTab || 'power';
      if (!T[tab]) tab = 'power';
      const cleanup = shell.mount(el, {
        eyebrow: 'Spacecraft Design Studio', title: 'Configure your spacecraft', sub: 'Every component changes mass, power, cost and reliability. Watch the engineering summary react — and remember the rocket has to lift all of it.',
        prev: ['briefing', 'Briefing'], next: ['payload', 'Science payload'],
        body: (ev) => {
          const st = shell.tabStatus(ev);
          const t = T[tab];
          return `<div class="tabs" role="tablist">${TABS.map((x) => `<button class="tab ${x.id === tab ? 'on' : ''}" data-tab="${x.id}" role="tab" aria-selected="${x.id === tab}"><span>${x.icon}</span>${x.label}<span class="dot ${st[x.id] || ''}" ${st[x.id] ? '' : 'style="opacity:.0"'}></span></button>`).join('')}</div>
            <div class="tab-body">${t.controls(ev, ev.design)}<div data-derived>${t.derived ? t.derived(ev) : ''}</div></div>`;
        },
        derived: (ev) => (T[tab].derived ? T[tab].derived(ev) : ''),
        post: (root, ev) => { T[tab].post && T[tab].post(root, ev); },
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]'); if (!b) return;
        tab = b.dataset.tab; S.run.designTab = tab; S.saveRun(); shell.changed(true);
      });
      if (!S.profile.tutorialSeen) setTimeout(() => ORB.tutorial && ORB.tutorial(), 400);
      return cleanup;
    },
  };
})();
