/* ORBITAL — persistent state (profile + current mission run) */
(function () {
  const ORB = window.ORB;
  const KEY_P = 'orbital.profile.v1', KEY_R = 'orbital.run.v1';
  const read = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: play continues in memory */ } };

  const S = (ORB.store = {
    profile: Object.assign({ unlocked: {}, best: {}, history: [], learning: true, tutorialSeen: false, unlockAll: false, launchFailures: true, difficulty: 'engineer' }, read(KEY_P) || {}),
    run: read(KEY_R),
    sim: null,
    saveProfile() { write(KEY_P, this.profile); },
    saveRun() {
      if (!this.run) { write(KEY_R, null); return; }
      if (this.sim) this.run.simState = this.sim.s;
      write(KEY_R, this.run);
    },
    isUnlocked(m) { return this.profile.unlockAll || m.unlockedByDefault || !!this.profile.unlocked[m.id]; },
    mission() { return this.run ? ORB.MISSION_BY_ID[this.run.missionId] : null; },
    newRun(missionId, { difficulty, sandbox, budget, design } = {}) {
      const m = ORB.MISSION_BY_ID[missionId];
      this.sim = null;
      this.run = {
        missionId, difficulty: difficulty || this.profile.difficulty || 'engineer', sandbox: !!sandbox, budget: sandbox ? budget : null,
        design: design ? ORB.engine.clone(design) : ORB.engine.defaultDesign(m), stage: 'briefing', visited: { briefing: true },
        launched: false, launch: null, simState: null, seed: (Math.random() * 2 ** 31) >>> 0, attempt: 1, startedAt: Date.now(), readinessAtLaunch: null,
      };
      this.saveRun();
      return this.run;
    },
    evaluate() {
      const r = this.run; if (!r) return null;
      return ORB.engine.evaluate(this.mission(), r.design, { difficulty: r.difficulty, budget: r.budget });
    },
    getSim() {
      const r = this.run; if (!r || !r.launched) return null;
      if (!this.sim) {
        this.sim = new ORB.Sim(this.mission(), r.design, { difficulty: r.difficulty, budget: r.budget, seed: r.seed, launch: r.launch }, r.simState || null);
      }
      return this.sim;
    },
    abandon() { this.run = null; this.sim = null; write(KEY_R, null); },
    recordResult(result) {
      const p = this.profile, id = this.run.missionId;
      p.history.unshift({ id, score: result.score, rating: result.rating, date: Date.now(), sandbox: this.run.sandbox });
      p.history = p.history.slice(0, 30);
      if (!this.run.sandbox && (!p.best[id] || result.score > p.best[id].score)) p.best[id] = { score: result.score, rating: result.rating, date: Date.now() };
      // unlock the next mission in the campaign after a Partial Success or better
      const idx = ORB.MISSIONS.findIndex((m) => m.id === id);
      let unlockedNow = [];
      if (result.ratingRank >= 1 && !this.run.sandbox) {
        ORB.MISSIONS.slice(idx + 1, idx + 3).forEach((m) => { if (!p.unlocked[m.id] && !m.unlockedByDefault) { p.unlocked[m.id] = true; unlockedNow.push(m); } });
      }
      this.saveProfile();
      return unlockedNow;
    },
  });
})();
