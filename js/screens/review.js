/* ORBITAL — Mission Readiness Review */
(function () {
  const ORB = window.ORB, U = ORB.ui;
  const { esc, f, money, pct, kg, W } = U;

  ORB.timelineHTML = (ev, sim) => {
    const tl = ev.time, tr = ev.traj;
    const segs = [];
    if (tl.cruiseD > 0) segs.push(['Cruise', tl.cruiseD, '#4d8dff']);
    if (ev.mission.type === 'leo') segs.push(['Commissioning', 30, '#4d8dff']);
    if (tr.extraD && ev.mission.type !== 'leo') segs.push(['Aerobraking', tr.extraD, '#ffc24d']);
    segs.push([ev.mission.type === 'kbo' ? 'Flyby + downlink' : 'Science operations', tl.sciDays, '#a184ff']);
    const tot = segs.reduce((a, s) => a + s[1], 0);
    let x = 0;
    const blocks = segs.map(([l, d, c]) => { const w = (d / tot) * 100; const h = `<div class="seg-t" style="left:${x}%;width:${w}%;background:${c}" title="${l}: ${U.days(d)}">${w > 12 ? `${l} · ${U.days(d)}` : ''}</div>`; x += w; return h; });
    let acc = 0; const ticks = ['<div class="tick" style="left:0%">Launch</div>'];
    let lastX = 0; segs.forEach(([l, d], i) => { acc += d; const x = (acc / tot) * 100; if (x - lastX > 8 || i === segs.length - 1) { ticks.push(`<div class="tick" style="left:${Math.min(x, 97)}%">${U.days(acc)}</div>`); lastX = x; } });
    const evMarks = sim ? sim.s.events.filter((e) => ['bad', 'warn', 'science', 'good'].includes(e.sev)).slice(0, 60).map((e) => `<div style="position:absolute;top:2px;left:${Math.min(100, (e.t / 24 / tot) * 100)}%;width:3px;height:10px;border-radius:2px;background:${{ bad: '#ff5c7a', warn: '#ffc24d', science: '#c08bff', good: '#3ee6a0' }[e.sev]}" title="${esc(e.title)} · day ${(e.t / 24).toFixed(0)}"></div>`).join('') : '';
    return `<div class="timeline">${blocks.join('')}${evMarks}${ticks.join('')}</div>`;
  };

  ORB.screens.review = {
    title: 'Review',
    render(el) {
      const S = ORB.store, m = S.mission(), ev = S.evaluate(), r = ev.readiness;
      const col = r.go ? (r.score >= 80 ? 'var(--good)' : 'var(--warn)') : 'var(--bad)';
      const issues = ev.issues.slice().sort((a, b) => ({ fail: 0, warn: 1, info: 2 }[a.sev] - { fail: 0, warn: 1, info: 2 }[b.sev]));
      const costGroups = {}; ev.cost.items.forEach((i) => (costGroups[i.group] = (costGroups[i.group] || 0) + i.M));
      const GN = { hw: 'Spacecraft hardware', payload: 'Instruments', wrap: 'Integration, test & management', launch: 'Launch', ops: 'Operations' };
      el.innerHTML = `<div class="wrap screen">
        <div class="eyebrow">${esc(m.name)} · Mission Readiness Review</div><h1 style="margin:6px 0 16px">Is this mission ready to fly?</h1>
        <div class="panel score-hero">${U.ring(r.score, 100, col, 'READINESS', 150)}
          <div style="flex:1;min-width:260px"><span class="go-badge ${r.go ? 'go' : 'nogo'}">${r.go ? 'GO FOR LAUNCH' : 'NO-GO'}</span>
            <p style="margin-top:12px;max-width:640px">${r.go ? (r.warns ? `The review board approves launch, noting <b class="warn">${r.warns} warning${r.warns > 1 ? 's' : ''}</b>. Warnings won't stop you — but each is a risk the simulation will test.` : 'All systems meet requirements with healthy margins. The board unanimously approves launch.') : `The board found <b class="bad">${r.fails} blocking violation${r.fails > 1 ? 's' : ''}</b>. Launching anyway is possible, but the simulation will play out the physical consequences.`}</p>
            <div class="row"><button class="btn" data-go="design">← Return to the Design Studio</button>
              ${r.blocking ? '<button class="btn" disabled title="The spacecraft physically does not fit in the fairing">Launch impossible: fairing</button>' : r.go ? '<button class="btn primary lg" data-launch>Proceed to launch 🚀</button>' : '<button class="btn danger" data-launch>Override the board & launch anyway</button>'}</div></div></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="panel"><div class="panel-h"><h3>Readiness checklist</h3><span class="small muted">${r.checks.filter((c) => c.status === 'ok').length}/${r.checks.length} nominal</span></div>
            ${r.checks.map((c) => `<div class="check"><span class="status-dot ${c.status}"></span><span>${c.name}</span><span class="cd">${c.detail}</span></div>`).join('')}</div>
          <div class="panel"><div class="panel-h"><h3>Findings & required actions</h3><span class="small muted">${issues.length}</span></div>${issues.length ? issues.map((i) => ORB.shell.issueHTML(i)).join('') : '<div class="panel-pad muted">No findings. Outstanding work.</div>'}</div></div>
        <div class="panel panel-pad" style="margin-top:16px"><h3>Mission timeline</h3>${ORB.timelineHTML(ev)}
          <div class="row small muted">Launch vehicle: <b>${esc(ev.lv.lv.name)}</b> · Trajectory: <b>${esc(ORB.TRAJ_INFO[ev.traj.type] ? ORB.TRAJ_INFO[ev.traj.type].name : 'Direct')}</b> · Science orbit: <b>${esc(ev.orbit.label)}</b> · Total ${U.days(ev.time.totalD)}</div></div>
        <div class="grid g3" style="margin-top:16px">
          <div class="panel panel-pad"><h3>Mass</h3><div class="row" style="gap:14px">${U.donut(Object.entries(ev.mass.byKey).map(([k, v], i) => ({ l: k, v, c: U.PALETTE[i] })), 130, f(ev.mass.dry) + ' kg')}
            <div class="kv" style="flex:1"><span>Dry mass</span><span>${kg(ev.mass.dry)}</span><span>Propellant</span><span>${kg(ev.mass.prop)}</span><span>Adapter</span><span>${kg(ev.mass.adapter)}</span><span class="tot">Launch mass</span><span class="tot">${kg(ev.mass.launch)}</span><span>Capability</span><span>${kg(ev.lv.capacity)}</span></div></div></div>
          <div class="panel panel-pad"><h3>Cost</h3>${Object.entries(costGroups).map(([k, v], i) => `<div class="metric" style="padding:6px 0;border:0"><div class="mh"><span>${GN[k]}</span><b>${money(v)}</b></div>${U.bar(v / ev.cost.budget, '', null).replace('<i ', `<i style="background:${U.PALETTE[i]};width:${(v / ev.cost.budget) * 100}%" data-x `)}</div>`).join('')}
            <div class="sep"></div><div class="kv"><span class="tot">Total</span><span class="tot ${ev.cost.remaining < 0 ? 'bad' : ''}">${money(ev.cost.total)}</span><span>Budget</span><span>${money(ev.cost.budget)}</span><span>Reserve</span><span class="${ev.cost.remaining < 0 ? 'bad' : 'good'}">${money(ev.cost.remaining)}</span></div></div>
          <div class="panel panel-pad"><h3>Key margins</h3><div class="kv"><span>Power margin</span><span class="${ev.power.margin < 0 ? 'bad' : ev.power.margin < 0.15 ? 'warn' : 'good'}">${pct(ev.power.margin)}</span>
            <span>Δv margin</span><span class="${ev.prop.margin < 0 ? 'bad' : ev.prop.margin < 0.1 ? 'warn' : 'good'}">${pct(ev.prop.margin)}</span>
            <span>Launch margin</span><span class="${ev.lv.margin < 0 ? 'bad' : ev.lv.margin < 0.1 ? 'warn' : 'good'}">${pct(ev.lv.margin)}</span>
            <span>Data returned</span><span class="${ev.comms.returnRatio < 0.5 ? 'warn' : 'good'}">${pct(ev.comms.returnRatio)}</span>
            <span>Radiation vs tolerance</span><span class="${ev.radiation.ratio > 1 ? 'bad' : ev.radiation.ratio > 0.6 ? 'warn' : 'good'}">${pct(ev.radiation.ratio)}</span>
            <span>Hot-case temperature</span><span>${U.temp(ev.thermal.hotT)}</span><span>Reliability estimate</span><span>${pct(ev.reliability.mission)}</span><span>Projected science</span><span>${ev.science.index.toFixed(0)}%</span></div></div></div>
        <div class="note learn" style="margin-top:16px"><div class="nh">✦ Engineering notebook · Design reviews</div>Real missions pass a series of reviews (e.g., Preliminary and Critical Design Reviews) where independent experts check that requirements are met with adequate margins before committing to build and launch. This review checks the same kinds of things: budget, launch compatibility, power, thermal, propulsion, communications, payload, trajectory, radiation and reliability.</div></div>`;
      el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-go]')) { ORB.app.go(e.target.closest('[data-go]').dataset.go); return; }
        if (e.target.closest('[data-goto]')) { e.preventDefault(); const g = e.target.closest('[data-goto]').dataset.goto; if (g.startsWith('@')) ORB.app.go(g.slice(1)); else ORB.app.go('design', { tab: g }); return; }
        if (e.target.closest('[data-launch]')) {
          if (!r.go) {
            const list = ev.issues.filter((i) => i.sev === 'fail').map((i) => `<li>${esc(i.title)}</li>`).join('');
            const ok = await U.confirm('Override the review board?', `<p>These violations remain:</p><ul>${list}</ul><p>The simulation will not ignore them: an overweight rocket underperforms, a starved power system browns out, too little Δv means no orbit insertion, and a budget overrun is paid for by cutting operations.</p>`, 'Launch anyway', true);
            if (!ok) return;
          }
          S.run.readinessAtLaunch = { score: r.score, go: r.go, fails: r.fails, warns: r.warns };
          S.run.overrode = !r.go;
          S.saveRun();
          ORB.app.go('launch');
        }
      });
    },
  };
})();
