/* ORBITAL — procedural art: spacecraft, planets, patches, orbital maps */
(function () {
  const ORB = window.ORB;
  const A = (ORB.art = {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let uid = 0;

  A.logo = (size = 30) => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fd8ff"/><stop offset="1" stop-color="#a184ff"/></linearGradient></defs>
    <circle cx="20" cy="20" r="7" fill="url(#lg1)"/><ellipse cx="20" cy="20" rx="17" ry="7.5" fill="none" stroke="url(#lg1)" stroke-width="1.6" transform="rotate(-28 20 20)"/>
    <circle cx="34.2" cy="12.6" r="2.4" fill="#fff"/></svg>`;

  /* ---------------------------------------------------------------- planets (SVG) */
  A.planet = (kind, size = 120, id) => {
    const k = id || 'p' + uid++;
    const defs = {
      earth: ['#7fd0ff', '#2a6fd6', '#0b2c66'], moon: ['#f0f0f4', '#a7a7b2', '#3d3d48'], mars: ['#ffb08a', '#d2552f', '#5a1c10'],
      jupiter: ['#f5dfc0', '#c9a27a', '#5e4128'], asteroid: ['#d8ccb6', '#8f7f69', '#3a3128'], kbo: ['#f0b9a0', '#b46a55', '#4a2420'], sun: ['#fff6d0', '#ffcf5a', '#ff8a1f'],
    }[kind] || ['#ccc', '#777', '#333'];
    let extra = '';
    if (kind === 'earth') extra = `<path d="M30 46c10-8 22-6 28 2s-4 16 4 22-6 10-14 6-20-6-20-16 2-14 2-14z" fill="#3ccf8e" opacity=".75"/><path d="M70 30c8 2 16 8 12 16s-12 2-14-4 2-12 2-12z" fill="#3ccf8e" opacity=".7"/><path d="M64 78c6-2 12 2 10 8s-10 4-12 0z" fill="#3ccf8e" opacity=".6"/><ellipse cx="50" cy="14" rx="18" ry="5" fill="#fff" opacity=".7"/><path d="M20 60c10 4 30 2 40-6" stroke="#fff" stroke-width="3" opacity=".35" fill="none"/>`;
    if (kind === 'moon') extra = [[34, 36, 8], [62, 30, 5], [58, 62, 10], [32, 66, 6], [74, 52, 4], [46, 48, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000" opacity=".16"/><circle cx="${x - 1}" cy="${y - 1}" r="${r * 0.8}" fill="#fff" opacity=".05"/>`).join('');
    if (kind === 'mars') extra = `<ellipse cx="50" cy="9" rx="13" ry="3.5" fill="#fff" opacity=".8"/><path d="M8 56 C 24 50 30 64 48 58 S 74 46 92 54 L 92 66 C 74 60 62 72 46 70 S 22 66 8 70 Z" fill="#7a2a16" opacity=".32"/><path d="M58 24 c6 -2 14 2 12 7 s -10 3 -14 0 z" fill="#7a2a16" opacity=".25"/><path d="M20 30 c5 -3 9 0 8 4 s -7 3 -9 1 z" fill="#7a2a16" opacity=".22"/>`;
    if (kind === 'jupiter') extra = [18, 30, 40, 52, 62, 74, 84].map((y, i) => `<rect x="0" y="${y}" width="100" height="${i % 2 ? 6 : 4}" fill="${i % 2 ? '#a5704a' : '#fff3df'}" opacity=".45"/>`).join('') + `<ellipse cx="64" cy="62" rx="8" ry="4.5" fill="#c4512f" opacity=".75"/>`;
    if (kind === 'sun') extra = '';
    const body = kind === 'asteroid'
      ? `<path d="M22 38 L40 18 L66 20 L84 40 L80 66 L60 84 L32 80 L16 60 Z" fill="url(#g${k})"/><circle cx="44" cy="40" r="5" fill="#000" opacity=".2"/><circle cx="62" cy="60" r="7" fill="#000" opacity=".18"/><circle cx="34" cy="62" r="3" fill="#000" opacity=".2"/>`
      : kind === 'kbo'
        ? `<g filter="url(#f${k})"><circle cx="36" cy="54" r="20" fill="url(#g${k})"/><circle cx="64" cy="44" r="26" fill="url(#g${k})"/></g>`
        : `<circle cx="50" cy="50" r="44" fill="url(#g${k})"/><g clip-path="url(#c${k})">${extra}</g><circle cx="50" cy="50" r="44" fill="url(#s${k})"/>`;
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs>
      <radialGradient id="g${k}" cx="35%" cy="32%" r="75%"><stop offset="0" stop-color="${defs[0]}"/><stop offset=".55" stop-color="${defs[1]}"/><stop offset="1" stop-color="${defs[2]}"/></radialGradient>
      <radialGradient id="s${k}" cx="30%" cy="28%" r="80%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
      <clipPath id="c${k}"><circle cx="50" cy="50" r="44"/></clipPath><filter id="f${k}"><feGaussianBlur stdDeviation=".3"/></filter></defs>
      ${kind === 'earth' ? '<circle cx="50" cy="50" r="48" fill="#4fb4ff" opacity=".18"/>' : ''}${kind === 'sun' ? '<circle cx="50" cy="50" r="50" fill="#ffcf5a" opacity=".2"/>' : ''}${body}</svg>`;
  };
  A.destKind = (m) => ({ eo: 'earth', moon: 'moon', mars: 'mars', asteroid: 'asteroid', jupiter: 'jupiter', kbo: 'kbo' }[m.id] || 'earth');

  /* ---------------------------------------------------------------- mission card art (animated SVG) */
  A.missionArt = (m) => {
    const kind = A.destKind(m);
    const color = m.color;
    return `<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <defs><radialGradient id="mb${m.id}" cx="70%" cy="50%" r="70%"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="#02050c" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="150" fill="#040a17"/><rect width="400" height="150" fill="url(#mb${m.id})"/>
      ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 150}" r="${(i % 3) * 0.4 + 0.4}" fill="#fff" opacity="${0.2 + (i % 5) * 0.12}"/>`).join('')}
      <g transform="translate(250 22)">${A.planet(kind, 106, 'card' + m.id).replace('<svg', '<svg x="0" y="0"')}</g>
      <g style="transform-origin:303px 75px;animation:spin ${18 + m.difficulty * 4}s linear infinite">
        <ellipse cx="303" cy="75" rx="${kind === 'jupiter' ? 90 : 78}" ry="26" fill="none" stroke="${color}" stroke-opacity=".5" stroke-dasharray="3 4"/>
      </g>
      <g><circle r="3.4" fill="#fff"><animateMotion dur="${9 + m.difficulty * 2}s" repeatCount="indefinite" path="M${303 - 78},75 a78,26 0 1,0 156,0 a78,26 0 1,0 -156,0"/></circle></g>
      <path d="M20 128 Q 140 30 230 70" fill="none" stroke="${color}" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="2 5"/></svg>`;
  };

  /* ---------------------------------------------------------------- mission patch */
  A.patch = (m, size = 150) => {
    const k = 'pt' + uid++;
    const kind = A.destKind(m);
    return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" class="patch" aria-hidden="true"><defs>
      <linearGradient id="${k}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.color}"/><stop offset="1" stop-color="#a184ff"/></linearGradient>
      <radialGradient id="${k}b" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#132a52"/><stop offset="1" stop-color="#050b18"/></radialGradient>
      <path id="${k}t" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0"/></defs>
      <circle cx="100" cy="100" r="96" fill="url(#${k}r)"/><circle cx="100" cy="100" r="90" fill="url(#${k}b)"/>
      <circle cx="100" cy="100" r="64" fill="none" stroke="${m.color}" stroke-opacity=".5"/>
      ${Array.from({ length: 14 }, (_, i) => `<circle cx="${60 + ((i * 37) % 80)}" cy="${55 + ((i * 23) % 90)}" r="${(i % 3) * 0.5 + 0.6}" fill="#fff" opacity=".8"/>`).join('')}
      <g transform="translate(70 70) scale(.6)">${A.planet(kind, 100, k + 'p').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>
      <ellipse cx="100" cy="100" rx="58" ry="18" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.5" transform="rotate(-24 100 100)"/>
      <circle cx="150" cy="78" r="4" fill="#fff"/>
      <text font-family="Space Grotesk, sans-serif" font-size="15" font-weight="700" letter-spacing="4" fill="#fff"><textPath href="#${k}t" startOffset="25%" text-anchor="middle">${m.name}</textPath></text>
      <text x="100" y="178" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" letter-spacing="3" fill="#cfe6ff" opacity=".8">OXD · ${m.category.toUpperCase()}</text></svg>`;
  };

  /* ---------------------------------------------------------------- spacecraft illustration */
  A.spacecraft = (d, ev, opts = {}) => {
    const k = 'sc' + uid++;
    const p = ev.parts;
    const st = opts.state || null;
    const cx = 0, cy = 0;
    const L = ev.mass.L;
    const bw = 44 + L * 16, bh = bw * 0.82, dx = bw * 0.5, dy = -bw * 0.32;
    const gold = p.insulation.id === 'mli30' ? ['#ffe08a', '#d4a43c', '#8c6420'] : ['#efc66a', '#b88a32', '#6e4e1c'];
    const isCF = p.structure.id === 'cfrp', isR = p.structure.id === 'reinforced';
    const parts = []; const front = []; const back = [];
    let minX = -bw - 20, maxX = bw + dx + 20, minY = -bh + dy - 20, maxY = bh + 30;
    const ext = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    const health = (id) => (st && st.inst && st.inst[id] ? (st.inst[id].failed ? 'fail' : st.inst[id].health < 0.6 ? 'deg' : st.inst[id].on ? 'on' : 'off') : 'on');
    const instColor = (id) => ({ fail: '#ff5c7a', deg: '#ffc24d', off: '#5d7192', on: null }[health(id)]);

    // solar arrays
    const area = p.solar.id === 'none' ? 0 : d.solarArea;
    if (area > 0) {
      const flex = p.solar.id === 'flex';
      const ph = flex ? 34 : 42 + Math.min(20, area * 0.4);
      const len = clamp(Math.sqrt(area) * (flex ? 46 : 36), 40, 380);
      const cell = p.solar.id === 'si' ? ['#3b2f7a', '#1c1640'] : ['#2b5fc4', '#0d2257'];
      const ah = st ? clamp(st.arrayHealth ?? 1, 0, 1) : 1;
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -bw - 14 : bw + dx * 0.5 + 14;
        const yoke = `<line x1="${side < 0 ? -bw : bw + dx * 0.5}" y1="${dy * 0.3}" x2="${x0}" y2="${dy * 0.3}" stroke="#9aa7bd" stroke-width="3"/>`;
        let wing = '';
        const xs = side < 0 ? x0 - len : x0;
        const nPan = flex ? 1 : Math.max(1, Math.round(len / 58));
        const pw = len / nPan;
        for (let i = 0; i < nPan; i++) {
          const px = xs + i * pw;
          const dead = side > 0 && ah < 0.75 && i >= nPan * (ah / 0.75);
          wing += `<g transform="skewY(${side * -4})"><rect x="${px + 1}" y="${dy * 0.3 - ph / 2}" width="${pw - 2}" height="${ph}" rx="2" fill="url(#${k}cell)" stroke="#8fb3ff" stroke-opacity=".5" ${dead ? 'opacity=".35"' : ''}/>
            ${Array.from({ length: Math.floor(pw / 9) }, (_, j) => `<line x1="${px + 4 + j * 9}" y1="${dy * 0.3 - ph / 2 + 2}" x2="${px + 4 + j * 9}" y2="${dy * 0.3 + ph / 2 - 2}" stroke="#9fc0ff" stroke-opacity=".18"/>`).join('')}
            <line x1="${px + 1}" y1="${dy * 0.3}" x2="${px + pw - 1}" y2="${dy * 0.3}" stroke="#9fc0ff" stroke-opacity=".25"/></g>`;
        }
        if (flex) wing += `<rect x="${side < 0 ? xs - 8 : xs + len}" y="${dy * 0.3 - ph / 2 - 3}" width="8" height="${ph + 6}" rx="4" fill="#c9d3e3"/>`;
        back.push(yoke + wing);
        ext(side < 0 ? xs - 10 : xs + len + 10, dy * 0.3 - ph);
        ext(side < 0 ? xs - 10 : xs + len + 10, dy * 0.3 + ph);
      }
      parts.push(`<linearGradient id="${k}cell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cell[0]}"/><stop offset=".5" stop-color="${cell[1]}"/><stop offset="1" stop-color="${cell[0]}"/></linearGradient>`);
    }
    // RTGs
    for (let i = 0; i < d.rtgCount; i++) {
      const x = -bw * 0.6 - 30 - i * 26, y = bh + 18 + i * 10;
      back.push(`<line x1="${-bw * 0.6}" y1="${bh * 0.6}" x2="${x + 8}" y2="${y}" stroke="#7c879a" stroke-width="3"/>
        <g transform="translate(${x} ${y}) rotate(-35)"><rect x="-10" y="-22" width="20" height="44" rx="4" fill="#4a5262" stroke="#9aa3b5"/>
        ${[-16, -8, 0, 8, 16].map((yy) => `<rect x="-16" y="${yy - 1}" width="32" height="2.5" fill="#6b7486"/>`).join('')}<circle cx="0" cy="0" r="4" fill="#ff8a3d" opacity=".55"><animate attributeName="opacity" values=".3;.7;.3" dur="3s" repeatCount="indefinite"/></circle></g>`);
      ext(x - 30, y + 30);
    }
    // magnetometer boom
    if (d.instruments.includes('mag')) {
      const c = instColor('mag') || '#cfd8e6';
      back.push(`<line x1="${-bw * 0.4}" y1="${-bh + dy}" x2="${-bw - 120}" y2="${-bh + dy - 80}" stroke="#aab4c6" stroke-width="2"/><circle cx="${-bw - 120}" cy="${-bh + dy - 80}" r="6" fill="${c}"/>`);
      ext(-bw - 132, -bh + dy - 92);
    }
    // bus
    const busFill = isCF ? ['#3a4152', '#232836', '#14171f'] : gold;
    parts.push(`<linearGradient id="${k}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${busFill[0]}"/><stop offset=".55" stop-color="${busFill[1]}"/><stop offset="1" stop-color="${busFill[2]}"/></linearGradient>
      <linearGradient id="${k}top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${busFill[0]}"/><stop offset="1" stop-color="${busFill[1]}"/></linearGradient>
      <linearGradient id="${k}dish" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#c9d4e4"/><stop offset="1" stop-color="#7d8aa0"/></linearGradient>
      <radialGradient id="${k}glow"><stop offset="0" stop-color="#7fd8ff" stop-opacity=".9"/><stop offset="1" stop-color="#7fd8ff" stop-opacity="0"/></radialGradient>`);
    const bus = `<polygon points="${-bw},${-bh} ${bw},${-bh} ${bw + dx},${-bh + dy} ${-bw + dx},${-bh + dy}" fill="url(#${k}top)" stroke="#000" stroke-opacity=".25"/>
      <polygon points="${bw},${-bh} ${bw + dx},${-bh + dy} ${bw + dx},${bh + dy} ${bw},${bh}" fill="url(#${k}gold)" opacity=".8" stroke="#000" stroke-opacity=".25"/>
      <rect x="${-bw}" y="${-bh}" width="${2 * bw}" height="${2 * bh}" fill="url(#${k}gold)" stroke="${isR ? '#d9dee8' : '#000'}" stroke-opacity="${isR ? 0.7 : 0.3}" stroke-width="${isR ? 3 : 1}"/>
      ${!isCF ? Array.from({ length: 7 }, (_, i) => `<path d="M${-bw + 6} ${-bh + 10 + i * (2 * bh - 20) / 6} q ${bw * 0.5} ${(i % 2 ? 6 : -6)} ${bw} 0 t ${bw - 12} 0" stroke="#fff" stroke-opacity=".12" fill="none"/>`).join('') : `<rect x="${-bw + 10}" y="${-bh + 10}" width="${bw - 14}" height="${bh - 14}" fill="${gold[1]}" opacity=".7"/>`}
      ${isR ? `<rect x="${-bw + 8}" y="${-bh + 8}" width="${2 * bw - 16}" height="${2 * bh - 16}" fill="none" stroke="#d9dee8" stroke-opacity=".35" stroke-dasharray="4 3"/>` : ''}
      ${d.shielding > 0 ? `<text x="${-bw + 10}" y="${bh - 10}" font-family="JetBrains Mono" font-size="9" fill="#fff" opacity=".55">VAULT ${d.shielding}mm</text>` : ''}`;
    // radiator on side face
    const ra = clamp(d.radiatorArea, 0.1, 6);
    const rh = clamp(ra * 24, 14, 2 * bh - 12);
    const rad = `<polygon points="${bw + 4},${-rh / 2 + 6} ${bw + dx - 4},${-rh / 2 + dy + 6} ${bw + dx - 4},${rh / 2 + dy} ${bw + 4},${rh / 2}" fill="#eef3fa" stroke="#9aa7bd"/>
      ${Array.from({ length: Math.max(2, Math.round(rh / 9)) }, (_, i) => { const y = -rh / 2 + 8 + i * 9; return y < rh / 2 ? `<line x1="${bw + 6}" y1="${y}" x2="${bw + dx - 6}" y2="${y + dy}" stroke="#9aa7bd" stroke-opacity=".6"/>` : ''; }).join('')}
      ${p.thermalCtrl.id !== 'passive' ? `<polygon points="${bw + 4},${-rh / 2 + 6} ${bw + dx - 4},${-rh / 2 + dy + 6} ${bw + dx - 4},${-rh / 2 + dy + 12} ${bw + 4},${-rh / 2 + 12}" fill="#7f8ba0"/>` : ''}`;
    // antenna
    let ant = '';
    const topY = -bh + dy * 0.5;
    if (p.antenna.D > 0) {
      const R = 16 + p.antenna.D * 30;
      const ay = topY - 22 - R * 0.35;
      ant = `<line x1="${dx * 0.5}" y1="${topY}" x2="${dx * 0.5}" y2="${ay + R * 0.25}" stroke="#aab4c6" stroke-width="4"/>
        <ellipse cx="${dx * 0.5}" cy="${ay}" rx="${R}" ry="${R * 0.38}" fill="url(#${k}dish)" stroke="#fff" stroke-opacity=".8"/>
        <ellipse cx="${dx * 0.5}" cy="${ay - 2}" rx="${R * 0.82}" ry="${R * 0.28}" fill="#000" opacity=".08"/>
        <line x1="${dx * 0.5 - R * 0.6}" y1="${ay}" x2="${dx * 0.5}" y2="${ay - R * 0.55}" stroke="#c9d4e4" stroke-width="1.2"/><line x1="${dx * 0.5 + R * 0.6}" y1="${ay}" x2="${dx * 0.5}" y2="${ay - R * 0.55}" stroke="#c9d4e4" stroke-width="1.2"/>
        <circle cx="${dx * 0.5}" cy="${ay - R * 0.55}" r="${3 + R * 0.04}" fill="#e8eef8"/>
        ${p.band.id === 'ka' ? `<circle cx="${dx * 0.5}" cy="${ay - R * 0.55}" r="2" fill="#a184ff"/>` : ''}`;
      ext(dx * 0.5 - R - 6, ay - R * 0.6 - 10); ext(dx * 0.5 + R + 6, ay - R * 0.6);
    } else ant = `<rect x="${dx * 0.5 - 3}" y="${topY - 26}" width="6" height="26" fill="#c9d4e4"/><circle cx="${dx * 0.5}" cy="${topY - 28}" r="5" fill="#e8eef8"/>`;
    // star trackers
    const trackers = p.acs.id === 'precision' ? `<g fill="#20242c" stroke="#8a95a8"><polygon points="${-bw + 14},${-bh} ${-bw + 8},${-bh - 16} ${-bw + 26},${-bh - 16} ${-bw + 20},${-bh}"/><polygon points="${-bw + 36},${-bh} ${-bw + 30},${-bh - 14} ${-bw + 46},${-bh - 14} ${-bw + 42},${-bh}"/></g>` : '';
    // engine
    let eng = '';
    const ey = bh;
    if (p.engine.type === 'ep') {
      eng = `<rect x="${-14}" y="${ey}" width="28" height="10" fill="#6f7a8e"/><ellipse cx="0" cy="${ey + 14}" rx="${p.engine.id === 'ion' ? 22 : 18}" ry="7" fill="#2a3242" stroke="#9aa7bd"/>
        <ellipse cx="0" cy="${ey + 14}" rx="${p.engine.id === 'ion' ? 18 : 9}" ry="5" fill="${p.engine.id === 'ion' ? 'url(#' + k + 'glow)' : '#2a3242'}" stroke="#7fd8ff" stroke-opacity=".7"/>
        <ellipse cx="0" cy="${ey + 34}" rx="16" ry="22" fill="url(#${k}glow)" opacity=".5"><animate attributeName="opacity" values=".25;.6;.25" dur="2.4s" repeatCount="indefinite"/></ellipse>`;
      ext(0, ey + 60);
    } else {
      const s = p.engine.id === 'biprop' ? 1.3 : 0.9;
      eng = `<rect x="${-10 * s}" y="${ey}" width="${20 * s}" height="${8 * s}" fill="#7d889c"/><path d="M${-7 * s} ${ey + 8 * s} L${-16 * s} ${ey + 34 * s} L${16 * s} ${ey + 34 * s} L${7 * s} ${ey + 8 * s} Z" fill="url(#${k}dish)" stroke="#5d6678"/>`;
      ext(0, ey + 40 * s);
    }
    // instruments on the front face
    const slots = d.instruments.filter((id) => id !== 'mag');
    let ix = -bw + 18;
    slots.forEach((id, i) => {
      const c = instColor(id);
      const y = bh - 2;
      const xx = -bw + 14 + (i + 0.5) * ((2 * bw - 28) / Math.max(1, slots.length));
      let g = '';
      if (id === 'cam') g = `<rect x="-10" y="0" width="20" height="16" rx="2" fill="#2b2f38"/><circle cx="0" cy="18" r="8" fill="#111" stroke="${c || '#7fd8ff'}" stroke-width="2"/><circle cx="-2" cy="16" r="2.5" fill="#7fd8ff" opacity=".8"/>`;
      if (id === 'irspec') g = `<rect x="-11" y="0" width="22" height="20" rx="2" fill="#30353f" stroke="${c || '#c08bff'}"/><rect x="-7" y="14" width="14" height="5" fill="#111"/>`;
      if (id === 'radar') g = `<rect x="-30" y="2" width="60" height="9" rx="1" fill="#d7dde8" stroke="${c || '#9aa7bd'}"/>${Array.from({ length: 6 }, (_, j) => `<line x1="${-27 + j * 10}" y1="3" x2="${-27 + j * 10}" y2="10" stroke="#8a95a8"/>`).join('')}`;
      if (id === 'atmo') g = `<rect x="-9" y="0" width="18" height="18" rx="2" fill="#2f3440" stroke="${c || '#4fd8ff'}"/><rect x="-6" y="7" width="12" height="2" fill="#4fd8ff"/>`;
      if (id === 'rad') g = `<rect x="-7" y="0" width="14" height="14" rx="2" fill="#3b3f4a" stroke="${c || '#ffc24d'}"/><circle cx="0" cy="7" r="3" fill="${c || '#ffc24d'}"/>`;
      if (id === 'grs') g = `<line x1="0" y1="0" x2="0" y2="22" stroke="#aab4c6" stroke-width="2"/><rect x="-7" y="20" width="14" height="18" rx="6" fill="#c9d3e3" stroke="${c || '#3ee6a0'}"/>`;
      if (id === 'particle') g = `<rect x="-8" y="0" width="16" height="14" fill="#353a45" stroke="${c || '#a184ff'}"/><path d="M-8 14 L-14 22 L14 22 L8 14 Z" fill="#20242c" stroke="${c || '#a184ff'}"/>`;
      if (id === 'uvs') g = `<rect x="-6" y="0" width="12" height="26" rx="5" fill="#cfd8e6" stroke="${c || '#4d8dff'}"/><circle cx="0" cy="25" r="4" fill="#111"/>`;
      if (id === 'lidar') g = `<rect x="-8" y="0" width="16" height="20" rx="3" fill="#cfd8e6"/><circle cx="0" cy="20" r="6" fill="#111" stroke="${c || '#ff5c7a'}"/><circle cx="0" cy="20" r="2" fill="#ff5c7a"><animate attributeName="opacity" values="1;.2;1" dur="1.2s" repeatCount="indefinite"/></circle>`;
      front.push(`<g transform="translate(${xx} ${y})" ${c === '#5d7192' ? 'opacity=".55"' : ''}>${g}<title>${ORB.INSTRUMENT_BY_ID[id].name}</title></g>`);
      ext(xx - 32, y + 42);
    });
    // thrusters at corners
    const rcs = [[-bw, -bh], [bw, -bh], [-bw, bh], [bw, bh]].map(([x, y]) => `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="#8a95a8"/>`).join('');

    const pad = 14;
    const vb = [minX - pad, minY - pad - 10, maxX - minX + 2 * pad, maxY - minY + 2 * pad + 10];
    return `<svg viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Spacecraft configuration"><defs>${parts.filter((x) => x.startsWith('<linear') || x.startsWith('<radial') || x.includes('Gradient')).join('')}</defs>
      <g class="craft-float">${back.join('')}${rad}${bus}${trackers}${ant}${eng}${rcs}${front.join('')}</g></svg>`;
  };

  /* ---------------------------------------------------------------- orbital map renderer (canvas) */
  const glowDot = (ctx, x, y, r, color, glow = 12) => { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = glow; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.restore(); };
  const label = (ctx, text, x, y, color = '#9fb3d1', align = 'left') => { ctx.save(); ctx.font = '11px JetBrains Mono, monospace'; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y); ctx.restore(); };
  const ship = (ctx, x, y, ang, t) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const pulse = 1 + 0.25 * Math.sin(t * 5);
    ctx.shadowColor = '#4fd8ff'; ctx.shadowBlur = 16 * pulse; ctx.fillStyle = '#e9fbff';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, 5); ctx.lineTo(-2, 0); ctx.lineTo(-5, -5); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  A.drawHelio = (ctx, w, h, M, t) => {
    // M: {orbits:[{r,color,label}], maxR, sqrt, path:[{x,y}], pathSplit, sc:{x,y,ang}, earth:{x,y}, target:{x,y,color,label}, extra:[{x,y,color,label,r}], comm, conj}
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 22;
    const map = (r) => (M.sqrt ? R * Math.sqrt(r / M.maxR) : (R * r) / M.maxR);
    const P = (x, y) => { const r = Math.hypot(x, y); const s = r > 0 ? map(r) / r : 0; return [cx + x * s, cy - y * s]; };
    ctx.clearRect(0, 0, w, h);
    // faint radial grid
    ctx.strokeStyle = 'rgba(120,170,230,.06)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, 6.283); ctx.stroke(); }
    for (let a = 0; a < 6.283; a += Math.PI / 6) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); ctx.stroke(); }
    // sun
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34); g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.25, 'rgba(255,200,90,.9)'); g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, 6.283); ctx.fill();
    glowDot(ctx, cx, cy, 6, '#fff2c4', 24);
    // orbits
    M.orbits.forEach((o) => { ctx.strokeStyle = o.color + '66'; ctx.lineWidth = 1.2; ctx.setLineDash(o.dash || []); ctx.beginPath(); ctx.arc(cx, cy, map(o.r), 0, 6.283); ctx.stroke(); ctx.setLineDash([]); if (o.label) label(ctx, o.label, cx + map(o.r) * 0.71 + 4, cy - map(o.r) * 0.71 - 4, o.color + 'bb'); });
    // path
    if (M.path && M.path.length > 1) {
      const split = M.pathSplit ?? M.path.length;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(79,216,255,.95)'; ctx.shadowColor = '#4fd8ff'; ctx.shadowBlur = 8;
      ctx.beginPath(); M.path.slice(0, Math.max(1, split + 1)).forEach((p, i) => { const [x, y] = P(p.x, p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      ctx.shadowBlur = 0; ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(161,132,255,.75)';
      ctx.beginPath(); M.path.slice(Math.max(0, split)).forEach((p, i) => { const [x, y] = P(p.x, p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    }
    (M.extra || []).forEach((e) => { const [x, y] = P(e.x, e.y); glowDot(ctx, x, y, e.r || 4, e.color, 8); if (e.label) label(ctx, e.label, x + 8, y - 6, e.color); });
    if (M.target) { const [x, y] = P(M.target.x, M.target.y); glowDot(ctx, x, y, M.target.r || 6, M.target.color, 14); label(ctx, M.target.label, x + 10, y + 4, '#e8f2ff'); }
    if (M.earth) { const [x, y] = P(M.earth.x, M.earth.y); glowDot(ctx, x, y, 5.5, '#4aa3ff', 14); label(ctx, 'Earth', x + 9, y + 14, '#9fd0ff'); }
    if (M.sc) {
      const [x, y] = P(M.sc.x, M.sc.y);
      if (M.comm && M.earth) { const [ex, ey] = P(M.earth.x, M.earth.y); ctx.strokeStyle = M.conj ? 'rgba(255,92,122,.5)' : 'rgba(62,230,160,.45)'; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); }
      ship(ctx, x, y, M.sc.ang ?? 0, t);
    }
    if (M.sqrt) label(ctx, 'radial scale: √r (compressed)', 12, h - 10, '#5d7192');
  };
  A.drawEarthMoon = (ctx, w, h, M, t) => {
    // M: {moonAngle, scR (km), path:[{x,y}] km, split, bltOut}
    const cx = w * (M.bltOut ? 0.62 : 0.5), cy = h / 2;
    const maxR = M.bltOut ? 1.6e6 : 4.3e5;
    const R = Math.min(w, h) / 2 - 18;
    const s = (M.bltOut ? R * 1.25 : R) / maxR;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(200,200,215,.25)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(cx, cy, 384400 * s, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    glowDot(ctx, cx, cy, 9, '#4aa3ff', 18); label(ctx, 'Earth', cx + 12, cy + 18, '#9fd0ff');
    const ma = M.moonAngle;
    const mx = cx + 384400 * s * Math.cos(ma), my = cy - 384400 * s * Math.sin(ma);
    glowDot(ctx, mx, my, 5, '#d8d8e2', 10); label(ctx, 'Moon', mx + 9, my - 8, '#dcdce6');
    if (M.path) {
      ctx.lineWidth = 2;
      const pts = M.path.map((p) => [cx + p.x * s, cy - p.y * s]);
      const sp = M.split ?? pts.length;
      ctx.strokeStyle = '#4fd8ff'; ctx.shadowColor = '#4fd8ff'; ctx.shadowBlur = 6; ctx.beginPath(); pts.slice(0, sp + 1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(161,132,255,.75)'; ctx.beginPath(); pts.slice(sp).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
      if (M.sc) ship(ctx, cx + M.sc.x * s, cy - M.sc.y * s, M.sc.ang || 0, t);
    }
    if (M.bltOut) label(ctx, 'Sun direction ←', 12, 18, '#ffcf5a');
  };
  A.drawLocal = (ctx, w, h, M, t) => {
    // M: {kind, bodyR(px frac), orbit:{a,e,incDeg}, phase(0..1), eclipse, label, flyby}
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * (M.bodyFrac || 0.22);
    // sun direction & shadow
    if (M.eclipse) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(cx, cy - R, w, 2 * R); }
    label(ctx, '☀ Sun ←', 12, 18, '#ffcf5a');
    // body
    const col = { earth: ['#7fd0ff', '#1d56b3'], moon: ['#f0f0f4', '#6d6d78'], mars: ['#ffb08a', '#9c3b1f'], jupiter: ['#f5dfc0', '#8a6440'], asteroid: ['#d8ccb6', '#5a4c3c'], kbo: ['#f0b9a0', '#7a3c30'] }[M.kind] || ['#ccc', '#555'];
    const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.save(); ctx.shadowColor = col[0]; ctx.shadowBlur = 24; ctx.fillStyle = g;
    if (M.kind === 'asteroid') { ctx.beginPath(); [[-0.8, -0.3], [-0.4, -0.85], [0.3, -0.8], [0.85, -0.2], [0.75, 0.5], [0.2, 0.85], [-0.5, 0.75], [-0.9, 0.2]].forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * R, cy + y * R) : ctx.moveTo(cx + x * R, cy + y * R))); ctx.closePath(); ctx.fill(); }
    else if (M.kind === 'kbo') { ctx.beginPath(); ctx.arc(cx - R * 0.35, cy + R * 0.15, R * 0.55, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(cx + R * 0.35, cy - R * 0.1, R * 0.7, 0, 6.283); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill(); }
    ctx.restore();
    if (M.kind === 'jupiter') { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.clip(); for (let i = -4; i <= 4; i++) { ctx.fillStyle = i % 2 ? 'rgba(120,70,40,.28)' : 'rgba(255,240,220,.18)'; ctx.fillRect(cx - R, cy + (i * R) / 5, 2 * R, R / 9); } ctx.restore(); }
    if (M.kind === 'earth') { ctx.strokeStyle = 'rgba(120,200,255,.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, 6.283); ctx.stroke(); ctx.lineWidth = 1; }
    // orbit
    const o = M.orbit;
    if (M.flyby) {
      const off = R * 2.2;
      ctx.strokeStyle = 'rgba(79,216,255,.7)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(cx - w, cy - off * 0.6); ctx.quadraticCurveTo(cx, cy - off * 1.3, cx + w, cy - off * 0.6); ctx.stroke(); ctx.setLineDash([]);
      const f = M.phase; const x = cx - w / 2 + f * w; const yy = cy - off * 0.6 - (1 - Math.pow((x - cx) / (w / 2), 2)) * off * 0.35;
      ship(ctx, x, yy, 0, t);
    } else if (o) {
      const a = R * (o.aFrac || 1.8), b = a * Math.sqrt(1 - Math.min(0.95, o.e || 0) ** 2), tilt = ((o.viewTilt ?? 0.35));
      const ry = b * tilt, focus = a * (o.e || 0);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(o.rot || -0.3);
      ctx.strokeStyle = 'rgba(79,216,255,.65)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(-focus, 0, a, Math.max(ry, 3), 0, 0, 6.283); ctx.stroke();
      const ang = M.phase * 6.283;
      const x = -focus + a * Math.cos(ang), y = Math.max(ry, 3) * Math.sin(ang);
      const behind = Math.sin(ang) < 0 && Math.abs(x) < R && M.kind !== 'asteroid';
      ctx.restore();
      const rot = o.rot || -0.3; const X = cx + x * Math.cos(rot) - y * Math.sin(rot), Y = cy + x * Math.sin(rot) + y * Math.cos(rot);
      if (!behind) ship(ctx, X, Y, ang + Math.PI / 2 + rot, t); else glowDot(ctx, X, Y, 2, 'rgba(79,216,255,.4)', 4);
    }
    if (M.label) label(ctx, M.label, 12, h - 12, '#9fb3d1');
  };
})();
