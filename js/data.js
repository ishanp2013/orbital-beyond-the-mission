/* ORBITAL: Beyond the Mission — data catalog
 * Every entry is tagged with a provenance:
 *   REAL  = real-world physical constant / published body property (NASA NSSDCA fact sheets etc.)
 *   MODEL = simplified educational model parameter (see Library > Model Assumptions)
 *   GAME  = fictional game specification (hardware, costs, vehicles, agency)
 */
(function () {
  const ORB = (window.ORB = window.ORB || {});

  ORB.CONST = {
    AU_KM: 149597870.7,          // REAL
    MU_SUN: 1.32712440018e11,    // REAL km^3/s^2
    C: 299792.458,               // REAL km/s
    G0: 9.80665,                 // REAL m/s^2
    SOLAR: 1361,                 // REAL W/m^2 at 1 AU (total solar irradiance)
    SIGMA: 5.670374e-8,          // REAL Stefan-Boltzmann
    K_DB: -228.6,                // REAL Boltzmann constant in dBW/K/Hz
    YEAR_D: 365.256,             // REAL sidereal year (days)
  };

  // ---------------------------------------------------------------- bodies (REAL, NASA NSSDCA fact sheets) unless noted
  ORB.BODIES = {
    sun: { name: 'Sun', color: '#ffd27a' },
    earth: { name: 'Earth', mu: 398600.4418, R: 6378.137, aAU: 1.0, periodD: 365.256, color: '#4aa3ff' },
    moon: { name: 'Moon', mu: 4902.8, R: 1737.4, aKm: 384400, aKmMax: 405500, periodD: 27.3217, color: '#c9c9d1' },
    mars: { name: 'Mars', mu: 42828.37, R: 3389.5, aAU: 1.52368, ecc: 0.0934, periodD: 686.98, color: '#e2694a' },
    jupiter: { name: 'Jupiter', mu: 126686534, R: 71492, aAU: 5.2026, ecc: 0.0489, periodD: 4332.59, color: '#d8b48a' },
    tessera: { name: 'Tessera', fictional: true, mu: 4.9e-9, R: 0.35, aAU: 1.32, ecc: 0.08, incDeg: 3.0, periodD: 554.0, color: '#a99a86' },
    halcyon: { name: 'Halcyon', fictional: true, R: 16, aAU: 44.0, color: '#9fb6d8' },
  };

  // ---------------------------------------------------------------- spacecraft components (GAME specs, physically plausible)
  ORB.COMPONENTS = {
    solar: [
      { id: 'none', name: 'No solar arrays', eff: 0, areal: 0, costM2: 0, degr: 0, rel: 1, deployRel: 1,
        desc: 'Rely entirely on radioisotope power. Only sensible far from the Sun.' },
      { id: 'si', name: 'Silicon cells — rigid panels', eff: 0.165, areal: 3.2, costM2: 0.32, degr: 0.030, rel: 0.997, deployRel: 0.995,
        desc: 'Mature and cheap, but heavy and less efficient. Degrades faster under radiation.' },
      { id: 'gaas', name: 'Triple-junction GaAs — rigid panels', eff: 0.295, areal: 2.8, costM2: 0.85, degr: 0.015, rel: 0.998, deployRel: 0.995,
        desc: 'The workhorse of modern spacecraft: ~30% efficient and radiation tolerant.' },
      { id: 'flex', name: 'Triple-junction — roll-out flexible array', eff: 0.29, areal: 1.5, costM2: 1.25, degr: 0.018, rel: 0.997, deployRel: 0.985,
        desc: 'Very light per square metre, but the deployment mechanism adds a one-time risk.' },
    ],
    rtg: { name: 'Radioisotope power unit (MMRTG-class)', massKg: 45, powerW: 110, decay: 0.025, cost: 70, approval: 15, rel: 0.999,
      desc: 'Converts heat from Pu-238 decay into ~110 W of electricity, day and night, at any distance from the Sun. Pu-238 is scarce; launch requires nuclear safety approval.' },
    battery: [
      { id: 'nih2', name: 'Nickel-hydrogen (NiH₂)', whKg: 45, costWh: 0.004, fade: 0.025, rel: 0.998,
        desc: 'Heritage chemistry with long cycle life; heavy.' },
      { id: 'liion', name: 'Lithium-ion', whKg: 130, costWh: 0.006, fade: 0.02, rel: 0.997,
        desc: 'Standard modern choice: ~3× the energy per kg of NiH₂.' },
      { id: 'liion_he', name: 'High-energy lithium-ion', whKg: 180, costWh: 0.009, fade: 0.03, rel: 0.995,
        desc: 'Lightest option, but capacity fades faster with deep cycling.' },
    ],
    pmad: [
      { id: 'det', name: 'Direct energy transfer (DET)', massKg: 10, cost: 4, xd: 0.85, xe: 0.65, rel: 0.995, autoShed: false,
        desc: 'Simple, efficient regulator. Arrays operate at a fixed voltage, so energy is wasted when sunlight or temperature changes a lot.' },
      { id: 'mppt', name: 'Peak-power tracking (MPPT)', massKg: 14, cost: 8, xd: 0.80, xe: 0.60, rel: 0.996, autoShed: false,
        desc: 'Continuously finds each array\'s maximum-power point — valuable when sun distance or temperature varies widely.' },
      { id: 'smart', name: 'Redundant MPPT + smart load management', massKg: 20, cost: 14, xd: 0.80, xe: 0.60, rel: 0.999, autoShed: true,
        desc: 'Redundant power electronics that automatically shed non-essential loads before the battery runs flat.' },
    ],
    engine: [
      { id: 'mono', name: 'Monopropellant hydrazine', type: 'chem', isp: 225, thrustN: 220, massKg: 12, cost: 8, tankFrac: 0.08, rel: 0.995, propCostKg: 0.0004,
        desc: 'Simple and reliable: one propellant flowing over a catalyst. Modest efficiency (Isp ≈ 225 s).' },
      { id: 'biprop', name: 'Bipropellant (MMH / NTO)', type: 'chem', isp: 318, thrustN: 645, massKg: 35, cost: 22, tankFrac: 0.10, rel: 0.99, propCostKg: 0.0004,
        desc: 'Fuel and oxidizer ignite on contact. High thrust for orbit insertion, Isp ≈ 318 s.' },
      { id: 'hall', name: 'Electric — Hall-effect thruster (xenon)', type: 'ep', isp: 1800, eff: 0.55, pMax: 4500, massKg: 75, cost: 40, tankFrac: 0.10, rel: 0.985, propCostKg: 0.003,
        desc: 'Accelerates ionized xenon with electric fields. Isp ≈ 1800 s but thrust is a fraction of a newton and needs kilowatts of power.' },
      { id: 'ion', name: 'Electric — Gridded ion engine (xenon)', type: 'ep', isp: 3100, eff: 0.65, pMax: 2500, massKg: 90, cost: 55, tankFrac: 0.10, rel: 0.985, propCostKg: 0.003,
        desc: 'Extremely efficient (Isp ≈ 3100 s) but very gentle thrust: months of continuous thrusting.' },
    ],
    acs: [
      { id: 'coldgas', name: 'Cold-gas thrusters only', massKg: 8, powerW: 5, cost: 3, pointDeg: 0.5, pointQ: 0.65, rel: 0.995, wheels: 0,
        desc: 'Cheap and simple, but coarse pointing (~0.5°) blurs images and wastes antenna gain.' },
      { id: 'rw', name: 'Reaction wheels + hydrazine thrusters', massKg: 30, powerW: 40, cost: 12, pointDeg: 0.05, pointQ: 0.9, rel: 0.99, wheels: 3,
        desc: 'Spinning wheels trade momentum with the spacecraft for smooth, precise pointing (~0.05°). Three wheels, no spare.' },
      { id: 'precision', name: 'Precision: 4 wheels + star trackers + thrusters', massKg: 42, powerW: 55, cost: 22, pointDeg: 0.01, pointQ: 1.0, rel: 0.997, wheels: 4,
        desc: 'Star trackers give ~0.01° knowledge; a fourth wheel provides a spare if one fails.' },
    ],
    antenna: [
      { id: 'lga', name: 'Low-gain antenna (near-omni)', D: 0, gainDbi: 5, massKg: 2, cost: 2,
        desc: 'Works in almost any orientation but spreads the signal everywhere. Fine near Earth, nearly useless far away.' },
      { id: 'mga', name: 'Medium-gain antenna (0.5 m)', D: 0.5, massKg: 6, cost: 6, desc: 'A modest dish: some focusing, loose pointing needs.' },
      { id: 'hga15', name: 'High-gain dish (1.5 m)', D: 1.5, massKg: 22, cost: 18, desc: 'Focuses the beam ~1,000× more than an omni antenna. Must be pointed at Earth.' },
      { id: 'hga25', name: 'High-gain dish (2.5 m)', D: 2.5, massKg: 38, cost: 28, desc: 'Large dish for planetary distances.' },
      { id: 'hga35', name: 'High-gain dish (3.5 m)', D: 3.5, massKg: 60, cost: 40, desc: 'Very large dish for the outer solar system; needs a wide fairing.' },
    ],
    band: [
      { id: 'x', name: 'X-band (8.4 GHz)', freqGHz: 8.4, lossDb: 0.3, capMbps: 150, cost: 0, avail: 0.98, desc: 'Robust deep-space standard; little weather loss.' },
      { id: 'ka', name: 'Ka-band (32 GHz)', freqGHz: 32, lossDb: 2.0, capMbps: 600, cost: 8, avail: 0.8, desc: 'Shorter wavelength → ~4× narrower beam and more data, but rain fade makes ~20% of passes unusable and pointing must be tighter.' },
    ],
    insulation: [
      { id: 'mli15', name: 'Standard MLI blankets (15 layers)', effEmit: 0.03, massKg: 8, cost: 2, desc: 'Multi-layer insulation: thin reflective sheets that block radiative heat flow.' },
      { id: 'mli30', name: 'High-performance MLI (30 layers)', effEmit: 0.015, massKg: 14, cost: 4, desc: 'Halves heat leak — keeps the spacecraft warm far from the Sun, but traps heat near it.' },
    ],
    thermalCtrl: [
      { id: 'passive', name: 'Passive radiator + thermostatic heaters', massKg: 0, cost: 1, coldEps: 0.85, hotBonus: 0, rel: 0.9995,
        desc: 'The radiator always rejects heat; electric heaters make up any shortfall — costing power.' },
      { id: 'louvers', name: 'Variable louvers', massKg: 8, cost: 6, coldEps: 0.15, hotBonus: 0, rel: 0.998,
        desc: 'Bimetallic shutters close over the radiator when cold, cutting heater power dramatically.' },
      { id: 'lhp', name: 'Loop heat pipes + louvers', massKg: 18, cost: 14, coldEps: 0.12, hotBonus: 5, rel: 0.999,
        desc: 'Moves heat efficiently to the radiator and tolerates hotter environments (+5 K hot limit).' },
    ],
    structure: [
      { id: 'al', name: 'Aluminium honeycomb', frac: 0.14, costKg: 0.08, rel: 0.998, shieldMm: 2.0,
        desc: 'Industry standard primary structure.' },
      { id: 'cfrp', name: 'Carbon-composite (lightweight)', frac: 0.10, costKg: 0.15, rel: 0.996, shieldMm: 1.0,
        desc: 'Lighter and stiffer, but costlier and offers less inherent radiation shielding.' },
      { id: 'reinforced', name: 'Reinforced aluminium–titanium', frac: 0.20, costKg: 0.10, rel: 0.999, shieldMm: 3.5,
        desc: 'Heavy but strong; tolerates aerobraking loads and adds shielding.' },
    ],
    computer: [
      { id: 'cots', name: 'Commercial-grade flight computer', massKg: 3, powerW: 8, cost: 2, tidKrad: 8, autonomy: 1, rel: 0.97, seu: 4.0,
        desc: 'Fast and cheap but not designed for radiation: bit flips and total-dose damage are likely beyond low Earth orbit.' },
      { id: 'radhard', name: 'Radiation-hardened computer (RAD750-class)', massKg: 8, powerW: 15, cost: 12, tidKrad: 100, autonomy: 2, rel: 0.997, seu: 0.6,
        desc: 'Slower, but built to survive radiation. Runs standard fault-protection software.' },
      { id: 'redundant', name: 'Dual rad-hard + autonomy suite', massKg: 16, powerW: 28, cost: 28, tidKrad: 300, autonomy: 3, rel: 0.9995, seu: 0.3,
        desc: 'Two cross-strapped computers plus onboard autonomy that can respond to faults without waiting for Earth.' },
    ],
    storage: [
      { id: 's32', name: '32 Gbit recorder', gbit: 32, massKg: 1, powerW: 3, cost: 1 },
      { id: 's128', name: '128 Gbit recorder', gbit: 128, massKg: 2, powerW: 5, cost: 3 },
      { id: 's512', name: '512 Gbit recorder', gbit: 512, massKg: 3, powerW: 7, cost: 6 },
      { id: 's2048', name: '2 Tbit recorder', gbit: 2048, massKg: 5, powerW: 10, cost: 12 },
    ],
  };

  // ---------------------------------------------------------------- science instruments (GAME specs; scientific rationale REAL)
  // rate: Gbit/day while operating. value: base science points. kind: imaging instruments benefit from pointing/resolution.
  ORB.INSTRUMENTS = [
    { id: 'cam', name: 'High-resolution optical camera', short: 'Camera', icon: '◉', massKg: 14, powerW: 18, cost: 24, rate: 6.0, value: 30, rel: 0.985, imaging: true, optical: true,
      why: 'Maps landforms, craters, layering and change over time. Resolution depends on altitude and pointing stability.',
      rel_: { eo: 1, moon: 1, mars: 1, asteroid: 1, jupiter: 0.7, kbo: 1 } },
    { id: 'irspec', name: 'Imaging infrared spectrometer', short: 'IR Spectrometer', icon: '≋', massKg: 16, powerW: 22, cost: 30, rate: 3.0, value: 32, rel: 0.98, imaging: true, optical: true, coldNeeded: true,
      why: 'Minerals and ices absorb infrared light at characteristic wavelengths — a chemical fingerprint. Detectors must stay cold.',
      rel_: { eo: 0.9, moon: 0.8, mars: 1, asteroid: 1, jupiter: 0.8, kbo: 0.9 } },
    { id: 'radar', name: 'Radar (imaging / sounding)', short: 'Radar', icon: '⌇', massKg: 48, powerW: 140, cost: 48, rate: 10.0, value: 38, rel: 0.98, imaging: true,
      why: 'Radio waves see through clouds and darkness and can penetrate ice and dry soil to reveal buried layers. Power-hungry.',
      rel_: { eo: 1, moon: 0.6, mars: 0.9, asteroid: 0.5, jupiter: 0.2, kbo: 0.1 } },
    { id: 'mag', name: 'Magnetometer (on boom)', short: 'Magnetometer', icon: '⟟', massKg: 5, powerW: 4, cost: 7, rate: 0.05, value: 16, rel: 0.995,
      why: 'Measures magnetic fields — revealing planetary dynamos, crustal magnetism and the solar wind. Mounted on a boom away from spacecraft electronics.',
      rel_: { eo: 0.3, moon: 0.5, mars: 0.6, asteroid: 0.3, jupiter: 1, kbo: 0.5 } },
    { id: 'atmo', name: 'Atmospheric sounder', short: 'Atmos. Sounder', icon: '☁', massKg: 11, powerW: 14, cost: 18, rate: 0.6, value: 26, rel: 0.985,
      why: 'Profiles temperature, pressure, water vapour and dust with altitude. Useless where there is no atmosphere.',
      rel_: { eo: 1, moon: 0.1, mars: 1, asteroid: 0.05, jupiter: 1, kbo: 0.3 } },
    { id: 'rad', name: 'Radiation detector', short: 'Radiation Det.', icon: '☢', massKg: 4, powerW: 5, cost: 8, rate: 0.03, value: 14, rel: 0.995,
      why: 'Measures the energetic-particle dose environment — vital for understanding hazards to future crews and electronics.',
      rel_: { eo: 0.4, moon: 0.7, mars: 0.6, asteroid: 0.4, jupiter: 1, kbo: 0.5 } },
    { id: 'grs', name: 'Gamma-ray & neutron spectrometer', short: 'Gamma/Neutron Spec.', icon: '✶', massKg: 18, powerW: 16, cost: 24, rate: 0.1, value: 30, rel: 0.985,
      why: 'Cosmic rays make surface atoms emit gamma rays and neutrons; their energies reveal soil elements and buried hydrogen (water ice) from orbit.',
      rel_: { eo: 0.2, moon: 1, mars: 0.9, asteroid: 1, jupiter: 0.1, kbo: 0.2 } },
    { id: 'particle', name: 'Plasma & particle detector', short: 'Particle Det.', icon: '⁘', massKg: 7, powerW: 9, cost: 12, rate: 0.15, value: 20, rel: 0.99,
      why: 'Counts charged particles to study the solar wind, magnetospheres and how they interact with planets.',
      rel_: { eo: 0.4, moon: 0.5, mars: 0.6, asteroid: 0.4, jupiter: 1, kbo: 0.8 } },
    { id: 'uvs', name: 'UV / visible spectrometer', short: 'UV-Vis Spec.', icon: '◬', massKg: 9, powerW: 11, cost: 16, rate: 0.5, value: 24, rel: 0.985, imaging: true, optical: true,
      why: 'Ultraviolet light reveals atmospheric gases, aurorae and surface frosts.',
      rel_: { eo: 0.7, moon: 0.4, mars: 0.8, asteroid: 0.5, jupiter: 0.9, kbo: 0.9 } },
    { id: 'lidar', name: 'Laser altimeter', short: 'Laser Altimeter', icon: '⇣', massKg: 12, powerW: 32, cost: 19, rate: 0.3, value: 24, rel: 0.98, imaging: true,
      why: 'Times laser pulses to the surface to build precise topographic maps and shape models.',
      rel_: { eo: 0.6, moon: 1, mars: 0.7, asteroid: 1, jupiter: 0.05, kbo: 0.2 } },
  ];
  ORB.INSTRUMENT_BY_ID = Object.fromEntries(ORB.INSTRUMENTS.map(i => [i.id, i]));
  // Radio science is not hardware you choose — it uses the telecom system itself (tracks Doppler shift to map gravity).
  ORB.RADIO_SCIENCE = { id: 'radio', name: 'Radio science (gravity)', short: 'Radio Science', icon: '⌁', value: 20,
    why: 'Tiny Doppler shifts in the radio signal reveal how gravity tugs the spacecraft — mapping a body\'s mass and interior. Needs a high-gain antenna and stable pointing.' };

  // ---------------------------------------------------------------- launch vehicles (GAME — fictional, inspired by real vehicle classes)
  ORB.LAUNCHERS = [
    { id: 'pathfinder', name: 'Pathfinder-S', cls: 'Small-lift class', leo: 1500, mEsc: 350, lambda: 35, fairingD: 1.6, fairingUse: 1.4, cost: 40, rel: 0.94, stages: 3, heightM: 30, color: '#9ad7ff',
      desc: 'A light, inexpensive rocket for small satellites. Young vehicle with a shorter flight record.' },
    { id: 'meridian', name: 'Meridian-M', cls: 'Medium-lift class', leo: 10500, mEsc: 2800, lambda: 48, fairingD: 4.0, fairingUse: 3.7, cost: 95, rel: 0.975, stages: 2, heightM: 55, color: '#7fb6ff',
      desc: 'A dependable medium rocket — the sensible default for many science missions.' },
    { id: 'titanis', name: 'Titanis-H', cls: 'Heavy-lift class', leo: 25000, mEsc: 6800, lambda: 57, fairingD: 5.0, fairingUse: 4.6, cost: 170, rel: 0.985, stages: 2, boosters: 4, heightM: 62, color: '#b49bff',
      desc: 'Strap-on boosters and a high-energy upper stage for planetary missions. Excellent flight record.' },
    { id: 'colossus', name: 'Colossus-SH', cls: 'Super-heavy class', leo: 65000, mEsc: 16000, lambda: 62, fairingD: 8.4, fairingUse: 7.5, cost: 380, rel: 0.95, stages: 2, boosters: 2, heightM: 98, color: '#ff9ad5',
      desc: 'Enormous capability and fairing — but expensive and with few flights so far.' },
  ];
  ORB.KICK_STAGE = { name: 'Solid kick stage', cost: 22, lambdaMult: 1.35, mEscMult: 0.92, rel: 0.995,
    desc: 'An extra solid-rocket stage that adds energy for very high-C3 departures (outer solar system). Reduces low-energy capability slightly.' };
  ORB.LAUNCH_SITES = [
    { id: 'equatorial', name: 'Equatorial coastal site', lat: 5.2, desc: 'Maximum boost from Earth\'s rotation (~463 m/s).' },
    { id: 'mid', name: 'Mid-latitude coastal site', lat: 28.5, desc: 'Reference site. Rotation boost ~409 m/s.' },
    { id: 'high', name: 'High-latitude site', lat: 51.0, desc: 'Less rotation boost (~293 m/s) but direct access to high inclinations without plane changes.' },
  ];

  // ---------------------------------------------------------------- environments (MODEL)
  // rad: krad/yr behind 1 mm Al-equivalent (illustrative); spe: solar particle events per year; mmRate: micrometeoroid hazard per yr
  ORB.ENV = {
    cruise: { rad: 4, spe: 0.5, mm: 0.01 },
    eo: { rad: 2.5, spe: 0.2, mm: 0.02, debris: 1.0 },
    moon: { rad: 5, spe: 0.6, mm: 0.015 },
    mars: { rad: 5, spe: 0.5, mm: 0.015 },
    asteroid: { rad: 5, spe: 0.5, mm: 0.03 },
    jupiter: { rad: 900, spe: 0.3, mm: 0.02 },
    kbo: { rad: 1, spe: 0.05, mm: 0.01 },
  };

  // ---------------------------------------------------------------- missions
  // objectives: inst = contributing instruments, needDays = observation-days of returned data needed for full credit
  ORB.MISSIONS = [
    {
      id: 'eo', category: 'Earth Observation', name: 'SENTINEL-TERRA', difficulty: 1, diffLabel: 'Cadet',
      budget: 340, dest: 'earth', type: 'leo', color: '#4aa3ff',
      tagline: 'Watch our living planet from low Earth orbit.',
      story: 'Droughts, wildfires and algal blooms are changing faster than ground stations can track. The Directorate needs an orbiter that can image every point on Earth, measure the atmosphere, and see through clouds — for at least one full year of seasons.',
      constraints: ['Primary science phase of at least 1 year', 'Comply with orbital-debris guidelines: deorbit within 25 years', 'Budget cap $340 M (all costs, including launch and operations)'],
      objectives: [
        { id: 'land', name: 'Land surface & vegetation', inst: ['cam', 'irspec', 'radar'], needDays: 1750, weight: 0.4, coverage: true, desc: 'Map vegetation health, land use and fire scars across all continents.' },
        { id: 'atm', name: 'Atmosphere & climate', inst: ['atmo', 'uvs', 'irspec'], needDays: 1750, weight: 0.35, coverage: true, desc: 'Profile temperature, water vapour, ozone and aerosols.' },
        { id: 'ocean', name: 'Oceans & ice (all-weather)', inst: ['radar', 'cam'], needDays: 1170, weight: 0.25, coverage: true, desc: 'Track sea ice and ocean surface day and night through clouds.' },
      ],
      duration: { min: 180, max: 1825, def: 730, ref: 730 },
      opsPerDay: 0.035, dsn: { def: 1.5, min: 0.5, max: 4, label: 'Ground-station contact', costH: 0.0006 },
      orbitOptions: { kind: 'leo' },
      trajectories: ['direct'],
      unlockedByDefault: true,
      baseline: { solarType: 'gaas', solarArea: 3, rtgCount: 0, batteryType: 'liion', batteryWh: 1400, pmad: 'det', engine: 'mono', propellant: 60, acs: 'rw',
        antenna: 'mga', txPower: 10, band: 'x', insulation: 'mli15', radiatorArea: 1.2, thermalCtrl: 'passive', structure: 'al', shielding: 0,
        computer: 'radhard', storage: 's128', instruments: ['cam', 'atmo', 'radar'], lv: 'meridian', site: 'mid', kick: false,
        orbit: { alt: 700, inc: 'sso1030' }, trajectory: { type: 'direct', speed: 0, offset: 0 }, duration: 730, dsnHours: 1.5 },
    },
    {
      id: 'moon', category: 'Lunar Exploration', name: 'SELENE PATHFINDER', difficulty: 1, diffLabel: 'Cadet',
      budget: 400, dest: 'moon', type: 'moon', color: '#c9c9d1',
      tagline: 'Map the Moon and hunt for water ice at the poles.',
      story: 'Permanently shadowed craters near the lunar poles may hold water ice — a resource for future explorers. Your orbiter must map surface geology and composition globally and measure the radiation environment astronauts will face.',
      constraints: ['A polar orbit is needed to see the poles', 'Primary science phase of at least 6 months', 'Budget cap $400 M'],
      objectives: [
        { id: 'geo', name: 'Global geology & topography', inst: ['cam', 'lidar'], needDays: 584, weight: 0.4, coverage: true, desc: 'High-resolution images and laser topography of the whole Moon.' },
        { id: 'vol', name: 'Polar volatiles & composition', inst: ['grs', 'irspec'], needDays: 584, weight: 0.4, coverage: true, desc: 'Detect hydrogen and ice signatures in polar craters.' },
        { id: 'rad', name: 'Radiation environment', inst: ['rad', 'particle'], needDays: 584, weight: 0.2, desc: 'Characterize the dose astronauts would receive.' },
      ],
      duration: { min: 120, max: 1095, def: 365, ref: 365 },
      opsPerDay: 0.06, dsn: { def: 6, min: 2, max: 16, label: 'Deep Space Network time', costH: 0.0012 },
      orbitOptions: { kind: 'moon', alts: [50, 100, 200] },
      trajectories: ['direct', 'blt', 'ep'],
      unlockedByDefault: true,
      baseline: { solarType: 'gaas', solarArea: 6, rtgCount: 0, batteryType: 'liion', batteryWh: 1200, pmad: 'det', engine: 'biprop', propellant: 380, acs: 'rw',
        antenna: 'mga', txPower: 15, band: 'x', insulation: 'mli15', radiatorArea: 1.0, thermalCtrl: 'passive', structure: 'al', shielding: 0,
        computer: 'radhard', storage: 's128', instruments: ['cam', 'lidar', 'grs'], lv: 'meridian', site: 'mid', kick: false,
        orbit: { alt: 100, inc: 'polar' }, trajectory: { type: 'direct', speed: 0, offset: 0 }, duration: 365, dsnHours: 6 },
    },
    {
      id: 'mars', category: 'Mars Exploration', name: 'ARES HORIZON', difficulty: 2, diffLabel: 'Engineer',
      budget: 660, dest: 'mars', type: 'helio', color: '#e2694a',
      tagline: 'Read the history of water written in Martian rock and ice.',
      story: 'Ancient river deltas and buried glaciers suggest Mars was once wetter. Your orbiter must identify water-altered minerals, profile the thin atmosphere, probe beneath the surface for ice, and map remnant crustal magnetism — while Mars swings out to 2.5 AU from Earth.',
      constraints: ['Launch inside the Earth–Mars window (every ~26 months)', 'Primary science phase of at least 1 Mars year is ideal (687 days)', 'Budget cap $660 M'],
      objectives: [
        { id: 'min', name: 'Water-altered minerals & geology', inst: ['irspec', 'cam'], needDays: 1100, weight: 0.35, coverage: true, desc: 'Find clays, sulfates and layered sediments.' },
        { id: 'atm', name: 'Atmosphere & climate', inst: ['atmo', 'uvs'], needDays: 1100, weight: 0.25, desc: 'Track dust storms, seasonal CO₂ and water vapour.' },
        { id: 'ice', name: 'Subsurface ice & composition', inst: ['radar', 'grs'], needDays: 1100, weight: 0.25, coverage: true, desc: 'Map buried ice and near-surface hydrogen.' },
        { id: 'mag', name: 'Crustal magnetism & space weather', inst: ['mag', 'particle', 'rad'], needDays: 1650, weight: 0.15, desc: 'Map magnetized crust and how solar wind strips the atmosphere.' },
      ],
      duration: { min: 180, max: 1460, def: 687, ref: 687 },
      opsPerDay: 0.09, dsn: { def: 8, min: 2, max: 16, label: 'Deep Space Network time', costH: 0.0012 },
      orbitOptions: { kind: 'mars' },
      trajectories: ['hohmann', 'fast', 'ep'],
      window: { halfWidth: 20 },
      unlockedByDefault: false,
      baseline: { solarType: 'gaas', solarArea: 14, rtgCount: 0, batteryType: 'liion', batteryWh: 2000, pmad: 'mppt', engine: 'biprop', propellant: 900, acs: 'rw',
        antenna: 'hga15', txPower: 25, band: 'x', insulation: 'mli15', radiatorArea: 1.4, thermalCtrl: 'passive', structure: 'al', shielding: 2,
        computer: 'radhard', storage: 's512', instruments: ['cam', 'irspec', 'atmo', 'radar'], lv: 'meridian', site: 'mid', kick: false,
        orbit: { id: 'low' }, trajectory: { type: 'hohmann', speed: 0, offset: 0 }, duration: 687, dsnHours: 8 },
    },
    {
      id: 'asteroid', category: 'Asteroid Exploration', name: 'TESSERA RENDEZVOUS', difficulty: 3, diffLabel: 'Flight Director',
      budget: 600, dest: 'tessera', type: 'helio', color: '#c8a27a',
      tagline: 'Match orbits with a primitive near-Earth asteroid.',
      story: 'Tessera (a fictional near-Earth asteroid, ~700 m across) may preserve material from the birth of the Solar System. Unlike a planet, it has almost no gravity to help capture you: your spacecraft must match its orbit — including a 3° tilt — entirely with its own propulsion.',
      constraints: ['Rendezvous Δv must come from the spacecraft itself', 'Orbit plane differs from Earth\'s by 3°', 'Budget cap $600 M'],
      objectives: [
        { id: 'shape', name: 'Shape, topography & spin', inst: ['cam', 'lidar'], needDays: 864, weight: 0.35, desc: 'Build a precise 3-D shape model and surface map.' },
        { id: 'comp', name: 'Surface composition', inst: ['irspec', 'grs', 'uvs'], needDays: 1296, weight: 0.4, desc: 'Identify organics, hydrated minerals and metals.' },
        { id: 'mass', name: 'Mass & interior (radio science)', inst: ['radio'], needDays: 432, weight: 0.25, desc: 'Track Doppler shifts to weigh the asteroid and infer porosity.' },
      ],
      duration: { min: 120, max: 1095, def: 540, ref: 540 },
      opsPerDay: 0.08, dsn: { def: 8, min: 2, max: 16, label: 'Deep Space Network time', costH: 0.0012 },
      orbitOptions: { kind: 'asteroid' },
      trajectories: ['hohmann', 'fast', 'ep'],
      window: { halfWidth: 25 },
      unlockedByDefault: false,
      baseline: { solarType: 'gaas', solarArea: 5, rtgCount: 0, batteryType: 'liion', batteryWh: 1500, pmad: 'mppt', engine: 'biprop', propellant: 1200, acs: 'rw',
        antenna: 'hga15', txPower: 25, band: 'x', insulation: 'mli15', radiatorArea: 1.2, thermalCtrl: 'louvers', structure: 'al', shielding: 2,
        computer: 'radhard', storage: 's512', instruments: ['cam', 'lidar', 'irspec'], lv: 'meridian', site: 'mid', kick: false,
        orbit: { id: 'terminator' }, trajectory: { type: 'hohmann', speed: 0, offset: 0 }, duration: 540, dsnHours: 8 },
    },
    {
      id: 'jupiter', category: 'Outer Planetary', name: 'ZEUS DEEP', difficulty: 3, diffLabel: 'Flight Director',
      budget: 1450, dest: 'jupiter', type: 'helio', color: '#d8b48a',
      tagline: 'Dive through the most violent radiation belts in the Solar System.',
      story: 'Jupiter\'s magnetosphere is the largest structure in the planetary system, and its radiation can destroy unprotected electronics in days. At 5.2 AU, sunlight is 27× weaker than at Earth. Your orbiter must study the magnetosphere, atmosphere and deep interior — and survive.',
      constraints: ['Sunlight is ~1/27 of Earth\'s: power is scarce', 'Extreme radiation: shield the electronics', 'Budget cap $1.45 B'],
      objectives: [
        { id: 'mag', name: 'Magnetosphere & aurorae', inst: ['mag', 'particle', 'uvs'], needDays: 400, weight: 0.35, desc: 'Map the magnetic field and the particles that power the aurorae.' },
        { id: 'atm', name: 'Atmosphere & deep water', inst: ['atmo', 'irspec', 'cam'], needDays: 400, weight: 0.3, desc: 'Measure composition and storms beneath the cloud tops.' },
        { id: 'rad', name: 'Radiation belts', inst: ['rad', 'particle'], needDays: 260, weight: 0.15, desc: 'Measure the belts that threaten every Jupiter spacecraft.' },
        { id: 'int', name: 'Interior & gravity field', inst: ['radio'], needDays: 160, weight: 0.2, desc: 'Weigh the core using Doppler tracking at each close pass.' },
      ],
      duration: { min: 180, max: 1460, def: 740, ref: 740 },
      opsPerDay: 0.12, dsn: { def: 8, min: 2, max: 16, label: 'Deep Space Network time', costH: 0.0012 },
      orbitOptions: { kind: 'jupiter' },
      trajectories: ['hohmann', 'fast', 'ega'],
      window: { halfWidth: 30 },
      unlockedByDefault: false,
      baseline: { solarType: 'gaas', solarArea: 50, rtgCount: 0, batteryType: 'liion', batteryWh: 3000, pmad: 'mppt', engine: 'biprop', propellant: 1600, acs: 'precision',
        antenna: 'hga25', txPower: 25, band: 'x', insulation: 'mli30', radiatorArea: 1.0, thermalCtrl: 'louvers', structure: 'reinforced', shielding: 8,
        computer: 'radhard', storage: 's512', instruments: ['mag', 'particle', 'atmo', 'rad'], lv: 'titanis', site: 'mid', kick: false,
        orbit: { id: 'polar53' }, trajectory: { type: 'ega', speed: 0, offset: 0 }, duration: 740, dsnHours: 8 },
    },
    {
      id: 'kbo', category: 'Deep Space', name: 'FAR HORIZON', difficulty: 4, diffLabel: 'Mission Architect',
      budget: 1150, dest: 'halcyon', type: 'kbo', color: '#9fb6d8',
      tagline: 'A one-shot flyby of a frozen world at the edge of the planets.',
      story: 'Halcyon (a fictional Kuiper Belt object, ~30 km across) orbits 44 AU from the Sun. Light takes over 6 hours to cross that distance each way. You get a single flyby — the spacecraft must execute it on its own, store everything, and trickle the data home over months at a few kilobits per second.',
      constraints: ['Arrive within 16 years of launch', 'Solar power is useless at 44 AU (~1/1900 of Earth sunlight)', 'One-way light time ≈ 6 h: no real-time control', 'Budget cap $1.15 B'],
      objectives: [
        { id: 'img', name: 'Flyby imaging & geology', inst: ['cam', 'lidar'], needDays: 6, weight: 0.4, flyby: true, desc: 'Map the surface during a few hours of close approach.' },
        { id: 'comp', name: 'Surface composition', inst: ['irspec', 'uvs'], needDays: 6, weight: 0.35, flyby: true, desc: 'Identify ices (methane, nitrogen, water) on the surface.' },
        { id: 'helio', name: 'Outer heliosphere (cruise science)', inst: ['particle', 'mag', 'rad'], needDays: 1650, weight: 0.25, cruise: true, desc: 'Measure the solar wind and cosmic rays across the outer Solar System.' },
      ],
      duration: { min: 200, max: 1200, def: 600, ref: 600 },
      opsPerDay: 0.1, cruiseOpsFactor: 0.25, dsn: { def: 8, min: 2, max: 16, label: 'Deep Space Network time', costH: 0.0012 },
      orbitOptions: { kind: 'kbo' },
      trajectories: ['direct', 'jga'],
      maxTravelYears: 16,
      unlockedByDefault: false,
      baseline: { solarType: 'none', solarArea: 0, rtgCount: 2, batteryType: 'liion', batteryWh: 600, pmad: 'mppt', engine: 'mono', propellant: 90, acs: 'rw',
        antenna: 'hga25', txPower: 15, band: 'x', insulation: 'mli30', radiatorArea: 1.0, thermalCtrl: 'louvers', structure: 'al', shielding: 2,
        computer: 'radhard', storage: 's128', instruments: ['cam', 'irspec', 'particle'], lv: 'titanis', site: 'mid', kick: true,
        orbit: { flybyKm: 10000 }, trajectory: { type: 'jga', c3: 135, rpRJ: 32, offset: 0 }, duration: 600, dsnHours: 8 },
    },
  ];
  ORB.MISSION_BY_ID = Object.fromEntries(ORB.MISSIONS.map(m => [m.id, m]));
  ORB.SANDBOX_BUDGET = { min: 200, max: 3000, def: 1200 };

  // Difficulty settings (affect budget and anomaly frequency)
  ORB.DIFFICULTY = [
    { id: 'cadet', name: 'Cadet', budgetMult: 1.2, hazardMult: 0.6, desc: '+20% budget, fewer anomalies, extra guidance.' },
    { id: 'engineer', name: 'Engineer', budgetMult: 1.0, hazardMult: 1.0, desc: 'The intended balance.' },
    { id: 'director', name: 'Flight Director', budgetMult: 0.9, hazardMult: 1.5, desc: '−10% budget and more frequent anomalies.' },
  ];

  // Orbit option catalogues (MODEL)
  ORB.ORBITS = {
    eoInc: [
      { id: 'sso1030', name: 'Sun-synchronous, 10:30 local time', incDeg: 98, coverage: 1.0, eclipse: true, optical: 1.0,
        desc: 'Crosses the equator at the same local time every orbit — consistent lighting for imaging. Passes through Earth\'s shadow each orbit.' },
      { id: 'ssodd', name: 'Sun-synchronous, dawn–dusk', incDeg: 98, coverage: 1.0, eclipse: false, optical: 0.55,
        desc: 'Rides the day–night line: almost never in shadow (great for power and radar), but low sun angles make optical images poor.' },
      { id: 'i51', name: '51.6° inclination', incDeg: 51.6, coverage: 0.75, eclipse: true, optical: 0.9,
        desc: 'Covers latitudes up to ±52° only — misses polar ice and much of the boreal forest.' },
      { id: 'i28', name: '28.5° inclination', incDeg: 28.5, coverage: 0.5, eclipse: true, optical: 0.9,
        desc: 'Cheapest to reach from a mid-latitude site, but sees only the tropics.' },
    ],
    moonInc: [
      { id: 'polar', name: 'Polar (90°)', coverage: 1.0, desc: 'Passes over both poles; the Moon rotates beneath, giving global coverage each month.' },
      { id: 'equatorial', name: 'Equatorial', coverage: 0.45, desc: 'Never sees the poles — where the ice is suspected.' },
    ],
    mars: [
      { id: 'low', name: '400 km circular polar (direct capture)', alt: 400, apo: 400, aerobrake: false, res: 1.0, coverage: 1.0, desc: 'Best resolution and global coverage, but the capture burn must remove a lot of speed.' },
      { id: 'aero', name: 'Elliptical capture + aerobraking to 400 km', alt: 400, apo: 400, captureApo: 33000, aerobrake: true, res: 1.0, coverage: 1.0, desc: 'Capture loosely, then dip into the upper atmosphere hundreds of times to lose speed by drag. Saves ~1 km/s of propellant but takes ~6 months and needs a sturdy, well-controlled spacecraft.' },
      { id: 'high', name: 'Elliptical 300 × 33,000 km', alt: 300, apo: 33000, aerobrake: false, res: 0.7, coverage: 0.8, desc: 'Cheapest capture. Spends most time far from Mars, so resolution and coverage suffer.' },
    ],
    asteroid: [
      { id: 'terminator', name: 'Terminator orbit, 1.5 km', radiusKm: 1.5, eclipse: false, res: 1.0, risk: 1.0, desc: 'Orbit above the day–night line: never in shadow and stable against sunlight pressure.' },
      { id: 'low', name: 'Low orbit, 0.9 km', radiusKm: 0.9, eclipse: true, res: 1.2, risk: 2.0, desc: 'Sharper data, but in a lumpy, weak gravity field the orbit is harder to keep safe.' },
      { id: 'survey', name: 'Survey station, 5 km', radiusKm: 5, eclipse: false, res: 0.65, risk: 0.5, desc: 'Safe hovering distance; lower resolution.' },
    ],
    jupiter: [
      { id: 'polar53', name: '53-day polar orbit (low perijove)', periodD: 53, rpRJ: 1.06, duty: 0.22, radMult: 1.0, desc: 'Skims under the main radiation belts at each close pass, then loops far away. Long orbit = fewer passes.' },
      { id: 'polar14', name: '14-day polar orbit', periodD: 14, rpRJ: 1.06, duty: 0.55, radMult: 2.6, desc: 'Four times more close passes and science, but much more radiation and a larger capture burn.' },
    ],
    kboFlyby: [
      { km: 3500, label: 'Close: 3,500 km', res: 1.25, navRisk: 2.2 },
      { km: 10000, label: 'Moderate: 10,000 km', res: 1.0, navRisk: 1.0 },
      { km: 30000, label: 'Distant: 30,000 km', res: 0.65, navRisk: 0.4 },
    ],
  };

  ORB.TRAJ_INFO = {
    direct: { name: 'Direct insertion / transfer', desc: 'Fastest standard route.' },
    blt: { name: 'Low-energy ballistic transfer', desc: 'Loops out ~1.5 million km and lets the Sun\'s gravity reshape the path, arriving gently at the Moon. Saves capture propellant, takes ~3–4 months.' },
    ep: { name: 'Low-thrust spiral (electric propulsion)', desc: 'Continuous gentle thrust for months. Needs huge Δv but very little propellant thanks to high Isp.' },
    hohmann: { name: 'Hohmann (minimum-energy) transfer', desc: 'Half an ellipse tangent to both orbits — the cheapest two-burn transfer between circular, coplanar orbits.' },
    fast: { name: 'Fast transfer (Type I)', desc: 'A larger ellipse that crosses the target orbit early: shorter trip, but more launch energy and a faster arrival to cancel.' },
    ega: { name: 'Earth gravity assist (ΔV-EGA)', desc: 'Launch into a 2-year loop, fire a deep-space burn, then swing past Earth to gain energy. Much lower launch C3, ~2 extra years.' },
    jga: { name: 'Jupiter gravity assist', desc: 'Fly close to Jupiter to steal some of its orbital momentum and slingshot outward.' },
  };

  // ---------------------------------------------------------------- glossary (REAL concepts)
  ORB.GLOSSARY = {
    'delta-v': ['Delta-v (Δv)', 'The total change in velocity a spacecraft can make with its propellant. It is the "currency" of spaceflight: every maneuver (orbit insertion, course correction, station keeping) costs Δv. Measured in m/s or km/s.'],
    'isp': ['Specific impulse (Isp)', 'How efficiently an engine uses propellant, in seconds. Higher Isp = more Δv from the same propellant. Chemical ≈ 220–450 s; electric ≈ 1,500–3,500 s.'],
    'rocket-equation': ['Tsiolkovsky rocket equation', 'Δv = Isp · g₀ · ln(m_wet / m_dry). Because of the logarithm, each extra km/s of Δv requires exponentially more propellant.'],
    'c3': ['Characteristic energy (C3)', 'The square of the "excess" speed left after escaping Earth (v∞²), in km²/s². Higher C3 = more energetic departure = less mass the rocket can lift. Negative C3 means the spacecraft is still bound to Earth (e.g., lunar trajectories).'],
    'hohmann': ['Hohmann transfer', 'The minimum-energy two-burn path between two circular, coplanar orbits: half of an ellipse that touches both. Discovered by Walter Hohmann in 1925.'],
    'gravity-assist': ['Gravity assist', 'Flying close to a moving planet bends the spacecraft\'s path; in the Sun\'s frame the spacecraft gains (or loses) speed, borrowed from the planet\'s orbital momentum. Free Δv — but only at specific alignments.'],
    'escape-velocity': ['Escape velocity', 'Minimum speed to coast away from a body forever: v_esc = √(2μ/r). About 11.2 km/s from Earth\'s surface.'],
    'orbital-velocity': ['Orbital velocity', 'Speed needed for a circular orbit: v = √(μ/r). About 7.5 km/s at 700 km above Earth.'],
    'inclination': ['Orbital inclination', 'The tilt of an orbit relative to the equator (or the ecliptic). Changing inclination is very expensive: Δv = 2·v·sin(Δi/2).'],
    'launch-window': ['Launch window', 'The period when planets are aligned so a transfer arrives where the target will be. For Mars, windows repeat every ~26 months (the synodic period).'],
    'synodic': ['Synodic period', 'Time for two planets to return to the same relative alignment: 1 / |1/T₁ − 1/T₂|.'],
    'light-time': ['One-way light time (OWLT)', 'Time for a radio signal to travel between Earth and the spacecraft at the speed of light. A command and its confirmation take twice this long.'],
    'link-budget': ['Link budget', 'An accounting of every gain and loss between transmitter and receiver (in decibels) that sets how fast data can flow. Received power falls with the square of distance.'],
    'dbi': ['dBi', 'Antenna gain in decibels relative to an ideal omnidirectional antenna. +10 dB = 10× more power focused toward the target.'],
    'ebn0': ['Eb/N0', 'Energy per bit divided by noise density — how clearly each bit stands out from noise. Modern error-correcting codes need only ~1 dB.'],
    'dsn': ['Deep Space Network', 'NASA\'s worldwide network of large radio antennas (in California, Spain and Australia) that communicate with distant spacecraft. In this game, ground-station time is a simplified, generic model.'],
    'mli': ['Multi-layer insulation (MLI)', 'Blankets of many thin, reflective layers separated by vacuum that block radiative heat transfer — the gold foil on many spacecraft.'],
    'radiator': ['Radiator', 'A surface that sheds waste heat to space as infrared radiation, following the Stefan–Boltzmann law (P = εσAT⁴).'],
    'louver': ['Thermal louvers', 'Venetian-blind-like shutters over a radiator that close when cold, reducing heat loss without spending heater power.'],
    'dod': ['Depth of discharge (DoD)', 'Fraction of battery capacity used per cycle. Deeper cycles shorten battery life, so long LEO missions often stay at 20–30% DoD.'],
    'eclipse': ['Eclipse', 'Time spent in a planet\'s shadow. Solar arrays produce nothing; the battery must carry the load.'],
    'rtg': ['Radioisotope power', 'Generators that convert heat from decaying plutonium-238 into electricity. They work in darkness and far from the Sun; output declines slowly over years.'],
    'inverse-square': ['Inverse-square law', 'Sunlight intensity falls with the square of distance: at 5.2 AU (Jupiter) it is 1/27 of Earth\'s.'],
    'mppt': ['Maximum power point tracking', 'Electronics that continuously adjust a solar array\'s operating voltage to extract its maximum power as light and temperature change.'],
    'reaction-wheel': ['Reaction wheel', 'A motor-driven flywheel. Spinning it one way rotates the spacecraft the other way — precise attitude control without propellant.'],
    'star-tracker': ['Star tracker', 'A camera that recognises star patterns to determine the spacecraft\'s orientation very precisely.'],
    'rad-hard': ['Radiation hardening', 'Designing electronics to tolerate radiation: total ionizing dose (TID, in krad) and single-event upsets (bit flips from individual particles).'],
    'seu': ['Single-event upset', 'A bit flip caused by one energetic particle striking a chip. Usually fixed by a reboot or error-correcting memory.'],
    'aerobraking': ['Aerobraking', 'Dipping repeatedly into a planet\'s upper atmosphere so drag lowers the orbit, saving propellant. Used at Mars by several orbiters.'],
    'orbit-insertion': ['Orbit insertion', 'The braking burn that converts an arriving hyperbolic flyby trajectory into a captured orbit.'],
    'sso': ['Sun-synchronous orbit', 'A near-polar orbit whose plane precesses ~1°/day (driven by Earth\'s equatorial bulge) so it keeps the same angle to the Sun all year.'],
    'terminator-orbit': ['Terminator orbit', 'An orbit above the day–night boundary of a small body. It avoids eclipses and is stabilised against solar radiation pressure.'],
    'mass-margin': ['Mass margin', 'Unused launch capability. Designs grow as they mature, so early-phase projects keep large margins (often 20–30%).'],
    'power-margin': ['Power margin', 'How much generated power exceeds demand in the worst case (end of life, farthest from the Sun, during eclipse recharge).'],
    'tcm': ['Trajectory correction maneuver', 'Small burns during cruise to fix accumulated errors in the path. Errors grow over time, so early corrections are cheaper.'],
    'safe-mode': ['Safe mode', 'A protective state the spacecraft enters after a fault: non-essential systems off, arrays to the Sun, waiting for instructions from Earth.'],
    'conjunction': ['Solar conjunction', 'When the Sun passes between Earth and the spacecraft. Solar plasma scrambles radio signals, so missions pause commanding for ~2 weeks.'],
    'fairing': ['Payload fairing', 'The nose cone that protects the spacecraft during ascent. The spacecraft (with folded arrays and antennas) must fit inside its diameter.'],
    'reliability': ['Reliability', 'Probability that a component works for a given time. A system of many parts in series has a reliability equal to the product of its parts.'],
    'lilt': ['LILT effect', 'Low-intensity, low-temperature: far from the Sun, solar cells lose efficiency beyond the inverse-square drop unless specially designed.'],
    'edelbaum': ['Edelbaum approximation', 'Estimate of low-thrust Δv between circular orbits: Δv ≈ √(v₁² + v₂² − 2v₁v₂cos(πΔi/2)).'],
    'kepler': ['Kepler\'s equation', 'M = E − e·sin E. Links time along an elliptical orbit (mean anomaly M) to position (eccentric anomaly E).'],
    'downlink': ['Downlink', 'Data sent from the spacecraft to Earth. Science only counts once it is safely downlinked.'],
    'ops': ['Mission operations', 'The team, ground antennas and facilities that fly the spacecraft after launch — a significant ongoing cost.'],
  };

  // ---------------------------------------------------------------- references (REAL sources used to ground models)
  ORB.REFERENCES = [
    { t: 'Basics of Space Flight', a: 'NASA Jet Propulsion Laboratory', u: 'https://science.nasa.gov/learn/basics-of-space-flight/', use: 'Orbits, trajectories, gravity assists, telecommunications, spacecraft subsystems' },
    { t: 'Planetary Fact Sheets', a: 'NASA Space Science Data Coordinated Archive (NSSDCA)', u: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/', use: 'Gravitational parameters, radii, orbital elements of Earth, Moon, Mars, Jupiter' },
    { t: 'Beginner\'s Guide to Rockets', a: 'NASA Glenn Research Center', u: 'https://www.grc.nasa.gov/www/k-12/rocket/', use: 'Specific impulse, thrust and the rocket equation' },
    { t: 'NASA Systems Engineering Handbook (SP-2016-6105 Rev 2)', a: 'NASA', u: 'https://www.nasa.gov/reference/systems-engineering-handbook/', use: 'Mission lifecycle, design reviews, technical margins' },
    { t: 'DSN Telecommunications Link Design Handbook (810-005)', a: 'NASA JPL Deep Space Network', u: 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/', use: 'Link budget structure, X/Ka-band characteristics, ground antenna performance' },
    { t: 'State-of-the-Art of Small Spacecraft Technology', a: 'NASA Small Spacecraft Systems Virtual Institute', u: 'https://www.nasa.gov/smallsat-institute/sst-soa/', use: 'Typical subsystem performance: power, propulsion, ADCS, thermal, C&DH' },
    { t: 'Radioisotope Power Systems', a: 'NASA Science Mission Directorate', u: 'https://science.nasa.gov/planetary-science/programs/radioisotope-power-systems/', use: 'MMRTG output (~110 W) and mass class' },
    { t: 'Orbital Debris Program Office', a: 'NASA Johnson Space Center', u: 'https://orbitaldebris.jsc.nasa.gov/', use: 'Debris mitigation and post-mission disposal' },
    { t: 'Juno mission', a: 'NASA', u: 'https://science.nasa.gov/mission/juno/', use: 'Validation case: Jupiter orbit insertion and polar-orbit radiation strategy' },
    { t: 'New Horizons mission', a: 'NASA', u: 'https://science.nasa.gov/mission/new-horizons/', use: 'Validation case: Jupiter gravity assist, RTG power, slow deep-space downlink' },
    { t: 'Dawn mission', a: 'NASA', u: 'https://science.nasa.gov/mission/dawn/', use: 'Ion propulsion for asteroid-belt rendezvous' },
    { t: 'Mars Reconnaissance Orbiter', a: 'NASA', u: 'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/', use: 'Aerobraking and high-rate Mars telecommunications' },
    { t: 'Space Mission Engineering: The New SMAD', a: 'Wertz, Everett & Puschell (eds.), Microcosm Press, 2011', u: '', use: 'Solar-array sizing equation, thermal balance, link budgets (textbook)' },
    { t: 'Orbital Mechanics for Engineering Students', a: 'H. D. Curtis, Elsevier', u: '', use: 'Patched conics, Kepler\'s equation, capture Δv (textbook)' },
  ];
})();
