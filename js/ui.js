/* ORBITAL — UI toolkit: formatting, starfield, tooltips, toasts, modals, charts, gauges */
(function () {
  const ORB = window.ORB;
  const U = (ORB.ui = {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  U.clamp = clamp;
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- formatting */
  U.f = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  U.money = (m) => (Math.abs(m) >= 1000 ? `$${(m / 1000).toFixed(2)} B` : `$${m.toFixed(m < 10 ? 1 : 0)} M`);
  U.pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
  U.kg = (x) => `${U.f(x, x < 100 ? 1 : 0)} kg`;
  U.W = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} kW` : `${x.toFixed(0)} W`);
  U.rate = (bps) => ORB.engine.fmtRate(bps);
  U.dist = (km) => {
    const AU = ORB.CONST.AU_KM;
    if (km > 0.02 * AU) return `${(km / AU).toFixed(km > 10 * AU ? 1 : 2)} AU`;
    if (km > 1e6) return `${(km / 1e6).toFixed(2)} M km`;
    return `${U.f(km)} km`;
  };
  U.dur = (sec) => {
    if (!Number.isFinite(sec)) return '—';
    if (sec < 1) return `${(sec * 1000).toFixed(0)} ms`;
    if (sec < 90) return `${sec.toFixed(1)} s`;
    if (sec < 5400) return `${(sec / 60).toFixed(1)} min`;
    if (sec < 2 * 86400) return `${(sec / 3600).toFixed(1)} h`;
    return `${(sec / 86400).toFixed(1)} d`;
  };
  U.days = (d) => (d >= 730 ? `${(d / 365.25).toFixed(1)} yr` : `${U.f(d, d < 10 ? 1 : 0)} d`);
  U.temp = (K) => `${(K - 273.15).toFixed(0)} °C`;
  U.term = (key, text) => `<span class="term" data-term="${key}">${text}</span>`;
  U.statusClass = (v, okAbove, warnAbove) => (v >= okAbove ? 'good' : v >= warnAbove ? 'warn' : 'bad');

  /* ---------------- starfield */
  U.starfield = (canvas) => {
    const ctx = canvas.getContext('2d');
    let stars = [], w = 0, h = 0, dpr = 1, t = 0, running = true;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.width = window.innerWidth * dpr; h = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
      const n = Math.round((window.innerWidth * window.innerHeight) / 5200);
      stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() ** 3 * 1.6 * dpr + 0.3 * dpr, a: 0.25 + Math.random() * 0.75, tw: Math.random() * 6.28, sp: 0.4 + Math.random() * 1.6, hue: Math.random() < 0.15 ? 200 + Math.random() * 60 : 0 }));
    };
    resize(); window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(draw); });
    let last = 0;
    function draw(ts) {
      if (!running) return;
      if (ts - last > 40) {
        last = ts; t += 0.016;
        ctx.clearRect(0, 0, w, h);
        for (const s of stars) {
          const a = s.a * (0.7 + 0.3 * Math.sin(t * s.sp + s.tw));
          ctx.fillStyle = s.hue ? `hsla(${s.hue},80%,80%,${a})` : `rgba(230,240,255,${a})`;
          s.y += 0.04 * s.r; if (s.y > h) s.y = 0;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  };

  /* ---------------- tooltip (glossary terms) */
  U.initTooltip = () => {
    const tip = document.getElementById('tooltip');
    const show = (el) => {
      const key = el.dataset.term; const g = ORB.GLOSSARY[key];
      const custom = el.dataset.tip;
      if (!g && !custom) return;
      tip.innerHTML = g ? `<b>${g[0]}</b>${g[1]}` : custom;
      const r = el.getBoundingClientRect();
      tip.classList.add('show');
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8);
      let y = r.top - th - 8; if (y < 8) y = r.bottom + 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    const hide = () => tip.classList.remove('show');
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-term],[data-tip]'); if (el) show(el); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-term],[data-tip]')) hide(); });
    document.addEventListener('click', (e) => { const el = e.target.closest('[data-term]'); if (el) { show(el); setTimeout(hide, 4500); } });
    window.addEventListener('scroll', hide, true);
  };

  /* ---------------- toast */
  U.toast = (msg, kind = 'info', icon = '•', ms = 4200) => {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span>${icon}</span><div>${msg}</div>`;
    root.appendChild(el);
    while (root.children.length > 4) root.firstChild.remove();
    setTimeout(() => { el.style.transition = 'opacity .4s, transform .4s'; el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 450); }, ms);
  };

  /* ---------------- modal */
  U.modal = (html, { onClose, dismissable = true } = {}) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-back"></div><div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    root.classList.add('open');
    const close = () => { root.classList.remove('open'); root.innerHTML = ''; onClose && onClose(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape' && dismissable) close(); };
    document.addEventListener('keydown', esc);
    if (dismissable) root.querySelector('.modal-back').addEventListener('click', close);
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    const first = root.querySelector('button'); first && setTimeout(() => first.focus({ preventScroll: true }), 50);
    return { root: root.querySelector('.modal'), close };
  };
  U.confirm = (title, body, okLabel = 'Confirm', danger = false) => new Promise((res) => {
    const m = U.modal(`<div class="modal-h"><div class="modal-ic ${danger ? 'bad' : ''}">${danger ? '⚠' : '?'}</div><div><h3>${title}</h3><div class="muted">${body}</div></div></div>
      <div class="modal-b"><div class="row" style="justify-content:flex-end"><button class="btn" data-x="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="ok">${okLabel}</button></div></div>`, { onClose: () => res(false) });
    m.root.querySelector('[data-x=ok]').onclick = () => { res(true); m.close(); };
    m.root.querySelector('[data-x=no]').onclick = () => { m.close(); };
  });

  /* ---------------- ring gauge */
  U.ring = (val, max = 100, color = 'var(--cyan)', label = '', size = 74) => {
    const r = 30, c = 2 * Math.PI * r, f = clamp(val / max, 0, 1);
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="${r}" fill="none" stroke="rgba(120,170,230,.14)" stroke-width="6"/>
      <circle cx="37" cy="37" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" style="filter:drop-shadow(0 0 6px ${color});transition:stroke-dasharray .5s"/></svg>
      <div class="v" style="font-family:var(--font-display)"><div style="text-align:center">${Math.round(val)}${label ? `<small>${label}</small>` : ''}</div></div></div>`;
  };
  U.bar = (frac, cls = '', markFrac = null) => `<div class="bar ${cls}"><i style="width:${clamp(frac, 0, 1) * 100}%"></i>${markFrac != null ? `<span class="mark" style="left:calc(${clamp(markFrac, 0, 1) * 100}% - 1px)"></span>` : ''}</div>`;
  U.setRange = (input) => { const p = ((input.value - input.min) / (input.max - input.min)) * 100; input.style.setProperty('--p', p + '%'); };

  /* ---------------- canvas helpers */
  U.fitCanvas = (canvas, hCss) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const h = hCss || canvas.clientHeight || 200;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  };

  /* ---------------- line chart with hover readout
   * opts: { x:[], series:[{data:[], color, label, fill, dash, axis:'l'|'r'}], yMin, yMax, yLabel, xLabel, xFmt, yFmt, h, markers:[{x,label,color}], hlines:[{y,label,color}], logY } */
  U.lineChart = (host, opts) => {
    host.classList.add('chart');
    let canvas = host.querySelector('canvas'), tip = host.querySelector('.chart-tip');
    if (!canvas) { canvas = document.createElement('canvas'); host.appendChild(canvas); tip = document.createElement('div'); tip.className = 'chart-tip'; host.appendChild(tip); }
    host._opts = opts;
    const draw = (hoverX) => {
      const o = host._opts;
      const { ctx, w, h } = U.fitCanvas(canvas, o.h || 200);
      ctx.clearRect(0, 0, w, h);
      const padL = 46, padR = o.series.some((s) => s.axis === 'r') ? 46 : 12, padT = 10, padB = 26;
      const X = o.x; if (!X || X.length < 2) { ctx.fillStyle = '#5d7192'; ctx.font = '12px Inter'; ctx.fillText('Awaiting data…', padL, h / 2); return; }
      const xMin = o.xMin ?? X[0], xMax = o.xMax ?? X[X.length - 1];
      const rng = (axis) => {
        const ss = o.series.filter((s) => (s.axis || 'l') === axis); if (!ss.length) return null;
        let mn = axis === 'l' ? o.yMin : o.yMinR, mx = axis === 'l' ? o.yMax : o.yMaxR;
        const vals = ss.flatMap((s) => s.data).filter(Number.isFinite);
        if (mn == null) mn = Math.min(0, ...vals); if (mx == null) mx = Math.max(...vals, mn + 1e-9) * 1.08;
        if (o.logY && axis === 'l') { mn = Math.log10(Math.max(o.yMin || 1e-3, 1e-9)); mx = Math.log10(Math.max(...vals, 1)); mx = Math.ceil(mx); }
        return [mn, mx];
      };
      const rl = rng('l'), rr = rng('r');
      const px = (x) => padL + ((x - xMin) / (xMax - xMin || 1)) * (w - padL - padR);
      const py = (y, r) => { const yy = o.logY && r === rl ? Math.log10(Math.max(y, 1e-9)) : y; return padT + (1 - (yy - r[0]) / (r[1] - r[0] || 1)) * (h - padT - padB); };
      // grid
      ctx.strokeStyle = 'rgba(120,170,230,.09)'; ctx.lineWidth = 1; ctx.fillStyle = '#7f95b6'; ctx.font = '10px JetBrains Mono, monospace';
      for (let i = 0; i <= 4; i++) {
        const y = padT + (i / 4) * (h - padT - padB);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        if (rl) { let v = rl[1] - (i / 4) * (rl[1] - rl[0]); if (o.logY) v = Math.pow(10, v); ctx.textAlign = 'right'; ctx.fillText((o.yFmt || U.short)(v), padL - 6, y + 3); }
        if (rr) { const v = rr[1] - (i / 4) * (rr[1] - rr[0]); ctx.textAlign = 'left'; ctx.fillText((o.yFmtR || U.short)(v), w - padR + 6, y + 3); }
      }
      ctx.textAlign = 'center';
      for (let i = 0; i <= 5; i++) { const xv = xMin + (i / 5) * (xMax - xMin); ctx.fillText((o.xFmt || U.short)(xv), px(xv), h - 8); }
      (o.hlines || []).forEach((l) => { const y = py(l.y, l.axis === 'r' ? rr : rl); ctx.strokeStyle = l.color || 'rgba(255,255,255,.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.setLineDash([]); if (l.label) { ctx.fillStyle = l.color || '#aaa'; ctx.textAlign = 'left'; ctx.fillText(l.label, padL + 4, y - 4); } });
      (o.markers || []).forEach((m) => { if (m.x < xMin || m.x > xMax) return; const x = px(m.x); ctx.strokeStyle = m.color || 'rgba(161,132,255,.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke(); ctx.setLineDash([]); if (m.label) { ctx.save(); ctx.fillStyle = m.color || '#a184ff'; ctx.textAlign = 'left'; ctx.fillText(m.label, x + 4, padT + 10); ctx.restore(); } });
      o.series.forEach((s) => {
        const r = s.axis === 'r' ? rr : rl;
        ctx.beginPath(); let started = false;
        s.data.forEach((v, i) => { if (!Number.isFinite(v)) return; const x = px(X[i]), y = py(v, r); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); });
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; if (s.dash) ctx.setLineDash(s.dash); ctx.shadowColor = s.color; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
        if (s.fill) { ctx.lineTo(px(X[X.length - 1]), py(r[0], r)); ctx.lineTo(px(X[0]), py(r[0], r)); ctx.closePath(); const g = ctx.createLinearGradient(0, padT, 0, h - padB); g.addColorStop(0, s.color + '55'); g.addColorStop(1, s.color + '00'); ctx.fillStyle = g; ctx.fill(); }
      });
      (o.points || []).forEach((p) => { ctx.fillStyle = p.color || '#fff'; ctx.beginPath(); ctx.arc(px(p.x), py(p.y, rl), p.r || 5, 0, 6.283); ctx.fill(); if (p.label) { ctx.textAlign = 'left'; ctx.fillText(p.label, px(p.x) + 8, py(p.y, rl) - 6); } });
      if (o.yLabel) { ctx.save(); ctx.fillStyle = '#7f95b6'; ctx.translate(11, padT + (h - padT - padB) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(o.yLabel, 0, 0); ctx.restore(); }
      if (hoverX != null) {
        const xv = xMin + ((hoverX - padL) / (w - padL - padR)) * (xMax - xMin);
        let i = 0; let best = Infinity; X.forEach((xx, k) => { const dd = Math.abs(xx - xv); if (dd < best) { best = dd; i = k; } });
        const x = px(X[i]);
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
        const lines = [`${o.xName || 'x'}: ${(o.xFmt || U.short)(X[i])}`].concat(o.series.map((s) => `<span style="color:${s.color}">●</span> ${s.label}: ${(s.fmt || o.yFmt || U.short)(s.data[i])}`));
        tip.innerHTML = lines.join('<br>'); tip.style.display = 'block'; tip.style.left = clamp(x, 80, w - 80) + 'px'; tip.style.top = padT + 30 + 'px';
        o.series.forEach((s) => { const r = s.axis === 'r' ? rr : rl; if (!Number.isFinite(s.data[i])) return; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, py(s.data[i], r), 3.5, 0, 6.283); ctx.fill(); });
      } else tip.style.display = 'none';
    };
    if (!host._wired) {
      host._wired = true;
      canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); draw(e.clientX - r.left); });
      canvas.addEventListener('mouseleave', () => draw(null));
      canvas.addEventListener('touchmove', (e) => { const r = canvas.getBoundingClientRect(); draw(e.touches[0].clientX - r.left); }, { passive: true });
    }
    draw(null);
    host._draw = draw;
  };
  U.short = (v) => {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(1) + 'G';
    if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(0) + 'k';
    if (a >= 1000) return (v / 1e3).toFixed(1) + 'k';
    if (a >= 100) return v.toFixed(0);
    if (a >= 10) return v.toFixed(1);
    if (a >= 1) return v.toFixed(2);
    if (a === 0) return '0';
    return v.toPrecision(2);
  };

  /* ---------------- donut */
  U.donut = (parts, size = 160, center = '') => {
    const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
    let a0 = -Math.PI / 2; const R = 64, r = 44, cx = 80, cy = 80;
    const paths = parts.map((p) => {
      const a1 = a0 + (p.v / tot) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const pt = (ang, rad) => `${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`;
      const d = `M${pt(a0, R)} A${R},${R} 0 ${large} 1 ${pt(a1, R)} L${pt(a1, r)} A${r},${r} 0 ${large} 0 ${pt(a0, r)} Z`;
      a0 = a1;
      return `<path d="${d}" fill="${p.c}" stroke="#050b16" stroke-width="1.5"><title>${p.l}: ${p.v.toFixed(0)}</title></path>`;
    }).join('');
    return `<svg viewBox="0 0 160 160" width="${size}" height="${size}">${paths}<text x="80" y="84" text-anchor="middle" fill="#e8f2ff" font-family="Space Grotesk" font-size="15" font-weight="600">${center}</text></svg>`;
  };
  U.PALETTE = ['#4fd8ff', '#4d8dff', '#a184ff', '#c08bff', '#3ee6a0', '#ffc24d', '#ff8a5c', '#ff5c7a', '#7fe3c4', '#9fb6d8'];
})();
