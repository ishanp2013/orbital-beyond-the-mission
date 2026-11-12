/* ORBITAL — Scoring and the final mission report */
(function () {
  const ORB = window.ORB, U = ORB.ui;
  const { esc, f, money, pct, kg, W } = U;

  ORB.scoreMission = (sim, run) => {
    const s = sim.s, ev = sim.ev, o = s.outcome || { status: 'ended' };
    const sci = sim.sciIndex();
    const reached = s.sciStart != null && !s.flags.flybyOnly;
    const plannedH = ev.design.duration * 24;
    const sciFrac = reached ? U.clamp(s.sciHours / plannedH, 0, 1) : 0;
    const finalCost = ev.cost.total + s.extraCost;
    const budget = ev.cost.budget;
    const ra = run.readinessAtLaunch || ev.readiness;
    const disc = s.discoveries.reduce((a, d) => a + [3, 6, 10][d.tier || 0], 0);
    const dec = s.decisions.length ? s.decisions.reduce((a, d) => a + d.score, 0) / s.decisions.length : 0.6;
    const B = [];
    B.push({ k: 'science', label: 'Scientific return', pts: (sci / 100) * 400, max: 400, note: `${sci.toFixed(0)}% of weighted objectives` });
    B.push({ k: 'disc', label: 'Discoveries', pts: Math.min(40, disc), max: 40, note: `${s.discoveries.length} logged` });
    B.push({ k: 'exec', label: 'Mission execution', pts: o.status === 'launch_failure' ? 0 : (reached ? 80 : s.flags.flybyOnly ? 25 : 0) + sciFrac * 80 + (o.status === 'complete' ? 40 : 0), max: 200, note: o.status === 'complete' ? 'completed as planned' : esc(o.reason || '') });
    B.push({ k: 'eng', label: 'Engineering quality', pts: (ra.score / 100) * 150 * (run.overrode ? 0.5 : 1), max: 150, note: `readiness ${ra.score}${run.overrode ? ' · board overridden' : ''}` });
    const bud = finalCost <= budget ? 75 + 25 * Math.min(1, (budget - finalCost) / (0.1 * budget)) : Math.max(0, 75 - ((finalCost - budget) / budget) * 300);
    B.push({ k: 'budget', label: 'Budget management', pts: bud, max: 100, note: `${money(finalCost)} of ${money(budget)}` });
    B.push({ k: 'ops', label: 'Operational decisions', pts: U.clamp(55 + 27.5 * dec, 0, 110), max: 110, note: `${s.decisions.length} decisions` });
    const score = Math.round(Math.min(1000, B.reduce((a, b) => a + b.pts, 0)));
    let rating, rank;
    const bad = ['lost', 'stranded', 'reentry', 'ended'].includes(o.status);
    if (o.status === 'launch_failure' || !s.sciStart || sci < 15) { rating = 'Mission Failure'; rank = 0; }
    else if (sci < 50 || bad || s.flags.flybyOnly) { rating = 'Partial Success'; rank = 1; }
    else if (sci >= 85 && score >= 800 && o.status === 'complete') { rating = 'Exceptional Mission'; rank = 3; }
    else { rating = 'Successful Mission'; rank = 2; }
    return { score, rating, ratingRank: rank, breakdown: B, finalCost, sci, reached };
  };

  ORB.lessons = (sim, run, sc) => {
    const s = sim.s, ev = sim.ev, d = ev.design, L = [];
    const cnt = (t) => s.events.filter((e) => e.type === t).length;
    const good = (txt) => L.push({ good: true, txt }), bad = (txt) => L.push({ good: false, txt });
    const ret = Object.values(s.inst).reduce((a, x) => a + x.returned, 0);
    if (s.outcome && s.outcome.status === 'launch_failure') bad(`The launch failed. ${esc(s.outcome.reason)} Vehicle reliability and launch-mass margin are design choices: a more reliable rocket or a lighter spacecraft reduces this risk.`);
    if (run.overrode) bad(`You overrode the readiness review with ${run.readinessAtLaunch ? run.readinessAtLaunch.fails : '?'} blocking violation(s). The simulation enforced their physical consequences.`);
    if (s.shortfallDv > 0) bad(`The launch fell ${(s.shortfallDv * 1000).toFixed(0)} m/s short — ${ev.lv.margin < 0 ? 'the spacecraft was heavier than the rocket could lift' : 'a vehicle anomaly'} — and the spacecraft spent its own propellant to compensate.`);
    if (cnt('power_shortage') || /battery|brownout/i.test(s.events.map((e) => e.title).join(' '))) bad(`Power emergencies occurred ${cnt('power_shortage') + s.events.filter((e) => e.type === 'safe_mode').length} time(s). Worst-case power margin was ${pct(ev.power.margin)}; designers typically keep 15–30% to absorb degradation and surprises.`);
    else if (ev.power.margin >= 0.15) good(`A ${pct(ev.power.margin)} power margin kept the spacecraft energy-positive throughout the mission.`);
    if (s.dataLost > 0.5 || ev.comms.returnRatio < 0.5) bad(`${f(s.dataLost, 1)} Gbit of data was lost to a full recorder, and the link could only return about ${pct(ev.comms.returnRatio)} of what instruments produced. A larger dish, more transmitter power, Ka-band or more ground-station time would have returned more science.`);
    else if (ret > 0) good(`The telecom system returned ${f(ret, 1)} Gbit with almost nothing lost — the link and recorder were well matched to the instruments.`);
    if (ev.radiation.ratio > 0.8) bad(`Radiation dose reached ${f(s.dose, 0)} krad against a ${ev.parts.computer.tidKrad} krad tolerance. More vault shielding or a harder computer would have reduced upsets and failures.`);
    else if (sim.m.id === 'jupiter') good(`Shielding (${ev.radiation.shieldMm.toFixed(1)} mm) kept the radiation dose to ${f(s.dose, 0)} krad — inside the electronics' tolerance in Jupiter's belts.`);
    if (cnt('wheel_fault')) { if (ev.parts.acs.wheels >= 4) good('The spare (fourth) reaction wheel took over after a wheel failure — redundancy paid off.'); else bad('A reaction wheel failed and there was no spare; hybrid thruster control cost propellant and pointing accuracy.'); }
    const safes = s.events.filter((e) => e.type === 'safe_mode').length;
    if (safes && ev.geo.owltMaxS > 600 && ev.parts.computer.autonomy < 3) bad(`The spacecraft entered safe mode ${safes} time(s). With light times up to ${U.dur(ev.geo.owltMaxS)}, each recovery waited on Earth — onboard autonomy would have shortened outages.`);
    if (ev.parts.computer.autonomy >= 3 && safes) good('The autonomy suite handled faults without waiting for Earth, minimising downtime.');
    if (cnt('thermal_hot') || cnt('thermal_cold')) bad(`Thermal excursions occurred: the ${d.radiatorArea.toFixed(1)} m² radiator and ${ev.parts.thermalCtrl.name.toLowerCase()} did not cover every case.`);
    if (s.flags.flybyOnly) bad('Orbit insertion failed for lack of Δv: the spacecraft flew past its target. Δv margin is not optional — insertion is a one-shot event.');
    if (s.flags.badOrbit) bad('A partial insertion left the spacecraft in a poor orbit, reducing data quality.');
    if (s.flags.debrisFail) bad('No propellant remained for the end-of-life deorbit burn: the spacecraft becomes long-lived orbital debris.');
    if (s.flags.fundingCut) bad(`The budget overrun was paid for by cutting ground-station time by ${pct(s.flags.fundingCut)} — directly reducing science return.`);
    ev.sciList.filter((x) => x.rel < 0.35 && !x.radio).forEach((x) => bad(`The ${x.inst.short} had low relevance here (${pct(x.rel)}): mass, power and money that bought little science.`));
    ev.science.objectives.filter((o) => !o.contrib.length).forEach((o) => bad(`No instrument addressed "${o.name}" — ${pct(o.weight)} of the science score was out of reach.`));
    if (ev.parts.engine.type === 'ep' && ev.traj.ep) good(`Electric propulsion delivered ${(ev.traj.epDv).toFixed(1)} km/s of Δv with only ${f(ev.design.propellant)} kg of xenon — impossible with chemical engines.`);
    if (ev.traj.jupiter) good(`The Jupiter gravity assist added ${ev.traj.jupiter.dvGain.toFixed(2)} km/s for free.`);
    if (ev.traj.type === 'ega') good('The Earth gravity assist cut the required launch energy from C3 ≈ 77 to ≈ 28 km²/s², allowing a smaller rocket at the cost of two extra years.');
    if (ev.traj.extraD && ev.orbit.opt && ev.orbit.opt.aerobrake) good('Aerobraking saved about 1 km/s of propellant by using the Martian atmosphere.');
    s.decisions.filter((x) => x.score >= 2).slice(0, 3).forEach((x) => good(`Good call — "${esc(x.choice)}" during "${esc(x.event)}".`));
    s.decisions.filter((x) => x.score <= -2).slice(0, 3).forEach((x) => bad(`Risky call — "${esc(x.choice)}" during "${esc(x.event)}".`));
    if (sc.finalCost < ev.cost.budget * 0.85) good(`The mission came in ${money(ev.cost.budget - sc.finalCost)} under budget — efficient engineering.`);
    return L;
  };

  ORB.screens.report = {
    title: 'Report',
    render(el) {
      const S = ORB.store, run = S.run, m = S.mission(), sim = S.getSim();
      const s = sim.s, ev = sim.ev;
      const sc = ORB.scoreMission(sim, run);
      let unlocked = [];
      if (!run.resultRecorded) { unlocked = S.recordResult(sc); run.resultRecorded = { ...sc, unlocked: unlocked.map((x) => x.id) }; S.saveRun(); }
      else unlocked = (run.resultRecorded.unlocked || []).map((id) => ORB.MISSION_BY_ID[id]);
      const best = S.profile.best[m.id];
      const lessons = ORB.lessons(sim, run, sc);
      const su = sim.summary();
      const rcls = ['failure', 'partial', 'success', 'exceptional'][sc.ratingRank];
      const decisionsRows = s.decisions.map((x) => `<tr><td class="mono small">${ORB.fmtMET(x.t)}</td><td>${esc(x.event)}</td><td>${esc(x.choice)}</td><td class="n ${x.score > 0 ? 'good' : x.score < 0 ? 'bad' : ''}">${x.score > 0 ? '+' : ''}${x.score}</td></tr>`).join('');
      const p = ev.parts, d = ev.design;
      const eng = [
        ['Launch vehicle', `${p.lv.name}${d.kick ? ' + kick stage' : ''} from ${p.site.name}`], ['Trajectory', ORB.TRAJ_INFO[ev.traj.type] ? ORB.TRAJ_INFO[ev.traj.type].name : 'Direct insertion'], ['Science orbit', ev.orbit.label],
        ['Power', `${d.solarArea > 0 && p.solar.id !== 'none' ? `${d.solarArea} m² ${p.solar.name}` : 'no arrays'}${d.rtgCount ? ` + ${d.rtgCount} RTG` : ''}; ${f(d.batteryWh)} Wh ${p.battery.name}; ${p.pmad.name}`],
        ['Propulsion', `${p.engine.name}, ${f(d.propellant)} kg; ${p.acs.name}`], ['Telecom', `${p.antenna.name}, ${d.txPower} W ${p.band.name}, ${d.dsnHours} h/day`],
        ['Thermal', `${p.insulation.name}; ${d.radiatorArea} m² radiator; ${p.thermalCtrl.name}`], ['Structure', `${p.structure.name}; ${d.shielding} mm vault`], ['Avionics', `${p.computer.name}; ${p.storage.name}`],
        ['Instruments', d.instruments.map((id) => ORB.INSTRUMENT_BY_ID[id].short).join(', ') || 'none'],
      ];
      el.innerHTML = `<div class="wrap screen">
        <div class="panel report-hero">${ORB.art.patch(m, 120)}
          <div class="eyebrow" style="margin-top:10px">${esc(m.name)} · Final mission report · ${run.sandbox ? 'Sandbox' : ORB.DIFFICULTY.find((x) => x.id === run.difficulty).name}</div>
          <div class="rating ${rcls}">${sc.rating}</div>
          <div class="score-big">${sc.score}</div><div class="muted">mission score out of 1,000${best && !run.sandbox ? ` · personal best ${best.score}` : ''}</div>
          ${unlocked.length ? `<div class="chip good" style="margin-top:12px">🔓 Unlocked: ${unlocked.map((x) => esc(x.name)).join(', ')}</div>` : ''}
          <p style="max-width:720px;margin:14px auto 0">${esc(s.outcome ? s.outcome.reason : '')}</p>
          <div class="row no-print" style="justify-content:center;margin-top:16px"><button class="btn primary" data-a="again">↻ Refine design & fly again</button><button class="btn" data-a="missions">Choose another mission</button><button class="btn ghost" data-a="print">⎙ Print / save as PDF</button></div></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="panel panel-pad"><h3>Score breakdown</h3>${sc.breakdown.map((b) => `<div class="metric" style="padding:8px 0;border:0"><div class="mh"><span>${b.label} <span class="dim">· ${b.note}</span></span><b>${Math.round(b.pts)} / ${b.max}</b></div>${U.bar(b.pts / b.max, b.pts / b.max > 0.7 ? 'good' : b.pts / b.max > 0.4 ? '' : 'bad')}</div>`).join('')}</div>
          <div class="panel panel-pad"><h3>Objectives</h3>${su.objs.map((o) => `<div class="obj-prog"><div class="mh"><span>${esc(o.name)} <span class="dim">· weight ${pct(o.weight)}</span></span><span class="mono">${pct(o.completion)}</span></div>${U.bar(o.completion, o.completion >= 0.99 ? 'good' : o.completion > 0.5 ? '' : 'warn')}</div>`).join('')}
            <div class="sep"></div><div class="kv"><span>Science data returned</span><span>${f(su.returned, 2)} Gbit</span><span>Data lost (recorder full)</span><span>${f(su.lost, 2)} Gbit</span><span>Left on board</span><span>${f(su.onboard, 2)} Gbit</span><span>Projected at launch</span><span>${ev.science.index.toFixed(0)}%</span></div></div></div>
        <div class="panel panel-pad" style="margin-top:16px"><h3>Mission timeline</h3>${ORB.timelineHTML(ev, sim)}<div class="legend"><span><i style="background:#ff5c7a"></i>failure / alert</span><span><i style="background:#ffc24d"></i>warning</span><span><i style="background:#c08bff"></i>science</span><span><i style="background:#3ee6a0"></i>milestone</span></div></div>
        <div class="grid g2" style="margin-top:16px"><div class="panel panel-pad"><h3>Power & battery</h3><div id="r-c1"></div></div><div class="panel panel-pad"><h3>Science data returned</h3><div id="r-c2"></div></div>
          <div class="panel panel-pad"><h3>Propellant</h3><div id="r-c3"></div></div><div class="panel panel-pad"><h3>Internal temperature</h3><div id="r-c4"></div></div></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="panel panel-pad"><h3>Lessons learned</h3><p class="small muted">Which decisions helped — and which hurt.</p>${lessons.length ? lessons.map((l) => `<div class="lesson"><span class="li">${l.good ? '<span class="good">▲</span>' : '<span class="bad">▼</span>'}</span><div>${l.txt}</div></div>`).join('') : '<div class="muted">A clean mission with no notable lessons.</div>'}</div>
          <div class="panel panel-pad"><h3>Engineering decisions</h3><div class="kv" style="grid-template-columns:auto 1fr">${eng.map(([a, b]) => `<span>${a}</span><span style="text-align:left;font-family:var(--font)">${esc(b)}</span>`).join('')}</div>
            <div class="sep"></div><div class="kv"><span>Launch mass</span><span>${kg(ev.mass.launch)}</span><span>Final cost</span><span class="${sc.finalCost > ev.cost.budget ? 'bad' : ''}">${money(sc.finalCost)} / ${money(ev.cost.budget)}</span><span>Operations extras</span><span>${money(s.extraCost)}</span>
              <span>Propellant used</span><span>${kg(d.propellant - s.prop)} of ${kg(d.propellant)}</span><span>Radiation dose</span><span>${f(s.dose, 1)} krad</span><span>Mission duration</span><span>${U.days(s.t / 24)}</span></div></div></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="panel"><div class="panel-h"><h3>Major events & decisions</h3><span class="small muted">${s.decisions.length}</span></div><div class="table-scroll"><table class="t"><thead><tr><th>Time</th><th>Event</th><th>Decision</th><th class="n">Impact</th></tr></thead><tbody>${decisionsRows || '<tr><td colspan="4" class="muted">No decisions were required.</td></tr>'}</tbody></table></div></div>
          <div class="panel"><div class="panel-h"><h3>Scientific discoveries</h3><span class="small muted">simulated findings</span></div><div class="panel-pad">${s.discoveries.length ? s.discoveries.map((x) => `<div class="disc"><b>✧ ${esc(x.title)}</b><div class="small muted">${esc(x.text)}</div><div class="small dim mono">${ORB.fmtMET(x.t)} · ${esc(x.obj)}</div></div>`).join('') : '<div class="muted">No discoveries were returned.</div>'}</div></div></div>
        <p class="small dim" style="margin-top:20px;text-align:center">Discoveries, hardware, vehicles and costs are simulated for education. Physics models are simplified — see the Library for assumptions. Not affiliated with or endorsed by NASA.</p></div>`;
      const h = s.hist, X = h.t, base = { x: X, xName: 'Day', xFmt: (v) => 'd' + v.toFixed(0), h: 180 };
      if (X.length > 1) {
        U.lineChart(el.querySelector('#r-c1'), { ...base, yFmt: (v) => U.short(v), yFmtR: (v) => v.toFixed(0) + '%', series: [{ label: 'Generation (W)', color: '#3ee6a0', data: h.gen }, { label: 'Consumption (W)', color: '#ff8a5c', data: h.load }, { label: 'Battery %', color: '#4fd8ff', data: h.soc, axis: 'r' }], yMinR: 0, yMaxR: 100 });
        U.lineChart(el.querySelector('#r-c2'), { ...base, yFmt: (v) => U.short(v) + ' Gb', series: [{ label: 'Returned', color: '#c08bff', data: h.returned, fill: true }, { label: 'On board', color: '#ffc24d', data: h.stored }] });
        U.lineChart(el.querySelector('#r-c3'), { ...base, yMin: 0, yFmt: (v) => U.short(v) + ' kg', series: [{ label: 'Propellant', color: '#4d8dff', data: h.prop, fill: true }] });
        U.lineChart(el.querySelector('#r-c4'), { ...base, yFmt: (v) => v.toFixed(0) + '°C', series: [{ label: 'Temperature', color: '#ff8a5c', data: h.temp }], hlines: [{ y: ev.thermal.tMax - 273.15, label: 'hot limit', color: '#ff5c7a' }, { y: ev.thermal.tMin - 273.15, label: 'cold limit', color: '#4d8dff' }] });
      } else U.$$('#r-c1,#r-c2,#r-c3,#r-c4', el).forEach((x) => (x.innerHTML = '<div class="muted small">No telemetry recorded.</div>'));
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'print') window.print();
        if (b.dataset.a === 'missions') ORB.app.go('missions');
        if (b.dataset.a === 'again') { const r = S.run; S.newRun(r.missionId, { difficulty: r.difficulty, sandbox: r.sandbox, budget: r.budget, design: r.design }); S.run.attempt = (r.attempt || 1) + 1; S.run.stage = 'design'; S.saveRun(); ORB.app.go('design'); }
      });
    },
  };
})();
