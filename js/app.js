/* ORBITAL — application shell: router, top bar, guards */
(function () {
  const ORB = window.ORB, U = ORB.ui;
  const STEPS = [['briefing', 'Briefing'], ['design', 'Spacecraft'], ['payload', 'Payload'], ['launcher', 'Launcher'], ['trajectory', 'Trajectory'], ['review', 'Review'], ['launch', 'Launch'], ['ops', 'Operations'], ['report', 'Report']];
  const DESIGN = ['briefing', 'design', 'payload', 'launcher', 'trajectory', 'review'];
  let cleanup = null, current = null, currentParams = null;

  const app = (ORB.app = {
    go(name, params) {
      const hash = `#/${name}${params && params.tab ? '/' + params.tab : ''}`;
      if (location.hash === hash) this.route(); else location.hash = hash;
    },
    resume() {
      const S = ORB.store, r = S.run;
      if (!r) return this.go('missions');
      if (r.launched) { const sim = S.getSim(); return this.go(sim && sim.s.outcome ? 'report' : 'ops'); }
      this.go(r.stage && DESIGN.includes(r.stage) ? r.stage : 'design');
    },
    guard(name) {
      const S = ORB.store, r = S.run;
      const needsRun = STEPS.some(([k]) => k === name);
      if (needsRun && !r) return 'missions';
      if (!r) return name;
      const sim = r.launched ? S.getSim() : null;
      if (DESIGN.includes(name) && r.launched) return sim && sim.s.outcome ? 'report' : 'ops';
      if (name === 'launch' && r.launched) return sim && sim.s.outcome ? 'report' : 'ops';
      if (name === 'launch' && !r.readinessAtLaunch) return 'review';
      if (name === 'ops' && !r.launched) return 'review';
      if (name === 'ops' && sim && sim.s.outcome && sim.s.outcome.status === 'launch_failure') return 'report';
      if (name === 'report' && (!sim || !sim.s.outcome)) return r.launched ? 'ops' : 'review';
      return name;
    },
    route() {
      const parts = (location.hash || '#/home').replace(/^#\//, '').split('/');
      let name = parts[0] || 'home';
      const params = parts[1] ? { tab: parts[1] } : {};
      if (!ORB.screens[name]) name = 'home';
      const g = this.guard(name);
      if (g !== name) { location.replace(`#/${g}`); return; }
      if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
      const S = ORB.store;
      if (S.run && DESIGN.includes(name)) { S.run.stage = name; S.run.visited = S.run.visited || {}; S.run.visited[name] = true; S.saveRun(); }
      current = name; currentParams = params;
      const root = document.getElementById('app');
      const host = document.createElement('div');
      root.replaceChildren(host);
      window.scrollTo(0, 0);
      try { cleanup = ORB.screens[name].render(host, params) || null; }
      catch (e) { console.error(e); host.innerHTML = `<div class="wrap"><div class="panel panel-pad"><h2>Something went wrong</h2><p class="muted">${U.esc(e.message)}</p><button class="btn" onclick="location.hash='#/home'">Home</button></div></div>`; }
      document.title = `ORBITAL — ${ORB.screens[name].title || 'Beyond the Mission'}`;
      this.renderTopbar();
    },
    renderTopbar() {
      const S = ORB.store, r = S.run;
      const bar = document.getElementById('stepper');
      if (!r || ['home', 'missions', 'library'].includes(current)) {
        bar.innerHTML = r && current !== 'missions' ? `<button class="btn sm ghost" data-res>▶ Resume ${U.esc(S.mission().name)}</button>` : '';
        const b = bar.querySelector('[data-res]'); if (b) b.onclick = () => app.resume();
        return;
      }
      const sim = r.launched ? S.getSim() : null;
      const ended = sim && sim.s.outcome;
      const st = ORB.store.run.design ? (() => { try { return ORB.shell.tabStatus(S.evaluate()); } catch (e) { return {}; } })() : {};
      bar.innerHTML = STEPS.map(([k, l], i) => {
        let cls = '';
        const idxCur = STEPS.findIndex((x) => x[0] === current);
        if (k === current) cls = 'active';
        else if (DESIGN.includes(k)) cls = r.launched ? 'done' : r.visited && r.visited[k] ? 'done' : 'avail';
        else if (k === 'launch') cls = r.launched ? 'done' : '';
        else if (k === 'ops') cls = r.launched ? (ended ? 'done' : 'avail') : '';
        else if (k === 'report') cls = ended ? 'avail' : '';
        const clickable = (DESIGN.includes(k) && !r.launched) || (k === 'ops' && r.launched && sim && sim.s.outcome?.status !== 'launch_failure') || (k === 'report' && ended);
        return `${i ? '<span class="step-sep"></span>' : ''}<div class="step ${cls}" ${clickable ? `data-step="${k}" role="button" tabindex="0"` : ''}><span class="n">${cls === 'done' && k !== current ? '✓' : i + 1}</span><span class="lbl">${l}</span></div>`;
      }).join('');
      U.$$('[data-step]', bar).forEach((s) => { s.onclick = () => app.go(s.dataset.step); s.onkeydown = (e) => { if (e.key === 'Enter') app.go(s.dataset.step); }; });
      const act = bar.querySelector('.step.active'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
    },
  });

  /* Demo deep links for presentations: ?demo=<missionId>[&days=N] starts that mission (all missions unlocked);
     with days=N it launches the draft design and fast-forwards N mission days (flight team handles events). */
  function demoLink() {
    const q = new URLSearchParams(location.search);
    const id = q.get('demo');
    if (!id || !ORB.MISSION_BY_ID[id]) return;
    const S = ORB.store;
    S.profile.unlockAll = true; S.profile.tutorialSeen = true; S.saveProfile();
    S.newRun(id, { difficulty: q.get('diff') || 'engineer' });
    const days = q.get('days');
    if (q.get('screen') === 'launch') { const ev = S.evaluate(); S.run.readinessAtLaunch = { score: ev.readiness.score, go: ev.readiness.go, fails: ev.readiness.fails, warns: ev.readiness.warns }; S.saveRun(); }
    if (days != null) {
      const ev = S.evaluate();
      S.run.readinessAtLaunch = { score: ev.readiness.score, go: ev.readiness.go, fails: ev.readiness.fails, warns: ev.readiness.warns };
      S.run.overrode = !ev.readiness.go;
      S.run.launch = ORB.computeLaunch(ev, S.run.seed, false);
      S.run.launched = true;
      const sim = S.getSim();
      let guard = 0;
      while (!sim.s.outcome && sim.s.t < +days * 24 && guard++ < 400000) { if (sim.s.active) { sim.delegate(); continue; } sim.step(sim.s.phase === 'cruise' ? 12 : sim.s.phase === 'deploy' ? 0.1 : 1); }
      if (sim.s.active) sim.delegate();
      S.saveRun();
    }
    history.replaceState(null, '', location.pathname + (q.get('screen') ? `#/${q.get('screen')}` : days != null ? '#/ops' : '#/briefing'));
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.brand').innerHTML = `${ORB.art.logo(30)}<div><span class="word">ORBITAL</span><span class="sub">Beyond the Mission</span></div>`;
    document.querySelector('.brand').onclick = () => app.go('home');
    U.starfield(document.getElementById('starfield'));
    U.initTooltip();
    const lm = document.getElementById('learn-toggle');
    lm.checked = ORB.store.profile.learning !== false;
    document.body.classList.toggle('learn-on', lm.checked);
    lm.addEventListener('change', () => { ORB.store.profile.learning = lm.checked; ORB.store.saveProfile(); document.body.classList.toggle('learn-on', lm.checked); });
    document.getElementById('lib-btn').onclick = () => app.go('library');
    window.addEventListener('hashchange', () => app.route());
    window.addEventListener('beforeunload', () => ORB.store.saveRun());
    demoLink();
    app.route();
  });
})();
