/* ORBITAL — Mission Control (live operations) */
(function () {
  const ORB = window.ORB, U = ORB.ui, P = ORB.phys, C = ORB.CONST;
  const { esc, f, pct, W, money } = U;
  const WARPS = [['1 min/s', 1 / 60], ['10 min/s', 1 / 6], ['1 h/s', 1], ['6 h/s', 6], ['1 day/s', 24], ['1 wk/s', 168], ['1 mo/s', 730], ['6 mo/s', 4380]];
  const PHASE_NAME = { deploy: 'Launch & early orbit', commission: 'Commissioning', cruise: 'Cruise', aerobraking: 'Aerobraking', science: 'Science operations', encounter: 'Encounter', downlink: 'Downlink phase' };

  ORB.screens.ops = {
    title: 'Mission Control',
    render(el) {
      const S = ORB.store, m = S.mission();
      const sim = S.getSim();
      const ev = sim.ev, s = sim.s;
      let paused = false, warpIdx = 4, raf, lastFrame = performance.now(), lastUi = 0, lastChart = 0, lastSave = performance.now(), chartTab = 'power', logFilter = 'all', mapMode = 'auto', vPhase = 0, modalOpen = false, logLen = -1;
      const autoWarp = (phase) => {
        const durH = { deploy: 6, commission: 30 * 24, cruise: ev.time.cruiseD * 24, aerobraking: (ev.traj.extraD || 1) * 24, science: ev.time.sciDays * 24, encounter: 48, downlink: ev.time.sciDays * 24 }[phase] || 24;
        const target = { deploy: 10, commission: 8, cruise: 22, aerobraking: 10, science: 45, encounter: 12, downlink: 40 }[phase] || 20;
        const want = durH / target;
        let idx = 0; WARPS.forEach(([, v], i) => { if (v <= want * 1.4) idx = i; });
        warpIdx = idx;
      };
      autoWarp(s.phase);
      const stepH = () => ({ deploy: 0.1, commission: 1, cruise: m.type === 'moon' ? 0.5 : ev.traj.ep ? 6 : m.type === 'kbo' ? 24 : 12, aerobraking: 2, science: m.id === 'jupiter' ? 2 : 1, encounter: 0.5, downlink: 6 }[s.phase] || 1);

      el.innerHTML = `<div class="wrap-wide screen">
        <div class="panel ops-top"><div style="min-width:0"><div class="eyebrow" style="color:${m.color}">${esc(m.name)} · Mission Control</div><div class="met" id="o-met">T+0d 00:00</div></div>
          <span class="phase-badge" id="o-phase">—</span>
          <div class="row" style="margin-left:auto;gap:8px"><button class="btn sm icon-btn" id="o-play" title="Pause / resume (space)">❚❚</button><div class="warp" id="o-warp">${WARPS.map(([l], i) => `<button data-w="${i}">${l}</button>`).join('')}</div>
            <label class="switch" title="The flight team automatically picks the recommended response to anomalies"><input type="checkbox" id="o-del"><span class="track"></span><span class="lbl">Delegate decisions</span></label>
            <button class="btn sm danger" id="o-end">End mission</button></div></div>
        <div class="ops">
          <div class="col-left stack">
            <div class="panel"><div class="panel-h"><h4>Spacecraft</h4><span class="small muted" id="o-mode">nominal</span></div><div class="craft-view" id="o-craft" style="padding:8px"></div><div class="panel-pad" style="padding-top:4px" id="o-sys"></div></div>
            <div class="panel"><div class="panel-h"><h4>Operations</h4><span class="small muted">commands uplinked</span></div><div class="panel-pad" id="o-ctrl"></div></div>
          </div>
          <div class="col-center stack" style="min-width:0">
            <div class="panel" style="overflow:hidden"><div class="panel-h"><h4 id="o-maptitle">Trajectory</h4><div class="seg" id="o-mapmode"><button data-mm="route">Route</button><button data-mm="local">Local</button></div></div>
              <div class="orbit-canvas-wrap" style="border:0;border-radius:0"><canvas id="o-map"></canvas><div class="orbit-overlay" id="o-mapinfo"></div></div></div>
            <div class="panel"><div class="panel-h"><div class="chart-tabs" id="o-ctabs">${[['power', 'Power'], ['battery', 'Battery'], ['thermal', 'Thermal'], ['data', 'Data'], ['prop', 'Propellant'], ['link', 'Link & distance'], ['sci', 'Science']].map(([k, l]) => `<button data-ct="${k}">${l}</button>`).join('')}</div></div><div class="panel-pad" style="padding-top:8px"><div id="o-chart"></div></div></div>
            <div class="panel"><div class="panel-h"><h4>Mission event log</h4><div class="chart-tabs" id="o-lf">${[['all', 'All'], ['event', 'Alerts'], ['science', 'Science'], ['cmd', 'Commands']].map(([k, l]) => `<button data-lf="${k}">${l}</button>`).join('')}</div></div><div class="log" id="o-log" aria-live="polite"></div></div>
          </div>
          <div class="col-right stack">
            <div class="panel"><div class="panel-h"><h4>Live telemetry</h4><span class="status-dot ok" id="o-live"></span></div><div class="panel-pad"><div class="tiles" id="o-tiles"></div></div></div>
            <div class="panel"><div class="panel-h"><h4>Science objectives</h4><span class="mono cyan" id="o-sci">0%</span></div><div class="panel-pad" id="o-obj"></div></div>
            <div class="panel"><div class="panel-h"><h4>Discoveries</h4><span class="small muted" id="o-dn">0</span></div><div class="panel-pad" id="o-disc" style="max-height:260px;overflow-y:auto"></div></div>
          </div></div></div>`;
      const $ = (q) => el.querySelector(q);

      /* --------------------------- notifications from the simulator */
      sim.notify = (type, data) => {
        if (type === 'phase') { autoWarp(data); if (mapMode === 'auto') vPhase = 0; U.toast(`Phase: <b>${PHASE_NAME[data] || data}</b>`, 'good', '◆'); renderCtrl(); }
        if (type === 'science') U.toast(`<b>Discovery:</b> ${esc(data)} <span class="dim">(simulated)</span>`, 'science', '✧', 5000);
        if (type === 'event') { if ($('#o-del').checked) { const def = ORB.EVENTS[data.type]; sim.delegate(); U.toast(`Flight team handled: <b>${esc(def.title(sim, data.data))}</b>`, 'warn', '⚑'); } }
        if (type === 'end') { S.saveRun(); }
      };

      /* --------------------------- decision modal */
      const openDecision = () => {
        const a = s.active; if (!a || modalOpen) return;
        const def = ORB.EVENTS[a.type];
        const opts = def.options(sim, a.data);
        const delay = def.instant ? 0 : sim.commandDelayH();
        const owlt = s.owlt;
        modalOpen = true;
        const md = U.modal(`<div class="modal-h"><div class="modal-ic ${def.sev}">${def.icon}</div><div><div class="eyebrow">${ORB.fmtMET(a.t)} · ${PHASE_NAME[s.phase] || s.phase}</div><h3 style="margin:4px 0 0">${esc(def.title(sim, a.data))}</h3></div></div>
          <div class="modal-b"><p>${def.text(sim, a.data)}</p>${def.learn ? `<div class="note learn" style="margin:10px 0"><div class="nh">✦ Engineering context</div>${def.learn}</div>` : ''}
            <div class="opts">${opts.map((o) => `<button class="choice" data-o="${o.id}"><div class="cl">${esc(o.label)} ${o.rec ? '<span class="rec">RECOMMENDED</span>' : ''}</div>${o.detail ? `<div class="cd">${esc(o.detail)}</div>` : ''}</button>`).join('')}</div>
            ${def.instant ? '' : `<div class="delay-box">⟶ Your command reaches the spacecraft in ≈ ${U.dur(delay * 3600)} — one-way light time ${U.dur(owlt)} plus waiting for the next ${esc(m.dsn.label.toLowerCase())} pass (${s.dsnHours} h/day scheduled).${sim.p.computer.autonomy >= 3 ? ' Onboard autonomy (level 3) acts immediately where it can.' : ''}</div>`}
            ${opts.length > 1 ? '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sm ghost" data-o="__del">Let the flight team decide</button></div>' : ''}</div>`, { dismissable: false });
        md.root.addEventListener('click', (e) => {
          const b = e.target.closest('[data-o]'); if (!b) return;
          if (b.dataset.o === '__del') sim.delegate(); else sim.choose(b.dataset.o);
          md.close(); modalOpen = false; S.saveRun(); renderLog(true); renderCtrl();
        });
      };

      /* --------------------------- end of mission */
      let endShown = false;
      const showEnd = () => {
        if (endShown) return; endShown = true;
        const o = s.outcome, su = sim.summary();
        const good = o.status === 'complete';
        const md = U.modal(`<div class="modal-h"><div class="modal-ic ${good ? 'good' : 'bad'}">${good ? '✓' : '✕'}</div><div><div class="eyebrow">${ORB.fmtMET(o.t)}</div><h3 style="margin:4px 0 0">${good ? 'Primary mission complete' : 'Mission ended'}</h3></div></div>
          <div class="modal-b"><p>${esc(o.reason)}</p><div class="kv"><span>Objectives completed</span><span>${su.sci.toFixed(0)}%</span><span>Science data returned</span><span>${f(su.returned, 1)} Gbit</span><span>Discoveries</span><span>${s.discoveries.length}</span></div>
          <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" data-close data-rep>View the mission report →</button></div></div>`, { dismissable: false });
        md.root.querySelector('[data-rep]').addEventListener('click', () => ORB.app.go('report'));
      };

      /* --------------------------- controls */
      const renderCtrl = () => {
        const pend = (kind, id) => s.pending.find((p) => p.type === '__cmd' && p.cmd.kind === kind && (id == null || p.cmd.id === id));
        const inst = sim.instruments().map(({ id, st, spec }) => {
          const stTxt = st.failed ? '<span class="chip bad">FAILED</span>' : st.health < 0.6 ? '<span class="chip warn">DEGRADED</span>' : st.on ? (sim.instActive(st, id) ? '<span class="chip good">ACTIVE</span>' : '<span class="chip">STANDBY</span>') : '<span class="chip">OFF</span>';
          const p = pend('inst', id);
          return `<div class="inst-row"><span>${spec.icon}</span><span class="nm" title="${esc(spec.name)}">${esc(spec.short)}</span>${p ? '<span class="chip cyan">uplinking…</span>' : stTxt}<button class="btn sm" data-ci="${id}" ${st.failed || p ? 'disabled' : ''}>${st.on ? 'Off' : 'On'}</button></div>`;
        }).join('');
        const prioOpts = sim.instruments().map(({ id, spec }) => `<option value="${id}" ${(s.dlPriority || []).length === 1 && s.dlPriority[0] === id ? 'selected' : ''}>${esc(spec.short)} first</option>`).join('');
        $('#o-ctrl').innerHTML = `${inst}
          <div class="sep"></div>
          <div class="row between"><span class="small">Power-saving mode</span><button class="btn sm ${s.powerSaver ? 'primary' : ''}" data-cs ${pend('saver') ? 'disabled' : ''}>${s.powerSaver ? 'ON' : 'OFF'}</button></div>
          <div class="row between" style="margin-top:8px"><span class="small">Survival heaters</span><button class="btn sm" data-ch ${pend('heaters') ? 'disabled' : ''}>${s.heatersOn ? 'ON' : 'OFF'}</button></div>
          ${s.safe ? `<div class="row between" style="margin-top:8px"><span class="small bad">Safe mode</span><button class="btn sm" data-cx ${pend('safeexit') ? 'disabled' : ''}>Command exit</button></div>` : ''}
          <div class="field" style="margin:14px 0 6px"><div class="field-h"><label class="small">${esc(m.dsn.label)}</label><span class="val" id="o-dsnv">${s.dsnHours} h/day</span></div><input type="range" id="o-dsn" min="${m.dsn.min}" max="${m.dsn.max}" step="0.5" value="${s.dsnHours}"><div class="hint">Ground scheduling — takes effect immediately. ≈ ${money(m.dsn.costH * 24 * 30)} per extra h/day per month.</div></div>
          <div class="field" style="margin:8px 0 0"><div class="field-h"><label class="small">Downlink priority</label></div><select id="o-prio" style="width:100%"><option value="">Balanced (proportional)</option>${prioOpts}</select></div>
          ${s.pending.length ? `<div class="small muted" style="margin-top:10px">${s.pending.length} command${s.pending.length > 1 ? 's' : ''} in transit…</div>` : ''}`;
        const r = $('#o-dsn'); U.setRange(r);
        r.addEventListener('input', () => { U.setRange(r); $('#o-dsnv').textContent = `${r.value} h/day`; });
        r.addEventListener('change', () => { const old = s.dsnHours; sim.command({ kind: 'dsn', value: +r.value }); s.extraCost += (+r.value - old) * m.dsn.costH * Math.max(0, (s.sciEnd || ev.time.totalD * 24) - s.t) / 24; renderCtrl(); });
        $('#o-prio').addEventListener('change', (e) => { const v = e.target.value; sim.command({ kind: 'prio', value: v, label: v ? `Downlink ${ORB.INSTRUMENT_BY_ID[v].short} data first` : 'Balanced downlink' }); renderCtrl(); });
      };
      $('#o-ctrl').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.dataset.ci) { const st = s.inst[b.dataset.ci]; sim.command({ kind: 'inst', id: b.dataset.ci, value: !st.on, label: `${ORB.INSTRUMENT_BY_ID[b.dataset.ci].short} ${st.on ? 'off' : 'on'}` }); }
        if (b.dataset.cs !== undefined) sim.command({ kind: 'saver', value: !s.powerSaver, label: `Power-saving mode ${s.powerSaver ? 'off' : 'on'}` });
        if (b.dataset.ch !== undefined) sim.command({ kind: 'heaters', value: !s.heatersOn, label: `Heaters ${s.heatersOn ? 'off' : 'on'}` });
        if (b.dataset.cx !== undefined) sim.command({ kind: 'safeexit', label: 'Exit safe mode' });
        renderCtrl(); renderLog(true);
      });

      /* --------------------------- telemetry tiles & status */
      const velocity = () => {
        const tr = ev.traj;
        if (['science', 'aerobraking', 'commission', 'downlink'].includes(s.phase) && m.type !== 'kbo') return m.id === 'asteroid' ? `${ev.orbit.v.toFixed(2)} m/s` : `${(ev.orbit.v || 0).toFixed(2)} km/s`;
        if (m.type === 'leo') return `${ev.orbit.v.toFixed(2)} km/s`;
        if (m.type === 'moon') { const r = Math.max(6578, s.distKm); const a = (6578 + 384400) / 2; return `${P.visViva(ORB.BODIES.earth.mu, r, a).toFixed(2)} km/s`; }
        const r = s.sunAU * C.AU_KM;
        if (m.type === 'kbo') return `${Math.sqrt(tr.vinfArr ** 2 + 2 * C.MU_SUN * (1 / r - 1 / (44 * C.AU_KM))).toFixed(1)} km/s`;
        if (tr.ep) return `${P.vCirc(C.MU_SUN, r).toFixed(1)} km/s`;
        const a = (tr.type === 'ega' && sim.days < 730 ? 1.5874 : tr.base.a) * C.AU_KM;
        return `${P.visViva(C.MU_SUN, r, a).toFixed(1)} km/s`;
      };
      const tile = (l, v, sub, cls = '', wide) => `<div class="tile ${wide ? 'wide' : ''}"><div class="l">${l}</div><div class="v ${cls}">${v}</div>${sub != null ? `<div class="s">${sub}</div>` : ''}</div>`;
      const renderTiles = () => {
        const socP = s.soc / s.battCap;
        const dvLeft = P.rocketDv(sim.p.engine.isp, ev.mass.dry + s.prop, ev.mass.dry) * 1000;
        const ret = Object.values(s.inst).reduce((a, x) => a + x.returned, 0);
        const link = s.conj ? 'SOLAR CONJUNCTION' : s.safe ? 'SAFE MODE · LGA' : s.rateNow > 0 ? 'LOCKED' : 'NO LINK';
        $('#o-tiles').innerHTML = [
          tile('Distance from Earth', U.dist(s.distKm), `light time ${U.dur(s.owlt)}`),
          tile('Distance from Sun', `${s.sunAU.toFixed(s.sunAU > 10 ? 1 : 3)} AU`, `sunlight ${pct(1 / s.sunAU ** 2, s.sunAU > 3 ? 1 : 0)}`),
          tile('Velocity', velocity(), ['science', 'aerobraking', 'commission'].includes(s.phase) && m.type !== 'kbo' ? 'orbital' : m.type === 'leo' || m.type === 'moon' ? 'Earth-relative' : 'heliocentric'),
          tile('Battery', pct(socP), `${f(s.soc)} / ${f(s.battCap)} Wh${s.eclDod > 0 ? ` · DoD ${pct(s.eclDod)}` : ''}`, socP < 0.25 ? 'bad' : socP < 0.5 ? 'warn' : 'good'),
          tile('Power generation', W(s.genSun || 0), `orbit avg ${W(s.gen)}`),
          tile('Power consumption', W(s.load), `${s.epPower > 0 ? `thruster ${W(s.epPower)} · ` : ''}heaters ${W(s.heater || 0)}`, s.load > s.gen ? 'warn' : ''),
          tile('Propellant', `${f(s.prop, 1)} kg`, `Δv left ${f(dvLeft)} m/s`, s.prop < ev.design.propellant * 0.1 ? 'warn' : ''),
          tile('Internal temp.', U.temp(s.temp), `limits ${U.temp(ev.thermal.tMin)} … ${U.temp(ev.thermal.tMax)}`, s.temp > ev.thermal.tMax || s.temp < ev.thermal.tMin - 5 ? 'bad' : ''),
          tile('Comm link', U.rate(s.rateNow), link, s.conj || s.rateNow === 0 ? 'bad' : s.safe ? 'warn' : ''),
          tile('Data on board', `${f(s.storageUsed, 2)} Gbit`, `of ${sim.p.storage.gbit} · lost ${f(s.dataLost, 1)}`, s.storageUsed > sim.p.storage.gbit * 0.9 ? 'warn' : ''),
          tile('Data returned', `${f(ret, 2)} Gbit`, 'safely on Earth'),
          tile('Radiation dose', `${f(s.dose, 1)} krad`, `tolerance ${sim.p.computer.tidKrad} krad`, s.dose > sim.p.computer.tidKrad ? 'bad' : s.dose > sim.p.computer.tidKrad * 0.6 ? 'warn' : ''),
        ].join('');
        // subsystem status
        const st = (ok, warn) => (ok ? 'ok' : warn ? 'warn' : 'fail');
        const net = s.gen - s.load;
        const instAll = Object.values(s.inst), failed = instAll.filter((x) => x.failed).length, deg = instAll.filter((x) => !x.failed && x.health < 0.6).length;
        const rows = [
          ['Power', st(socP > 0.5 && net >= -1, socP > 0.2), `${pct(socP)} · ${net >= 0 ? '+' : ''}${net.toFixed(0)} W`],
          ['Thermal', st(s.temp <= ev.thermal.tMax && s.temp >= ev.thermal.tMin - 2, s.temp <= ev.thermal.tMax + 8 && s.temp >= ev.thermal.tMin - 10), U.temp(s.temp)],
          ['Communications', st(s.rateNow > 0 && !s.safe && !s.conj, s.rateNow > 0), s.conj ? 'conjunction' : U.rate(s.rateNow)],
          ['Attitude control', st(s.acsMode === 'nominal', s.acsMode === 'hybrid'), `${s.acsMode}${sim.p.acs.wheels ? ` · ${s.wheels} wheels` : ''}`],
          ['Propulsion', st(s.prop > ev.design.propellant * 0.15 || s.phase === 'science', s.prop > 1), `${f(s.prop)} kg`],
          ['Computer & data', st(!s.safe && s.dose < sim.p.computer.tidKrad * 0.6, s.dose < sim.p.computer.tidKrad), s.safe ? 'SAFE MODE' : `L${sim.p.computer.autonomy} autonomy`],
          ['Payload', st(!failed && !deg, failed < instAll.length), `${instAll.filter((x) => x.on && !x.failed).length}/${instAll.length} on${failed ? ` · ${failed} failed` : ''}${deg ? ` · ${deg} degraded` : ''}`],
        ];
        $('#o-sys').innerHTML = rows.map(([n, c, v]) => `<div class="sys-row"><span class="status-dot ${c}"></span><span>${n}</span><span class="sv">${v}</span></div>`).join('');
        $('#o-mode').textContent = s.safe ? 'SAFE MODE' : s.powerSaver ? 'power saving' : s.hibernate && s.phase === 'cruise' ? 'hibernating' : 'nominal';
        $('#o-mode').className = `small ${s.safe ? 'bad' : s.powerSaver ? 'warn' : 'muted'}`;
        // objectives
        const objs = sim.objectives();
        $('#o-sci').textContent = `${sim.sciIndex().toFixed(0)}%`;
        $('#o-obj').innerHTML = objs.map((o) => `<div class="obj-prog"><div class="mh"><span>${esc(o.name)}</span><span class="mono">${pct(o.completion)}</span></div>${U.bar(o.completion, o.completion >= 1 ? 'good' : '')}</div>`).join('');
        $('#o-dn').textContent = s.discoveries.length;
        $('#o-disc').innerHTML = s.discoveries.length ? s.discoveries.slice().reverse().map((d) => `<div class="disc"><b>✧ ${esc(d.title)}</b><div class="small muted">${esc(d.text)}</div><div class="small dim mono">${ORB.fmtMET(d.t)}</div></div>`).join('') : '<div class="small muted">Science discoveries will appear here as data reaches Earth.</div>';
        // top
        $('#o-met').textContent = ORB.fmtMET(s.t);
        const prog = s.sciStart != null && s.sciEnd ? ` · ${pct(U.clamp((s.t - s.sciStart) / (s.sciEnd - s.sciStart), 0, 1))}` : s.phase === 'cruise' ? ` · ${pct(U.clamp(ev.traj.ep ? s.dvDone / ev.traj.epDv : sim.days / ev.time.cruiseD, 0, 1))}` : '';
        $('#o-phase').textContent = (s.outcome ? 'MISSION ENDED' : (PHASE_NAME[s.phase] || s.phase)) + prog;
        $('#o-play').textContent = paused ? '▶' : '❚❚';
        $('#o-live').className = `status-dot ${s.outcome ? 'fail' : paused ? 'warn' : 'ok'}`;
        U.$$('#o-warp button', el).forEach((b, i) => b.classList.toggle('on', i === warpIdx));
        // craft (re-render occasionally)
        const key = JSON.stringify([Object.values(s.inst).map((x) => [x.on, x.failed, x.health]), Math.round(s.arrayHealth * 10)]);
        if (key !== renderTiles._k) { renderTiles._k = key; $('#o-craft').innerHTML = ORB.art.spacecraft(ev.design, ev, { state: s }); }
      };

      /* --------------------------- charts */
      const renderChart = () => {
        const h = s.hist; if (h.t.length < 2) { $('#o-chart').innerHTML = '<div class="small muted" style="padding:30px 0;text-align:center">Telemetry history will appear as the mission progresses.</div>'; return; }
        if ($('#o-chart').firstChild && !$('#o-chart').querySelector('canvas')) $('#o-chart').innerHTML = '';
        const X = h.t, base = { x: X, xName: 'Day', xFmt: (v) => 'd' + v.toFixed(0), h: 200 };
        const cfg = {
          power: { ...base, yLabel: 'W', yFmt: (v) => U.short(v) + ' W', series: [{ label: 'Generation (orbit avg)', color: '#3ee6a0', data: h.gen }, { label: 'Consumption', color: '#ff8a5c', data: h.load }] },
          battery: { ...base, yLabel: '%', yMin: 0, yMax: 100, yFmt: (v) => v.toFixed(0) + '%', series: [{ label: 'State of charge', color: '#4fd8ff', data: h.soc, fill: true }], hlines: [{ y: 30, label: 'low', color: '#ffc24d' }] },
          thermal: { ...base, yLabel: '°C', yFmt: (v) => v.toFixed(0) + '°C', series: [{ label: 'Internal temperature', color: '#ff8a5c', data: h.temp }], hlines: [{ y: ev.thermal.tMax - 273.15, label: 'hot limit', color: '#ff5c7a' }, { y: ev.thermal.tMin - 273.15, label: 'cold limit', color: '#4d8dff' }] },
          data: { ...base, yLabel: 'Gbit', yFmt: (v) => U.short(v), series: [{ label: 'Returned to Earth', color: '#c08bff', data: h.returned, fill: true }, { label: 'On board', color: '#ffc24d', data: h.stored }] },
          prop: { ...base, yLabel: 'kg', yMin: 0, yFmt: (v) => U.short(v) + ' kg', series: [{ label: 'Propellant', color: '#4d8dff', data: h.prop, fill: true }] },
          link: { ...base, yLabel: 'bit/s', logY: true, yMin: 1, yFmt: (v) => U.rate(v), yFmtR: (v) => v.toFixed(2) + ' AU', series: [{ label: 'Data rate', color: '#3ee6a0', data: h.rate.map((v) => Math.max(1, v)), fmt: (v) => U.rate(v) }, { label: 'Earth distance (AU)', color: '#a184ff', data: h.dist, axis: 'r', fmt: (v) => v.toFixed(3) + ' AU' }] },
          sci: { ...base, yLabel: '%', yMin: 0, yMax: 100, yFmt: (v) => v.toFixed(0) + '%', series: [{ label: 'Objective completion', color: '#c08bff', data: h.sci, fill: true }] },
        }[chartTab];
        U.lineChart($('#o-chart'), cfg);
        U.$$('#o-ctabs button', el).forEach((b) => b.classList.toggle('on', b.dataset.ct === chartTab));
      };

      /* --------------------------- log */
      const renderLog = (force) => {
        if (!force && s.log.length === logLen) return;
        logLen = s.log.length;
        const L = s.log.filter((l) => logFilter === 'all' || (logFilter === 'event' ? ['warn', 'bad', 'good'].includes(l.level) : l.level === logFilter)).slice(-150).reverse();
        $('#o-log').innerHTML = L.map((l) => `<div><span class="tm">${ORB.fmtMET(l.t)}</span><span class="${l.level}">${esc(l.msg)}</span></div>`).join('');
        U.$$('#o-lf button', el).forEach((b) => b.classList.toggle('on', b.dataset.lf === logFilter));
      };

      /* --------------------------- map */
      const route = ORB.trajModel(ev);
      const drawMap = (ts, dSimH) => {
        const cv = $('#o-map'); const { ctx, w, h } = U.fitCanvas(cv, Math.min(440, Math.max(280, cv.clientWidth * 0.56)));
        const inOrbit = ['science', 'aerobraking', 'commission', 'downlink', 'encounter'].includes(s.phase) || s.outcome && s.sciStart != null;
        let mode = mapMode === 'auto' ? (inOrbit || m.type === 'leo' ? 'local' : 'route') : mapMode;
        if (m.type === 'leo') mode = 'local';
        U.$$('#o-mapmode button', el).forEach((b) => b.classList.toggle('on', b.dataset.mm === mode));
        const so = ev.orbit;
        if (so.periodMin) vPhase = (vPhase + Math.min(dSimH * 60 / so.periodMin, 0.012)) % 1; else vPhase = (vPhase + 0.002) % 1;
        if (mode === 'route' && (m.type === 'helio' || m.type === 'kbo')) {
          let i = 0; while (i < route.path.length - 1 && route.path[i].t < sim.days) i++;
          const tb = route.tb;
          const extra = [];
          if (ev.traj.jupiter) { const thJ = Math.atan2(ev.traj.jupiter.y, ev.traj.jupiter.x) - (2 * Math.PI / 4332.59) * (ev.traj.jupiter.tD - sim.days); extra.push({ x: 5.2 * Math.cos(thJ), y: 5.2 * Math.sin(thJ), color: '#d8b48a', label: 'Jupiter', r: 5 }); }
          const prev = route.path[Math.max(0, i - 1)], nx = route.path[i];
          ORB.art.drawHelio(ctx, w, h, { ...route, pathSplit: s.phase === 'cruise' || s.phase === 'deploy' ? i : route.path.length, sc: { x: s.posX, y: s.posY, ang: Math.atan2(-(nx.y - prev.y), nx.x - prev.x) }, earth: { x: s.earthX, y: s.earthY }, target: { x: s.targetX, y: s.targetY, color: m.color, label: tb.name, r: m.type === 'kbo' ? 4 : 6 }, extra, comm: s.rateNow > 0, conj: s.conj }, ts);
          $('#o-maptitle').textContent = 'Heliocentric trajectory';
          $('#o-mapinfo').textContent = `Sun–Earth–probe angle ${s.sepDeg != null ? s.sepDeg.toFixed(1) + '°' : '—'}${s.conj ? ' · CONJUNCTION' : ''}`;
        } else if (mode === 'route' && m.type === 'moon') {
          const n = 80, tr = ev.traj, path = [];
          for (let k = 0; k <= n; k++) { const q = k / n; let r, a; if (tr.type === 'blt') { r = 6578 + (384400 - 6578) * q + 1.1e6 * Math.sin(Math.PI * q); a = Math.PI * 0.95 * q + 0.6 * Math.sin(Math.PI * q); } else if (tr.ep) { r = 24000 + (384400 - 24000) * q; a = q * 2 * Math.PI * 9; } else { r = 6578 + (384400 - 6578) * (1 - Math.cos(Math.PI * q)) / 2; a = Math.PI * q; } path.push({ x: r * Math.cos(a + Math.PI), y: r * Math.sin(a + Math.PI) }); }
          const q = s.phase === 'cruise' ? (s.moonF || 0) : s.phase === 'deploy' ? 0 : 1; const k = Math.min(n, Math.round(q * n));
          ORB.art.drawEarthMoon(ctx, w, h, { moonAngle: 0, path, split: k, sc: { ...path[k], ang: 0 }, bltOut: tr.type === 'blt' }, ts);
          $('#o-maptitle').textContent = 'Earth–Moon transfer'; $('#o-mapinfo').textContent = `${U.dist(s.distKm)} from Earth`;
        } else {
          const kind = ORB.art.destKind(m);
          let M = { kind, phase: vPhase, label: so.label };
          if (m.type === 'leo') { const R = ORB.BODIES.earth.R; M = { ...M, bodyFrac: 0.27, orbit: { aFrac: (R + so.alt) / R, e: 0, viewTilt: Math.max(0.12, Math.abs(Math.cos((so.incDeg * Math.PI) / 180))) * 0.9 + 0.1, rot: -0.15 }, eclipse: so.ecl > 0.02 }; }
          else if (m.type === 'moon') { const R = ORB.BODIES.moon.R; M = { ...M, bodyFrac: 0.3, orbit: { aFrac: (R + so.alt) / R, e: 0, viewTilt: so.incOpt.id === 'polar' ? 0.95 : 0.15, rot: so.incOpt.id === 'polar' ? 1.35 : -0.1 }, eclipse: true }; }
          else if (m.id === 'mars') { const R = ORB.BODIES.mars.R, o = so.opt; const rp = R + o.alt, ra = R + (s.phase === 'aerobraking' ? o.captureApo * (1 - (s.t - (s.phaseStart || s.t)) / (180 * 24)) + o.alt : o.apo); const a = (rp + ra) / 2; const e = (ra - rp) / (ra + rp); M = { ...M, bodyFrac: Math.min(0.3, 0.42 * R / (a * (1 + e))), orbit: { aFrac: a / R, e, viewTilt: 0.95, rot: 1.4 }, eclipse: true }; }
          else if (m.id === 'jupiter') { const R = ORB.BODIES.jupiter.R; const a = (so.rp + so.ra) / 2, e = (so.ra - so.rp) / (so.ra + so.rp); M = { ...M, bodyFrac: 0.09, orbit: { aFrac: Math.min(5.2, a / R / 8), e: Math.min(0.92, e), viewTilt: 0.9, rot: 1.5 } }; }
          else if (m.id === 'asteroid') M = { ...M, bodyFrac: 0.2, orbit: { aFrac: so.opt.radiusKm / 0.35 / 2.2, e: 0, viewTilt: so.opt.eclipse ? 0.4 : 0.95, rot: 1.57 }, eclipse: so.opt.eclipse };
          else if (m.type === 'kbo') M = { ...M, bodyFrac: 0.16, flyby: true, phase: s.phase === 'encounter' ? U.clamp((s.t - (s.phaseStart || s.t)) / 48, 0, 1) : s.phase === 'downlink' ? 1 : 0, label: `Flyby at ${ev.orbit.opt.km.toLocaleString()} km` };
          if (m.type !== 'leo' && !inOrbit) { const R = ORB.BODIES.earth.R; M = { kind: 'earth', phase: vPhase, bodyFrac: 0.25, orbit: { aFrac: 1.05 + Math.min(3, s.t / 6), e: 0.3, viewTilt: 0.5, rot: -0.2 }, label: 'Departing Earth' }; }
          ORB.art.drawLocal(ctx, w, h, M, ts);
          $('#o-maptitle').textContent = inOrbit || m.type === 'leo' ? 'Orbit view' : 'Near-Earth view';
          $('#o-mapinfo').textContent = so.periodMin ? `orbit period ${so.periodMin > 2880 ? U.days(so.periodMin / 1440) : so.periodMin.toFixed(0) + ' min'}` : '';
        }
      };

      /* --------------------------- loop */
      const loop = (now) => {
        const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
        let dSim = 0;
        if (!paused && !s.outcome && !s.active) {
          const want = WARPS[warpIdx][1] * dt;
          const h = stepH();
          const n = Math.min(800, Math.max(1, Math.round(want / h)));
          const step = want / n;
          for (let i = 0; i < n; i++) { sim.step(Math.min(step, h)); dSim += step; if (s.active || s.outcome) break; }
        }
        if (s.active && !modalOpen) { renderTiles(); openDecision(); }
        if (s.outcome && !s.active && !modalOpen) { renderTiles(); renderChart(); renderLog(); showEnd(); }
        drawMap(now / 1000, dSim);
        if (now - lastUi > 140) { lastUi = now; renderTiles(); renderLog(); }
        if (now - lastChart > 1500) { lastChart = now; renderChart(); }
        if (now - lastSave > 4000) { lastSave = now; S.saveRun(); }
        raf = requestAnimationFrame(loop);
      };

      /* --------------------------- wiring */
      $('#o-play').addEventListener('click', () => { paused = !paused; });
      $('#o-warp').addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (b) warpIdx = +b.dataset.w; });
      $('#o-ctabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ct]'); if (b) { chartTab = b.dataset.ct; renderChart(); } });
      $('#o-lf').addEventListener('click', (e) => { const b = e.target.closest('[data-lf]'); if (b) { logFilter = b.dataset.lf; renderLog(true); } });
      $('#o-mapmode').addEventListener('click', (e) => { const b = e.target.closest('[data-mm]'); if (b) mapMode = b.dataset.mm; });
      $('#o-del').checked = !!s.autoDelegate;
      $('#o-del').addEventListener('change', (e) => { s.autoDelegate = e.target.checked; });
      $('#o-end').addEventListener('click', async () => {
        if (s.outcome) { ORB.app.go('report'); return; }
        const ok = await U.confirm('End the mission now?', 'Operations will stop and the final report will be generated with the science returned so far.', 'End mission', true);
        if (ok) { sim.finish('ended', 'The mission director ended operations early.'); S.saveRun(); }
      });
      const key = (e) => { if (e.code === 'Space' && !modalOpen && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); paused = !paused; } };
      document.addEventListener('keydown', key);
      renderCtrl(); renderTiles(); renderChart(); renderLog(true);
      raf = requestAnimationFrame(loop);
      return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); sim.notify = null; S.saveRun(); const mr = document.getElementById('modal-root'); mr.classList.remove('open'); mr.innerHTML = ''; };
    },
  };
})();
