/* ORBITAL — dynamic mission events & decisions
 * Each event: title, sev, icon, text(), learn (engineering context), options() → [{id,label,detail,score,rec,effect}]
 * Probabilities are set by the simulator from hardware choices and environment (see sim.hazards()).
 */
(function () {
  const ORB = window.ORB;
  const clamp = ORB.phys.clamp;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lowestValueInst = (sim) => {
    const list = sim.instruments().filter(({ st }) => st.on && !st.failed);
    if (!list.length) return null;
    list.sort((a, b) => (a.spec.value * a.st.rel) / a.spec.powerW - (b.spec.value * b.st.rel) / b.spec.powerW);
    return list[0];
  };
  const hungriest = (sim) => {
    const list = sim.instruments().filter(({ st }) => st.on && !st.failed);
    list.sort((a, b) => b.spec.powerW - a.spec.powerW);
    return list[0];
  };

  ORB.EVENTS = {
    power_shortage: {
      sev: 'bad', icon: '⚡', title: () => 'Power shortage',
      text: (sim, d) => {
        const s = sim.s, ev = sim.ev;
        const why = [];
        if (s.arrayHealth < 0.95) why.push(`solar arrays are degraded to ${pct(s.arrayHealth)}`);
        if (s.sunAU > 1.3 && sim.d.solarArea > 0) why.push(`at ${s.sunAU.toFixed(2)} AU sunlight is only ${pct(1 / (s.sunAU * s.sunAU))} of Earth's`);
        if (ev.orbit.ecl > 0.02 && ['science', 'commission'].includes(s.phase)) why.push(`${ev.power.eclMin.toFixed(0)}-minute eclipses each orbit drain the battery`);
        if (s.heater > 20) why.push(`heaters are drawing ${s.heater.toFixed(0)} W`);
        if (s.epPower > 0) why.push(`the electric thruster takes ${s.epPower.toFixed(0)} W`);
        return `Battery charge is ${pct(s.soc / s.battCap)} and falling. Average generation ${d.gen.toFixed(0)} W vs consumption ${d.load.toFixed(0)} W.${why.length ? ' Contributing: ' + why.join('; ') + '.' : ''}`;
      },
      learn: 'Power balance must hold in the worst case: end of life, farthest from the Sun, and in eclipse. When it does not, the battery slowly drains until the spacecraft browns out and enters safe mode.',
      auto: (sim) => {
        if (sim.p.pmad.autoShed || sim.p.computer.autonomy >= 3) { sim.s.powerSaver = true; sim.s.powerSaverUntil = 0; sim.log('Onboard power management automatically shed instrument loads while awaiting instructions.', 'good'); }
      },
      options: (sim, d) => {
        const lo = lowestValueInst(sim);
        const L = sim.loads();
        const structural = d.gen - (d.load - (lo ? lo.spec.powerW : 0)) > 0;
        const out = [];
        if (lo) out.push({ id: 'shed', label: `Turn off ${lo.spec.short} (−${lo.spec.powerW} W)`, detail: 'Permanent fix if the deficit is structural. Loses that instrument\'s science.', score: structural ? 2 : 1, rec: structural,
          effect: (sim) => { const x = lowestValueInst(sim); if (x) x.st.on = false; sim.s.powerSaver = false; return `${x ? x.spec.short : 'Instrument'} powered off.`; } });
        out.push({ id: 'saver', label: 'Power-saving mode for 7 days', detail: 'All instruments off to recharge the battery. Buys time but does not fix a structural deficit.', score: 1, rec: !structural,
          effect: (sim) => { sim.s.powerSaver = true; sim.s.powerSaverUntil = sim.s.t + 7 * 24; return 'Instruments off; battery recharging.'; } });
        out.push({ id: 'trim', label: 'Cut non-essential bus loads (−15 W)', detail: 'Turn off redundant sensors and lower setpoints. Small saving.', score: 0,
          effect: (sim) => { sim.s.nonEssentialOff = true; sim.s.powerSaver = false; return 'Bus load reduced by 15 W.'; } });
        out.push({ id: 'continue', label: 'Continue normal operations', detail: 'Risk: the battery may run flat, causing a brownout, safe mode and battery wear.', score: -2,
          effect: (sim) => { sim.s.powerSaver = false; return 'Operating normally. Watch the battery.'; } });
        return out;
      },
    },

    safe_mode: {
      sev: 'bad', icon: '⛨', title: () => 'Spacecraft in safe mode',
      text: (sim, d) => `${d.reason}. The spacecraft has protected itself: instruments are off, arrays point at the Sun and it is listening on its low-gain antenna (≈${ORB.engine.fmtRate(Math.max(1, sim.s.rateNow))}). It will wait for instructions from Earth.`,
      learn: 'Safe mode is a designed "fail-safe" behaviour. Recovery is slow when light time is long or contact time is scarce — which is why distant missions invest in onboard autonomy.',
      auto: (sim) => {
        if (sim.p.computer.autonomy >= 3) { sim.s.safeUntil = sim.s.t + 6; sim.log('Autonomy suite diagnosed the fault and scheduled recovery in 6 hours without waiting for Earth.', 'good'); }
      },
      options: (sim, d) => {
        const out = [];
        const power = /battery|brownout|loads exceed/i.test(d.reason || '');
        if (sim.p.computer.autonomy >= 3) out.push({ id: 'ack', label: 'Acknowledge autonomous recovery', detail: 'The onboard autonomy suite is already handling it.', score: 1, rec: true, effect: () => 'Ground team concurs with onboard recovery.' });
        if (power) out.push({ id: 'recover_shed', label: 'Recover with reduced payload', detail: 'Exit safe mode with the most power-hungry instrument switched off, so the deficit does not recur.', score: 2, rec: sim.p.computer.autonomy < 3,
          effect: (sim) => { const h = hungriest(sim); if (h) h.st.on = false; sim.s.safe = false; sim.s.powerSaver = false; return `Recovered; ${h ? h.spec.short : 'instrument'} left off.`; } });
        out.push({ id: 'careful', label: 'Full diagnostics, then recover (≈2 days)', detail: 'Slow but safe: engineers verify the root cause before resuming.', score: power ? 0 : 1, rec: !power && sim.p.computer.autonomy < 3,
          effect: (sim) => { sim.s.safeUntil = sim.s.t + 48; return 'Diagnostics under way; science resumes in ~2 days.'; } });
        out.push({ id: 'fast', label: 'Quick restart now', detail: 'Resume immediately. If the root cause is still present it may happen again.', score: -1,
          effect: (sim) => { sim.s.safe = false; sim.s.powerSaver = false; if (sim.rand() < 0.3) sim.s.cooldownUntil = sim.s.t; return 'Operations resumed without root-cause analysis.'; } });
        return out;
      },
    },

    inst_fault: {
      sev: 'warn', icon: '⚠', title: (sim, d) => `${ORB.INSTRUMENT_BY_ID[d.id].short} malfunction`,
      prepare: (sim, d) => { const st = sim.s.inst[d.id]; if (!st || st.failed) return false; st.on = false; d.wasOn = true; },
      text: (sim, d) => {
        const sp = ORB.INSTRUMENT_BY_ID[d.id], s = sim.s;
        const causes = [];
        if (s.dose > sim.p.computer.tidKrad * 0.4) causes.push(`accumulated radiation dose (${s.dose.toFixed(0)} krad)`);
        if (s.temp > sim.ev.thermal.tMax) causes.push(`high internal temperature (${(s.temp - 273.15).toFixed(0)} °C)`);
        return `${sp.name} stopped responding and was powered off by fault protection.${causes.length ? ' Likely contributors: ' + causes.join(', ') + '.' : ' Cause unknown — every component has a finite failure rate.'}`;
      },
      learn: 'Instrument reliability falls with radiation dose and thermal stress. Good thermal design and shielding reduce how often this happens.',
      options: (sim, d) => {
        const autonomy = sim.p.computer.autonomy;
        const sp = ORB.INSTRUMENT_BY_ID[d.id];
        return [
          { id: 'cycle', label: 'Power-cycle and reset', detail: '~55% chance of full recovery; otherwise it comes back degraded.', score: 0,
            effect: (sim) => { const st = sim.s.inst[d.id]; st.on = true; if (sim.rand() < 0.55) { st.health = 1; return 'Instrument recovered fully.'; } st.health = 0.5; return 'Instrument back online in degraded mode.'; } },
          { id: 'patch', label: 'Upload a software workaround (+$2 M)', detail: `Engineers write a patch. Success ≈ ${autonomy >= 2 ? '85' : '60'}% (depends on computer capability).`, score: 1, rec: true,
            effect: (sim) => { sim.s.extraCost += 2; const st = sim.s.inst[d.id]; st.on = true; if (sim.rand() < (autonomy >= 2 ? 0.85 : 0.6)) { st.health = 1; return 'Patch worked — full performance.'; } st.health = 0.5; return 'Patch partly worked — degraded performance.'; } },
          { id: 'degraded', label: 'Operate in degraded mode', detail: 'Safe choice: half-quality data, no further risk.', score: 0,
            effect: (sim) => { const st = sim.s.inst[d.id]; st.on = true; st.health = 0.5; return 'Operating at reduced capability.'; } },
          { id: 'off', label: `Switch ${sp.short} off permanently`, detail: `Saves ${sp.powerW} W. All future science from it is lost.`, score: -1,
            effect: (sim) => { const st = sim.s.inst[d.id]; st.on = false; st.failed = true; return 'Instrument retired.'; } },
        ];
      },
    },

    array_degrade: {
      sev: 'warn', icon: '☀', title: () => 'Solar array output dropped',
      prepare: (sim, d) => { d.loss = clamp(0.05 + sim.rand() * 0.12 * (sim.m.id === 'jupiter' ? 1.3 : 1), 0.04, 0.2); sim.s.arrayHealth *= 1 - d.loss; },
      text: (sim, d) => `Array output fell by ${pct(d.loss)} (now ${pct(sim.s.arrayHealth)} of nominal) — consistent with ${sim.m.id === 'jupiter' ? 'radiation damage to the cells' : sim.ev.orbit.env && sim.ev.orbit.env.mm > 0.02 ? 'micrometeoroid/debris strikes or a failed cell string' : 'a failed cell string'}. Current generation ${sim.s.gen.toFixed(0)} W vs load ${sim.s.load.toFixed(0)} W.`,
      learn: 'Arrays degrade from radiation, impacts and thermal cycling, which is why designers size them for END-of-life power, not beginning-of-life.',
      options: (sim, d) => [
        { id: 'reopt', label: 'Reconfigure strings & re-optimise pointing', detail: sim.p.pmad.id === 'det' ? 'A fixed-voltage (DET) system can recover little.' : 'Peak-power tracking can recover a good share of the loss.', score: 1, rec: true,
          effect: (sim) => { const rec = d.loss * (sim.p.pmad.id === 'det' ? 0.15 : 0.45); sim.s.arrayHealth = Math.min(1, sim.s.arrayHealth / (1 - rec)); return `Recovered about ${pct(rec)} of output.`; } },
        { id: 'shed', label: 'Accept loss and switch off the least valuable instrument', detail: 'Protects the power margin at the cost of some science.', score: 0,
          effect: (sim) => { const x = lowestValueInst(sim); if (x) x.st.on = false; return `${x ? x.spec.short : 'Nothing'} switched off.`; } },
        { id: 'accept', label: 'Accept the loss', detail: 'Fine if your power margin can absorb it.', score: sim.ev.power.margin > 0.25 ? 1 : -1,
          effect: () => 'No action taken.' },
      ],
    },

    spe: {
      sev: 'warn', icon: '☄', title: () => 'Solar particle event',
      text: (sim) => `A solar flare has launched a storm of energetic protons. Radiation monitors show particle flux up by orders of magnitude. Your electronics are behind ${sim.ev.radiation.shieldMm.toFixed(1)} mm Al-equivalent shielding.`,
      learn: 'Solar particle events can deliver a large radiation dose in hours. Shielding mass and radiation-hardened parts are the engineering defence; operational defence is to safe sensitive instruments.',
      options: (sim) => {
        const has = ['particle', 'rad'].filter((id) => sim.s.inst[id] && !sim.s.inst[id].failed);
        const spike = 3 * sim.ev.radiation.factor;
        const out = [];
        if (has.length && ['science', 'cruise', 'downlink'].includes(sim.s.phase)) out.push({ id: 'study', label: 'Study the storm; safe all other instruments', detail: 'Rare opportunity for your particle/radiation instruments. Other instruments are protected.', score: 2, rec: true,
          effect: (sim) => { sim.s.dose += spike * 0.5; has.forEach((id) => { const st = sim.s.inst[id]; const sp = ORB.INSTRUMENT_BY_ID[id]; st.returnedQ += sp.rate * 8 * st.q; st.returned += sp.rate * 8; }); sim.s.discoveries.push({ t: sim.s.t, obj: 'Space weather', title: 'Solar storm captured in detail', text: 'Your particle instruments recorded the full arrival and decay of a solar energetic particle event (simulated).', tier: 1 }); sim.s.powerSaver = false; return 'Storm data captured.'; } });
        out.push({ id: 'safe', label: 'Safe the instruments for 3 days', detail: 'No damage risk; loses three days of observations.', score: 1, rec: !out.length,
          effect: (sim) => { sim.s.dose += spike * 0.4; sim.s.powerSaver = true; sim.s.powerSaverUntil = sim.s.t + 72; return 'Instruments safed until the storm passes.'; } });
        out.push({ id: 'observe', label: 'Keep observing', detail: `Risk of instrument damage depends on shielding (≈${pct(clamp(0.6 * sim.ev.radiation.factor, 0.05, 0.6))} here).`, score: -1,
          effect: (sim) => { sim.s.dose += spike; if (sim.rand() < clamp(0.6 * sim.ev.radiation.factor, 0.05, 0.6)) { const list = sim.instruments().filter(({ st }) => st.on && !st.failed); if (list.length) { const x = list[Math.floor(sim.rand() * list.length)]; x.st.health = 0.5; return `${x.spec.short} damaged by radiation (degraded).`; } } return 'Instruments came through unharmed.'; } });
        return out;
      },
    },

    comp_upset: {
      sev: 'warn', icon: '⌬', title: () => 'Flight computer upset',
      prepare: (sim) => {
        const s = sim.s, c = sim.p.computer;
        if (s.dose > c.tidKrad * 1.1 && sim.rand() < 0.35) {
          if (c.id === 'redundant' && !s.flags.backupUsed) { s.flags.backupUsed = true; sim.log('Primary computer failed from radiation damage — switched to the backup string. No redundancy remains.', 'bad'); return false; }
          sim.finish('lost', `Radiation dose (${s.dose.toFixed(0)} krad) exceeded the ${c.tidKrad} krad tolerance of the flight computer, which failed permanently.`);
          return false;
        }
        if (c.autonomy >= 3) { sim.log('Single-event upset: autonomy suite switched processors; 30-minute outage, no ground action needed.', 'warn'); return false; }
        sim.triggerSafe('Flight computer reset after a single-event upset (radiation bit-flip)');
        return false;
      },
      title2: '', options: null,
    },

    wheel_fault: {
      sev: 'warn', icon: '◎', title: () => 'Reaction wheel friction',
      prepare: (sim) => { sim.s.wheels -= 1; },
      text: (sim) => `Reaction wheel ${sim.p.acs.wheels - sim.s.wheels} shows rising bearing friction and has been stopped. ${sim.s.wheels >= 3 ? 'A spare wheel is available.' : 'Only two wheels remain — not enough for full three-axis control.'}`,
      learn: 'Reaction wheels are mechanical and wear out; several real missions have lost wheels. Carrying a spare (4 wheels) or hybrid thruster control are the classic mitigations.',
      options: (sim) => {
        const out = [];
        if (sim.s.wheels >= 3) out.push({ id: 'spare', label: 'Switch to the spare wheel', detail: 'Full pointing performance retained.', score: 1, rec: true, effect: () => 'Spare wheel in control; pointing nominal.' });
        else {
          out.push({ id: 'hybrid', label: 'Hybrid control: 2 wheels + thrusters', detail: 'Pointing ≈0.15°, uses ~0.03 kg propellant per day.', score: 1, rec: true, effect: (sim) => { sim.s.acsMode = 'hybrid'; return 'Hybrid control active.'; } });
          out.push({ id: 'thrusters', label: 'Thruster-only control', detail: 'Coarse pointing ≈0.5°, ~0.1 kg propellant per day.', score: 0, effect: (sim) => { sim.s.acsMode = 'thrusters'; return 'Thruster control active.'; } });
          out.push({ id: 'rest', label: 'Rest the wheel and retry in a week', detail: '50% chance it recovers; meanwhile thrusters hold attitude.', score: 0,
            effect: (sim) => { if (sim.rand() < 0.5) { sim.s.wheels += 1; return 'Wheel friction subsided — back in service.'; } sim.s.acsMode = 'hybrid'; return 'Wheel did not recover; hybrid control adopted.'; } });
        }
        return out;
      },
    },

    battery_fade: {
      sev: 'warn', icon: '▮', title: () => 'Battery capacity fading',
      prepare: (sim) => { sim.s.battCap *= 0.88; sim.s.soc = Math.min(sim.s.soc, sim.s.battCap); },
      text: (sim) => `Repeated deep discharges (${pct(sim.s.eclDod)} per eclipse vs ${pct(sim.ev.power.dodMax)} recommended) have reduced battery capacity to ${sim.s.battCap.toFixed(0)} Wh.`,
      learn: 'Battery life depends strongly on depth of discharge: shallow cycles can last tens of thousands of times; deep ones only hundreds to a few thousand.',
      options: () => [
        { id: 'eclipse', label: 'Turn instruments off during eclipses', detail: 'Cuts eclipse load and depth of discharge; lose the eclipse share of observations.', score: 1, rec: true, effect: (sim) => { sim.s.flags.eclipseInstOff = true; return 'Eclipse load reduced.'; } },
        { id: 'accept', label: 'Accept reduced capacity', detail: 'Fading will continue.', score: -1, effect: () => 'No change.' },
      ],
    },

    micrometeoroid: {
      sev: 'warn', icon: '✸', title: () => 'Micrometeoroid impact detected',
      prepare: (sim, d) => { const r = sim.rand(); d.kind = r < 0.45 && sim.s.arraysDeployed && sim.d.solarArea > 0 ? 'array' : r < 0.75 ? 'tank' : 'blanket'; if (d.kind === 'array') sim.s.arrayHealth *= 0.95; },
      text: (sim, d) => ({ array: 'An impact cracked a solar cell string (−5% array output).', tank: 'Accelerometers recorded an impact near the propellant tank; pressure is dropping slowly.', blanket: 'An impact punctured an insulation blanket. Minor thermal effect.' }[d.kind]) + ` Your ${sim.p.structure.name.toLowerCase()} structure determines how well the spacecraft is protected.`,
      learn: 'Tiny particles travelling at tens of km/s can damage spacecraft. Shielding (e.g., stuffed Whipple shields) and robust structures reduce the risk.',
      options: (sim, d) => [
        { id: 'diag', label: 'Run full diagnostics (2 days in safe configuration)', detail: d.kind === 'tank' ? 'Isolates the leaking tank section.' : 'Confirms no further damage.', score: 1, rec: true,
          effect: (sim) => { sim.s.powerSaver = true; sim.s.powerSaverUntil = sim.s.t + 48; if (d.kind === 'tank') sim.s.prop *= 0.98; return 'Diagnostics complete; damage contained.'; } },
        { id: 'continue', label: 'Continue operations', detail: d.kind === 'tank' ? 'Risk: the leak continues (lose ~8% of propellant).' : 'Probably fine.', score: d.kind === 'tank' ? -2 : 0,
          effect: (sim) => { if (d.kind === 'tank') sim.s.prop *= 0.92; return d.kind === 'tank' ? 'Leak continued before self-sealing.' : 'Continuing.'; } },
      ],
    },

    debris: {
      sev: 'warn', icon: '⨯', title: () => 'Debris conjunction warning',
      text: () => 'Space-surveillance tracking predicts a piece of debris will pass within 180 m in 26 hours. Estimated collision probability: 1 in 3,000.',
      learn: 'Thousands of tracked objects orbit Earth. Operators routinely perform small collision-avoidance maneuvers when the probability exceeds ~1 in 10,000.',
      options: () => [
        { id: 'avoid', label: 'Perform avoidance maneuver (0.4 m/s)', detail: 'Uses a little propellant; the standard response.', score: 1, rec: true, effect: (sim) => { sim.burn(0.0004); return 'Maneuver complete; miss distance now >2 km.'; } },
        { id: 'accept', label: 'Accept the risk', detail: '1-in-3,000 chance of a catastrophic collision.', score: -2,
          effect: (sim) => { if (sim.rand() < 1 / 3000) { sim.finish('lost', 'Collision with orbital debris destroyed the spacecraft.'); return 'Collision.'; } return 'The debris passed by.'; } },
      ],
    },

    aero_heat: {
      sev: 'warn', icon: '♨', title: () => 'Aerobraking heating spike',
      text: () => 'The upper atmosphere was denser than predicted on the last pass (dust storm activity). Solar array temperatures peaked near their limit.',
      learn: 'Aerobraking trades propellant for time and risk: each pass must be deep enough to slow the craft but shallow enough not to overheat it.',
      options: (sim) => [
        { id: 'raise', label: 'Raise periapsis slightly (+10 days)', detail: 'Safer corridor; aerobraking takes longer.', score: 1, rec: true, effect: (sim) => { sim.burn(0.003); sim.s.aeroEnd += 10 * 24; return 'Periapsis raised 5 km.'; } },
        { id: 'continue', label: 'Continue at current depth', detail: `Risk of array damage depends on structure (${sim.p.structure.name}).`, score: -1,
          effect: (sim) => { const p = { reinforced: 0.1, al: 0.25, cfrp: 0.4 }[sim.p.structure.id]; if (sim.rand() < p) { sim.s.arrayHealth *= 0.85; return 'Array overheated: −15% output.'; } return 'Next passes nominal.'; } },
      ],
    },

    tcm: {
      sev: 'info', icon: '➹', title: (sim, d) => `Trajectory correction ${d.n}`,
      text: (sim, d) => `Navigation tracking shows the spacecraft will miss the aim point${d.last ? ' at arrival' : ''}. A correction of ${(d.dv * 1000).toFixed(1)} m/s is required. Your ${sim.p.acs.name.toLowerCase()} sets how accurately past burns were executed.`,
      learn: 'Trajectory errors grow with time, so a small correction now replaces a large one later. This is why missions schedule several trajectory correction maneuvers (TCMs).',
      options: (sim, d) => [
        { id: 'now', label: `Execute now (${(d.dv * 1000).toFixed(1)} m/s)`, detail: 'Cheapest overall.', score: 1, rec: true,
          effect: (sim) => { const f = sim.burn(d.dv, 'TCM'); sim.s.tcmPenalty = Math.max(0, sim.s.tcmPenalty - 0.3); return f < 1 ? 'Burn incomplete — propellant exhausted.' : `Burn complete. ${sim.s.prop.toFixed(0)} kg propellant left.`; } },
        { id: 'refine', label: 'Extra tracking passes first (+$1.5 M)', detail: 'Better orbit knowledge shrinks the burn to ~70%.', score: 1,
          effect: (sim) => { sim.s.extraCost += 1.5; sim.burn(d.dv * 0.7, 'TCM'); sim.s.tcmPenalty = Math.max(0, sim.s.tcmPenalty - 0.3); return 'Refined burn complete.'; } },
        { id: 'skip', label: 'Skip this correction', detail: d.last ? 'Arrive off-target: larger insertion burn and worse navigation.' : 'The error grows: the next correction will be much larger.', score: -1,
          effect: (sim) => { sim.s.tcmPenalty += 0.7; sim.s.navError = 1 + sim.s.tcmPenalty; return 'Correction deferred.'; } },
      ],
    },

    insertion: {
      sev: 'info', icon: '◍', instant: true, title: (sim, d) => (d.ok ? 'Orbit insertion successful' : d.partial ? 'Orbit insertion incomplete' : 'Orbit insertion failed'),
      text: (sim, d) => d.ok
        ? `The engine fired for the ${(d.dv * 1000).toFixed(0)} m/s ${sim.m.id === 'asteroid' ? 'rendezvous' : 'insertion'} burn. ${d.note ? d.note + ' ' : ''}Propellant remaining: ${sim.s.prop.toFixed(0)} kg. The spacecraft is now in orbit — ${sim.ev.orbit.label}.`
        : d.partial ? `Propellant ran out after ${pct(d.f)} of the ${(d.dv * 1000).toFixed(0)} m/s burn. The spacecraft is captured but in a higher, eccentric orbit: data quality will be reduced.`
          : `Propellant ran out after only ${pct(d.f)} of the ${(d.dv * 1000).toFixed(0)} m/s burn. The spacecraft could not be captured and will fly past the target — only a brief flyby of science is possible.`,
      learn: 'Orbit insertion is a single-chance event: it must happen at the right moment with enough Δv. This is why Δv margin matters.',
      options: (sim, d) => [{ id: 'ok', label: d.ok ? 'Begin science operations' : 'Make the best of it', score: 0, rec: true, effect: () => '' }],
    },

    hibernation: {
      sev: 'info', icon: '☾', instant: true, title: () => 'Cruise strategy',
      text: (sim) => `The cruise to Halcyon will take about ${(sim.ev.time.cruiseD / 365.25).toFixed(1)} years. Do you keep the spacecraft fully active, or let it hibernate to save operations cost?`,
      learn: 'Long-cruise spacecraft (like New Horizons) hibernate for most of the cruise, with a beacon tone reporting health. It saves operations money but means problems are noticed later.',
      options: (sim) => {
        const tof = sim.ev.time.cruiseD;
        return [
          { id: 'mixed', label: `Hibernate, wake yearly for field measurements (+$${(0.0025 * tof).toFixed(0)} M)`, detail: 'Partial cruise science at moderate cost.', score: 1, rec: true,
            effect: (sim) => { sim.s.hibernate = false; sim.s.cruiseScience = true; sim.s.cruiseDuty = 0.4; sim.s.extraCost += 0.0025 * tof; return 'Hibernation with annual checkouts.'; } },
          { id: 'active', label: `Active cruise with continuous heliosphere science (+$${(0.008 * tof).toFixed(0)} M)`, detail: 'Maximum cruise science, highest cost.', score: 0,
            effect: (sim) => { sim.s.hibernate = false; sim.s.cruiseScience = true; sim.s.cruiseDuty = 1; sim.s.extraCost += 0.008 * tof; return 'Active cruise.'; } },
          { id: 'hib', label: 'Deep hibernation (no extra cost)', detail: 'No cruise science.', score: 0,
            effect: (sim) => { sim.s.hibernate = true; sim.s.cruiseScience = false; return 'Hibernating.'; } },
        ];
      },
    },

    jupiter_flyby: {
      sev: 'good', icon: '♃', title: () => 'Jupiter gravity assist',
      auto: (sim) => { const dose = (15000 / Math.pow(sim.d.trajectory.rpRJ || 32, 2)) * sim.ev.radiation.factor; sim.s.dose += dose; sim.s.flags.jDose = dose; },
      text: (sim, d) => `The spacecraft swung past Jupiter at ${sim.d.trajectory.rpRJ} Jupiter radii and gained ${d.gain.toFixed(2)} km/s of heliocentric speed — for free. The passage through the magnetosphere added ${sim.s.flags.jDose.toFixed(1)} krad of radiation dose.`,
      learn: 'A gravity assist exchanges momentum with a planet. Closer flybys bend the path more (more speed gained) but pass through stronger radiation.',
      options: () => [
        { id: 'observe', label: 'Run a Jupiter observation campaign', detail: 'Calibrates instruments on a bright target and rehearses the encounter sequence.', score: 1, rec: true,
          effect: (sim) => { sim.s.navError = Math.max(0.7, sim.s.navError - 0.15); sim.s.discoveries.push({ t: sim.s.t, obj: 'Jupiter flyby', title: 'Jupiter imaged during gravity assist', text: 'Calibration images and spectra of Jupiter validated the instrument pipeline (simulated).', tier: 0 }); return 'Instruments calibrated; encounter sequence rehearsed.'; } },
        { id: 'quiet', label: 'Stay quiet and conserve resources', detail: 'No rehearsal.', score: 0, effect: () => 'Quiet flyby.' },
      ],
    },

    encounter: {
      sev: 'good', icon: '✦', instant: true, title: () => 'Closest approach to Halcyon',
      auto: (sim) => { if (sim.p.computer.autonomy < 2 && sim.rand() < 0.35) { sim.s.encLoss = 0.5; sim.log('A processor reset during closest approach interrupted the observation sequence — part of the encounter was missed.', 'bad'); } },
      text: (sim) => `With a one-way light time of ${(sim.s.owlt / 3600).toFixed(1)} hours, Earth cannot intervene: the spacecraft is executing a pre-loaded sequence, pointing every instrument at a target moving past at ~${sim.ev.traj.vinfArr.toFixed(1)} km/s. All data is being recorded to the ${sim.p.storage.gbit} Gbit recorder.${sim.s.encLoss ? ' Part of the sequence was lost to a computer reset.' : ''} Navigation accuracy factor: ${sim.s.navError.toFixed(2)}.`,
      learn: 'Deep-space flybys are fully autonomous. Robust flight software, accurate navigation and enough onboard storage decide whether the one-shot encounter succeeds.',
      options: () => [{ id: 'ok', label: 'Await the first images', score: 0, rec: true, effect: () => '' }],
    },

    conjunction: {
      sev: 'info', icon: '☉', title: () => 'Solar conjunction',
      text: () => 'The Sun is moving between Earth and the spacecraft. For about two weeks, solar plasma will corrupt radio signals — no reliable commanding or downlink.',
      learn: 'Conjunctions are predictable: missions pre-load command sequences and store data on board until the link returns.',
      options: (sim) => {
        const auto = sim.p.computer.autonomy >= 2;
        return [
          { id: 'sequence', label: 'Pre-load an autonomous 2-week sequence', detail: auto ? 'Science continues; data is stored for later downlink.' : 'Your computer lacks the autonomy for long unattended sequences — risky.', score: auto ? 2 : -1, rec: auto,
            effect: (sim) => { if (!auto && sim.rand() < 0.5) { sim.triggerSafe('Sequence fault during conjunction'); return 'Sequence faulted.'; } return 'Sequence running.'; } },
          { id: 'pause', label: 'Pause science until the link returns', detail: 'No risk; two weeks of lost observations.', score: 0, rec: !auto,
            effect: (sim) => { sim.s.powerSaver = true; sim.s.powerSaverUntil = sim.s.t + 14 * 24; return 'Instruments idle through conjunction.'; } },
        ];
      },
    },

    discovery: {
      sev: 'science', icon: '✧', title: () => 'Unexpected scientific signal',
      prepare: (sim, d) => {
        const act = sim.instruments().filter(({ id, st }) => sim.instActive(st, id) && st.rel >= 0.5);
        if (!act.length) return false;
        const x = act[Math.floor(sim.rand() * act.length)];
        d.id = x.id;
        const lib = ORB.SURPRISES[sim.m.id] || [];
        d.k = Math.floor(sim.rand() * lib.length);
        if (sim.s.flags['sur' + d.k]) return false;
        sim.s.flags['sur' + d.k] = true;
      },
      text: (sim, d) => { const sur = (ORB.SURPRISES[sim.m.id] || [])[d.k] || ['Anomalous signal', 'An unexpected feature appeared in the data.']; return `${ORB.INSTRUMENT_BY_ID[d.id].name} data shows: ${sur[1]} (simulated finding). A targeted follow-up campaign could confirm it.`; },
      learn: 'Many important discoveries were unplanned. Missions that keep flexible operations (spare power, data volume and budget) can react to them.',
      options: (sim, d) => [
        { id: 'follow', label: 'Dedicated follow-up campaign (+$1.5 M)', detail: 'Extra ground time and targeted observations.', score: 1, rec: true,
          effect: (sim) => { const st = sim.s.inst[d.id]; const sp = ORB.INSTRUMENT_BY_ID[d.id]; sim.s.extraCost += 1.5; st.returnedQ += sp.rate * 12 * st.q; st.returned += sp.rate * 12; const sur = ORB.SURPRISES[sim.m.id][d.k]; sim.s.discoveries.push({ t: sim.s.t, obj: 'Follow-up', title: sur[0], text: sur[1] + ' Confirmed by follow-up observations (simulated).', tier: 2 }); return 'Follow-up confirmed the finding!'; } },
        { id: 'log', label: 'Log it and continue the planned survey', detail: 'No extra cost; the finding stays tentative.', score: 0,
          effect: (sim) => { const sur = ORB.SURPRISES[sim.m.id][d.k]; sim.s.discoveries.push({ t: sim.s.t, obj: 'Tentative', title: sur[0] + ' (tentative)', text: sur[1] + ' Not yet confirmed (simulated).', tier: 0 }); return 'Logged for later analysis.'; } },
      ],
    },

    array_deploy: {
      sev: 'bad', icon: '⚑', title: () => 'Solar array deployment anomaly',
      text: (sim) => `One array wing did not latch. The spacecraft is generating only ${pct(sim.s.arrayHealth)} of expected power. Your ${sim.p.solar.name.toLowerCase()} uses a deployment mechanism with ${pct(sim.p.solar.deployRel)} reliability.`,
      learn: 'Deployables (arrays, antennas, booms) are among the riskiest moments of a mission. Simpler mechanisms and testing reduce the risk.',
      options: () => [
        { id: 'thermal', label: 'Warm the hinge in sunlight, then retry (3 days)', detail: 'Thermal expansion often frees a sticky latch. ~80% success.', score: 1, rec: true,
          effect: (sim) => { if (sim.rand() < 0.8) { sim.s.arrayHealth = 1; return 'Latch confirmed — full power!'; } return 'Still not latched.'; } },
        { id: 'redrive', label: 'Fire the backup deployment motor now', detail: '~65% success; small risk of jamming it further.', score: 0,
          effect: (sim) => { const r = sim.rand(); if (r < 0.65) { sim.s.arrayHealth = 1; return 'Wing deployed!'; } if (r > 0.9) { sim.s.arrayHealth = 0.45; return 'Wing jammed further.'; } return 'No change.'; } },
        { id: 'accept', label: 'Accept reduced power; switch off an instrument', detail: 'No risk, permanent loss.', score: 0,
          effect: (sim) => { const x = lowestValueInst(sim); if (x) x.st.on = false; return 'Operating with reduced power.'; } },
      ],
    },

    thermal_hot: {
      sev: 'warn', icon: '▲', title: () => 'Spacecraft overheating',
      text: (sim) => `Internal temperature ${(sim.s.temp - 273.15).toFixed(0)} °C exceeds the ${(sim.ev.thermal.tMax - 273.15).toFixed(0)} °C limit. The ${sim.d.radiatorArea.toFixed(1)} m² radiator cannot reject ${sim.s.load.toFixed(0)} W of electrical heat plus the environment's heating at ${sim.s.sunAU.toFixed(2)} AU.`,
      learn: 'Radiators reject heat in proportion to T⁴ and their area. Electronics fail faster when hot; infrared detectors become noisy.',
      options: () => [
        { id: 'instoff', label: 'Switch off the hungriest instrument', detail: 'Less dissipation inside the spacecraft.', score: 1, rec: true, effect: (sim) => { const h = hungriest(sim); if (h) h.st.on = false; return `${h ? h.spec.short : 'Nothing'} switched off.`; } },
        { id: 'saver', label: 'Power-saving mode for 5 days', detail: 'Temporary relief.', score: 0, effect: (sim) => { sim.s.powerSaver = true; sim.s.powerSaverUntil = sim.s.t + 120; return 'Reduced dissipation.'; } },
        { id: 'continue', label: 'Continue and monitor', detail: 'Hot electronics fail more often.', score: -1, effect: () => 'Continuing.' },
      ],
    },

    thermal_cold: {
      sev: 'warn', icon: '▼', title: () => 'Spacecraft too cold',
      text: (sim) => `Internal temperature has dropped to ${(sim.s.temp - 273.15).toFixed(0)} °C. Batteries and propellant lines are at risk${sim.s.heatersOn ? '; heaters are already at maximum' : ' because heaters were turned down'}.`,
      learn: 'Far from the Sun or in long eclipses, spacecraft need heater power or better insulation. Hydrazine freezes at about +2 °C.',
      options: (sim) => [
        { id: 'heaters', label: 'Restore full heater power', detail: 'Costs electrical power.', score: 1, rec: true, effect: (sim) => { sim.s.heatersOn = true; sim.s.nonEssentialOff = false; return 'Heaters at full setpoint.'; } },
        { id: 'accept', label: 'Accept the cold', detail: 'Battery capacity will be permanently reduced.', score: -1, effect: (sim) => { sim.s.battCap *= 0.9; return 'Battery cold-soaked: −10% capacity.'; } },
      ],
    },
  };

  /* ---------------------------------------------------------- simulated science discoveries per objective (3 tiers) */
  ORB.DISCOVERIES = {
    eo: {
      land: [['First global vegetation map', 'A cloud-free composite of vegetation health across all continents (simulated).'], ['Drought stress detected early', 'Infrared signatures of crop stress appeared weeks before visible browning (simulated).'], ['Seasonal land-change atlas complete', 'A full year of land-cover change, including fire scars and deforestation (simulated).']],
      atm: [['Atmospheric profiles flowing', 'Temperature and humidity profiles now feed forecast models (simulated).'], ['Pollution plume tracked across an ocean', 'Aerosols from wildfires traced for 8,000 km (simulated).'], ['Full-year climate record', 'Ozone, water vapour and aerosol climatology complete (simulated).']],
      ocean: [['First all-weather ocean images', 'Radar imaged sea ice through polar-night cloud (simulated).'], ['Sea-ice retreat measured', 'Weekly maps show the seasonal ice edge in detail (simulated).'], ['Ocean & ice dataset complete', 'A year of all-weather maps of ice and ocean surface (simulated).']],
    },
    moon: {
      geo: [['Global mosaic begun', 'First high-resolution strips across the lunar highlands (simulated).'], ['Polar topography mapped', 'Laser altimetry reveals crater floors that never see sunlight (simulated).'], ['Complete geology & topography atlas', 'A global, high-resolution shape and image map of the Moon (simulated).']],
      vol: [['Hydrogen excess near the south pole', 'Neutron counts dip over cold, shadowed craters (simulated).'], ['Ice signatures in shadowed craters', 'Infrared spectra consistent with surface frost (simulated).'], ['Polar volatile inventory', 'A map of likely ice deposits for future landing sites (simulated).']],
      rad: [['Dose environment characterised', 'Galactic cosmic-ray dose measured in lunar orbit (simulated).'], ['Solar storm dose recorded', 'Peak dose rates measured for crew safety planning (simulated).'], ['Radiation model complete', 'A long-term dose record for future astronauts (simulated).']],
    },
    mars: {
      min: [['Clay minerals in an ancient delta', 'Spectra show water-altered minerals in layered sediments (simulated).'], ['Sulfate-rich layers mapped', 'A sequence of wet-to-dry deposits recorded in canyon walls (simulated).'], ['Global mineral map', 'A planet-wide map of where water altered Martian rock (simulated).']],
      atm: [['Dust storm tracked', 'Daily maps follow a regional dust storm (simulated).'], ['Seasonal CO₂ cycle measured', 'Polar caps grow and shrink as CO₂ freezes and sublimates (simulated).'], ['A Mars year of climate data', 'Complete record of temperature, dust and water vapour (simulated).']],
      ice: [['Buried ice detected', 'Radar reflections indicate ice under mid-latitude debris (simulated).'], ['Hydrogen-rich ground mapped', 'Gamma/neutron data show shallow ice toward the poles (simulated).'], ['Subsurface ice atlas', 'Candidate water resources mapped for future explorers (simulated).']],
      mag: [['Magnetized crust detected', 'Strong remnant fields over the ancient southern highlands (simulated).'], ['Atmospheric escape measured', 'Ion loss rate rises during solar storms (simulated).'], ['Crustal field map complete', 'Global map of Mars\' ancient magnetism (simulated).']],
    },
    asteroid: {
      shape: [['First resolved images of Tessera', 'A rubble-pile body with boulders larger than a house (simulated).'], ['Shape model built', 'Laser and stereo data give a 3-D model to ~1 m (simulated).'], ['Global topographic map', 'Every boulder over 1 m catalogued (simulated).']],
      comp: [['Hydrated minerals detected', 'Infrared spectra show water-bearing clays (simulated).'], ['Organic-rich regions found', 'Carbon-bearing material concentrated in fresh craters (simulated).'], ['Composition map complete', 'Surface chemistry mapped globally (simulated).']],
      mass: [['Asteroid weighed', 'Doppler tracking yields Tessera\'s mass (simulated).'], ['Low density measured', 'Bulk density implies ~40% porosity — a loose rubble pile (simulated).'], ['Gravity field mapped', 'Internal mass distribution resolved (simulated).']],
    },
    jupiter: {
      mag: [['Magnetic field mapped on first passes', 'Field lines traced into the auroral zones (simulated).'], ['Auroral particles identified', 'Electrons accelerated to high energies above the poles (simulated).'], ['Magnetosphere model complete', 'A high-order map of the field and its dynamo (simulated).']],
      atm: [['Deep atmosphere sounded', 'Water and ammonia abundances below the clouds (simulated).'], ['Polar cyclones observed', 'Clusters of large storms around each pole (simulated).'], ['Atmospheric composition record', 'Composition from cloud tops to depth (simulated).']],
      rad: [['Belt intensity measured', 'Peak electron flux recorded at perijove (simulated).'], ['Belt structure resolved', 'Inner belts mapped pass by pass (simulated).'], ['Radiation environment model', 'Data for designing future Jupiter missions (simulated).']],
      int: [['Gravity harmonics measured', 'Doppler tracking reveals Jupiter\'s rotation-driven bulge (simulated).'], ['Dilute core inferred', 'Heavy elements spread through a large core region (simulated).'], ['Interior model constrained', 'Gravity data constrain core size and deep winds (simulated).']],
    },
    kbo: {
      img: [['First images of Halcyon', 'A reddish, two-lobed body emerges (simulated).'], ['Surface geology revealed', 'Smooth plains, pits and a few craters (simulated).'], ['Global map of Halcyon', 'The best images ever of a body this far out (simulated).']],
      comp: [['Methane ice detected', 'Spectral bands of frozen methane (simulated).'], ['Organic compounds found', 'Red colour from irradiated organics (simulated).'], ['Composition map', 'Ices mapped across the surface (simulated).']],
      helio: [['Solar wind slowing measured', 'Speed falls gradually with distance (simulated).'], ['Pickup ions detected', 'Interstellar atoms ionized and swept up by the solar wind (simulated).'], ['Outer heliosphere survey complete', 'Particle record from 1 to 44 AU (simulated).']],
    },
  };
  ORB.SURPRISES = {
    eo: [['Unreported methane plume', 'a concentrated methane plume over an industrial site.'], ['Glacier surge', 'a mountain glacier advancing rapidly.'], ['Algal bloom', 'a vast algal bloom off a coastline.']],
    moon: [['Recent impact crater', 'a fresh crater that was not in older images.'], ['Lava tube skylight', 'a pit that may open into a lava tube.'], ['Magnetic swirl', 'bright surface swirls aligned with a local magnetic anomaly.']],
    mars: [['Recurring slope streaks', 'dark streaks that lengthen in warm seasons.'], ['Methane spike', 'a transient trace-gas spike over one region.'], ['Fresh ice-exposing crater', 'a new impact that exposed bright ice.']],
    asteroid: [['Particle ejection', 'small particles being ejected from the surface.'], ['Tiny moonlet', 'a small satellite orbiting the asteroid.'], ['Bright carbonate veins', 'bright veins in a large boulder.']],
    jupiter: [['Lightning at high latitude', 'lightning flashes near the poles.'], ['Volcanic plume on a moon', 'a volcanic plume rising from a moon.'], ['Unexpected magnetic hot spot', 'an intense patch of magnetic field.']],
    kbo: [['Possible tenuous haze', 'a faint brightening near the limb.'], ['Small satellite', 'a faint companion moving with Halcyon.'], ['Unexpected dust', 'micro-dust hits near the target.']],
  };
})();
