// SIGNAL portfolio: boot, nav, reveals, scramble, role typer, counters, clock, ticker, cursor, tilt,
// skill sphere, code rain, flight captions and the command palette. The 3D scenes live in scene.js.
(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEF$%&';
  const rand = (n) => Math.floor(Math.random() * n);

  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // ---------- Boot sequence (once per session) ----------
  const boot = $('.boot');
  const finishBoot = () => {
    if (!boot || boot.classList.contains('done')) return;
    boot.classList.add('done');
    try { sessionStorage.setItem('signal-booted', '1'); } catch (_) { /* storage may be blocked */ }
    setTimeout(() => root.classList.add('booted'), 600);
  };
  let alreadyBooted = false;
  try { alreadyBooted = sessionStorage.getItem('signal-booted') === '1'; } catch (_) { /* ignore */ }
  if (!boot || reduceMotion || alreadyBooted) {
    root.classList.add('booted');
  } else {
    const log = $('.boot-log', boot);
    const bar = $('.boot-bar', boot);
    const lines = [
      ['> establishing secure session', 'ok'],
      ['> resolving host michealjunior.github.io', 'ok'],
      ['> loading profile ayeni.oluwaferanmi.micheal', 'ok'],
      ['> mounting projects [5/5]', 'ok'],
      ['> calibrating signal: 210 approved / 227', 'ok'],
      ['> access granted', 'hi'],
    ];
    let i = 0;
    const step = () => {
      if (boot.classList.contains('done')) return;
      if (i >= lines.length) { setTimeout(finishBoot, 260); return; }
      const [text, kind] = lines[i];
      const row = document.createElement('span');
      row.innerHTML = `${text} <b class="${kind}">${kind === 'hi' ? '✔' : '[ OK ]'}</b>\n`;
      log.appendChild(row);
      i += 1;
      bar.style.setProperty('--p', `${Math.round((i / lines.length) * 100)}%`);
      setTimeout(step, 150 + rand(90));
    };
    setTimeout(step, 180);
    const skip = () => finishBoot();
    window.addEventListener('keydown', skip, { once: true });
    boot.addEventListener('pointerdown', skip, { once: true });
    setTimeout(finishBoot, 3200); // hard cap
  }

  // ---------- Nav ----------
  const nav = $('.nav');
  const menu = $('.menu');
  const mobileNav = $('#mobile-nav');
  const closeMenu = () => { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Open menu'); mobileNav.hidden = true; };
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.hidden = !open;
  });
  $$('a', mobileNav).forEach((a) => a.addEventListener('click', closeMenu));
  const navLinks = $$('.nav-links a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let activeId = '';

  // ---------- Screenshots: hide a missing image cleanly ----------
  $$('.shot img').forEach((img) => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true }));

  // ---------- Clock (Ibadan, WAT) ----------
  const clock = $('[data-clock]');
  const clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Lagos' });
  const tick = () => { if (clock) clock.textContent = clockFmt.format(new Date()); };
  tick(); setInterval(tick, 1000);

  // ---------- Role typer ----------
  const roleEl = $('.role-text');
  if (roleEl && !reduceMotion) {
    const roles = roleEl.dataset.roles.split('|');
    let r = 0; let c = roles[0].length; let deleting = false;
    const type = () => {
      const word = roles[r];
      if (!deleting) {
        c += 1; roleEl.textContent = word.slice(0, c);
        if (c >= word.length) { deleting = true; return setTimeout(type, 1900); }
        return setTimeout(type, 55);
      }
      c -= 1; roleEl.textContent = word.slice(0, Math.max(0, c));
      if (c <= 0) { deleting = false; r = (r + 1) % roles.length; return setTimeout(type, 260); }
      return setTimeout(type, 28);
    };
    setTimeout(() => { deleting = true; type(); }, 2600);
  }

  // ---------- Text scramble ----------
  const scramble = (el) => {
    const final = el.textContent;
    el.setAttribute('aria-label', final);
    if (reduceMotion) return;
    const chars = [...final];
    const start = performance.now();
    const dur = 900;
    const reveal = chars.map((_, i) => (i / chars.length) * dur * 0.75 + Math.random() * dur * 0.25);
    const frame = (now) => {
      const t = now - start;
      let out = '';
      let done = true;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === ' ' || t >= reveal[i]) out += chars[i];
        else { out += GLYPHS[rand(GLYPHS.length)]; done = false; }
      }
      el.textContent = out;
      if (!done) requestAnimationFrame(frame); else el.textContent = final;
    };
    requestAnimationFrame(frame);
  };

  // ---------- Reveal + counters (checked in the shared frame loop) ----------
  let pendingReveal = $$('.reveal');
  let pendingCounters = $$('[data-count]');
  const startCounter = (el) => {
    if (reduceMotion) return;
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const dur = 1500;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // ---------- Cursor reticle ----------
  const cursor = $('.cursor');
  let cx = -100; let cy = -100; let tx = -100; let ty = -100;
  if (finePointer && !reduceMotion && cursor) {
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      cursor.classList.toggle('hover', !!e.target.closest('a, button, [data-tilt], .sphere'));
    });
  } else if (cursor) {
    cursor.remove();
  }

  // ---------- Project tilt ----------
  if (finePointer && !reduceMotion) {
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1400px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) translateZ(0)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // ---------- Skill sphere ----------
  const sphere = $('.sphere');
  const sphereTags = [];
  let ax = 0.3; let ay = 0; let vx = 0; let vy = 0.004; let dragging = false; let lastX = 0; let lastY = 0;
  if (sphere) {
    const words = sphere.dataset.sphere.split(',');
    const n = words.length;
    words.forEach((w, i) => {
      const k = -1 + (2 * i + 1) / n;
      const phi = Math.acos(k);
      const theta = Math.sqrt(n * Math.PI) * phi;
      const span = document.createElement('span');
      span.textContent = w;
      if (i % 3 === 1) span.className = 'c';
      sphere.appendChild(span);
      sphereTags.push({ el: span, x: Math.cos(theta) * Math.sin(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(phi) });
    });
    sphere.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; sphere.setPointerCapture(e.pointerId); });
    sphere.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      vy = (e.clientX - lastX) * 0.0009; vx = (e.clientY - lastY) * -0.0009;
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = () => { dragging = false; };
    sphere.addEventListener('pointerup', end);
    sphere.addEventListener('pointercancel', end);
  }
  const drawSphere = () => {
    const size = sphere.clientWidth;
    const R = size * 0.41;
    if (!dragging) { vx *= 0.96; vy = vy * 0.96 + 0.004 * 0.04; }
    ax += vx; ay += vy;
    const cosX = Math.cos(ax); const sinX = Math.sin(ax); const cosY = Math.cos(ay); const sinY = Math.sin(ay);
    for (const t of sphereTags) {
      const y1 = t.y * cosX - t.z * sinX;
      const z1 = t.y * sinX + t.z * cosX;
      const x2 = t.x * cosY + z1 * sinY;
      const z2 = -t.x * sinY + z1 * cosY;
      const persp = 1.6 / (2.2 - z2);
      const alpha = 0.06 + Math.pow((z2 + 1) / 2, 1.6) * 0.94;
      t.el.style.transform = `translate(-50%, -50%) translate3d(${(x2 * R * persp).toFixed(1)}px, ${(y1 * R * persp).toFixed(1)}px, 0) scale(${(0.5 + persp * 0.55).toFixed(3)})`;
      t.el.style.opacity = alpha.toFixed(2);
      t.el.style.zIndex = String(Math.round((z2 + 1) * 50));
    }
  };

  // ---------- Code rain ----------
  const rain = $('.rain');
  const rainState = { ctx: null, cols: 0, drops: [], last: 0, w: 0, h: 0 };
  const RAIN_CHARS = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF{}<>/=+*';
  const sizeRain = () => {
    if (!rain) return;
    const r = rain.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    rain.width = Math.round(r.width * dpr); rain.height = Math.round(r.height * dpr);
    rainState.ctx = rain.getContext('2d');
    rainState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rainState.w = r.width; rainState.h = r.height;
    rainState.cols = Math.ceil(r.width / 16);
    rainState.drops = Array.from({ length: rainState.cols }, () => Math.random() * -60);
    rainState.ctx.fillStyle = '#04070a'; rainState.ctx.fillRect(0, 0, r.width, r.height);
  };
  const drawRain = (now) => {
    const s = rainState;
    if (!s.ctx || now - s.last < 55) return;
    s.last = now;
    const ctx = s.ctx;
    ctx.fillStyle = 'rgba(4, 7, 10, 0.12)';
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.font = '14px "JetBrains Mono", monospace';
    for (let i = 0; i < s.cols; i++) {
      const ch = RAIN_CHARS[rand(RAIN_CHARS.length)];
      const x = i * 16; const y = s.drops[i] * 16;
      ctx.fillStyle = Math.random() < 0.06 ? '#e6fff4' : (i % 5 === 0 ? 'rgba(0,225,255,.75)' : 'rgba(0,255,157,.8)');
      ctx.fillText(ch, x, y);
      if (y > s.h && Math.random() > 0.975) s.drops[i] = 0;
      s.drops[i] += 1;
    }
  };
  if (rain) { sizeRain(); window.addEventListener('resize', sizeRain); }

  // ---------- Flight (scroll-driven 3D) captions ----------
  const flight = $('.flight');
  const captions = $$('.caption');
  const flightPct = $('[data-flight-pct]');
  window.__flight = { progress: 0, visible: false };
  if (flight && reduceMotion) flight.classList.add('static');

  // ---------- Shared frame loop ----------
  const progress = $('.progress span');
  const scrollPct = $('[data-scroll-pct]');
  const tickers = $$('.ticker-row');
  let tickerOffset = 0; let lastScroll = window.scrollY; let velocity = 0; let lastFrame = performance.now();
  const frame = (now) => {
    const dt = Math.min(64, now - lastFrame); lastFrame = now;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const p = max > 0 ? y / max : 0;
    progress.style.setProperty('--p', p.toFixed(4));
    if (scrollPct) scrollPct.textContent = String(Math.round(p * 100)).padStart(3, '0');
    nav.classList.toggle('scrolled', y > 24);

    if (pendingReveal.length) {
      pendingReveal = pendingReveal.filter((el) => {
        if (el.getBoundingClientRect().top < vh * 0.92) {
          el.classList.add('in');
          if (el.hasAttribute('data-scramble')) scramble(el);
          return false;
        }
        return true;
      });
    }
    if (pendingCounters.length) {
      pendingCounters = pendingCounters.filter((el) => {
        if (el.getBoundingClientRect().top < vh * 0.88) { startCounter(el); return false; }
        return true;
      });
    }
    let current = '';
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) { current = sec.id; break; }
    }
    if (current !== activeId) {
      activeId = current;
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${current}`));
    }

    velocity = velocity * 0.9 + Math.abs(y - lastScroll) * 0.1; lastScroll = y;
    if (!reduceMotion) {
      tickerOffset += (0.04 + velocity * 0.02) * dt;
      tickers.forEach((row) => {
        const width = row.firstElementChild.offsetWidth || 1;
        const dir = Number(row.dataset.speed || 1);
        const raw = tickerOffset % width;
        row.style.setProperty('--x', `${dir > 0 ? -raw : raw - width}px`);
      });
    }

    if (cursor && cursor.isConnected) {
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    }

    if (sphere) {
      const r = sphere.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && (!reduceMotion || !sphere.dataset.drawn)) { drawSphere(); sphere.dataset.drawn = '1'; }
    }

    if (rain) {
      const r = rain.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && !reduceMotion) drawRain(now);
    }

    if (flight && !flight.classList.contains('static')) {
      const r = flight.getBoundingClientRect();
      const total = r.height - vh;
      const fp = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      window.__flight.progress = fp;
      window.__flight.visible = r.top < vh && r.bottom > 0;
      if (flightPct) flightPct.textContent = `${String(Math.round(fp * 100)).padStart(3, '0')}%`;
      const idx = Math.min(captions.length - 1, Math.floor(fp * captions.length * 0.999));
      captions.forEach((c, i) => c.classList.toggle('on', i === idx && window.__flight.visible));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ---------- Command palette ----------
  const palette = $('.palette');
  const input = $('input', palette);
  const list = $('.palette-list', palette);
  const go = (hash) => () => { $(hash)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); };
  const open = (url) => () => { window.open(url, '_blank', 'noopener'); };
  const commands = [
    { group: 'Navigate', label: 'Selected work', hint: '#work', run: go('#work') },
    { group: 'Navigate', label: 'Experience', hint: '#experience', run: go('#experience') },
    { group: 'Navigate', label: 'Stack', hint: '#stack', run: go('#stack') },
    { group: 'Navigate', label: 'Contact', hint: '#contact', run: go('#contact') },
    { group: 'Projects', label: 'tracelens: live demo', hint: 'AI agent log viewer', run: open('https://michealjunior.github.io/tracelens/') },
    { group: 'Projects', label: 'promptcheck: live site', hint: 'LLM regression tests', run: open('https://michealjunior.github.io/promptcheck/') },
    { group: 'Projects', label: 'repo-hub: live demo', hint: 'Benchmark task design', run: open('https://michealjunior.github.io/repo-hub/?demo') },
    { group: 'Projects', label: 'repo-doctor: live demo', hint: 'GitHub profile audit', run: open('https://michealjunior.github.io/repo-doctor/') },
    { group: 'Projects', label: 'nuban-check: live demo', hint: 'NUBAN validator', run: open('https://michealjunior.github.io/nuban-check/') },
    { group: 'Projects', label: 'naira-invoice: live demo', hint: 'Invoice generator', run: open('https://michealjunior.github.io/naira-invoice/') },
    { group: 'Links', label: 'Download résumé (PDF)', hint: 'pdf', run: open('assets/Ayeni-Oluwaferanmi-Micheal-CV.pdf') },
    { group: 'Links', label: 'GitHub', hint: 'github.com/Michealjunior', run: open('https://github.com/Michealjunior') },
    { group: 'Links', label: 'LinkedIn', hint: 'linkedin.com', run: open('https://www.linkedin.com/in/ayeni-oluwaferanmi-668ba6301') },
    { group: 'Links', label: 'StarNex', hint: 'starnex.company', run: open('https://starnex.company') },
    { group: 'Actions', label: 'Copy link to this portfolio', hint: 'clipboard', run: () => navigator.clipboard?.writeText('https://michealjunior.github.io/') },
    { group: 'Actions', label: 'Replay boot sequence', hint: 'reload', run: () => { try { sessionStorage.removeItem('signal-booted'); } catch (_) { /* ignore */ } location.reload(); } },
  ];
  let filtered = commands; let active = 0; let lastFocus = null;
  const render = () => {
    list.textContent = '';
    if (!filtered.length) {
      const li = document.createElement('li');
      li.className = 'palette-empty'; li.textContent = 'command not found. try "work" or "github"';
      list.appendChild(li); return;
    }
    let group = '';
    filtered.forEach((cmd, i) => {
      if (cmd.group !== group) {
        group = cmd.group;
        const g = document.createElement('li');
        g.className = 'palette-group'; g.setAttribute('role', 'presentation'); g.textContent = group;
        list.appendChild(g);
      }
      const li = document.createElement('li');
      li.className = 'palette-item'; li.id = `cmd-${i}`;
      li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === active));
      const label = document.createElement('span'); label.textContent = cmd.label;
      const hint = document.createElement('small'); hint.textContent = cmd.hint;
      li.append(label, hint);
      li.addEventListener('mousemove', () => { if (active !== i) { active = i; update(); } });
      li.addEventListener('click', () => run(i));
      list.appendChild(li);
    });
    input.setAttribute('aria-activedescendant', `cmd-${active}`);
  };
  const update = () => {
    $$('.palette-item', list).forEach((li) => li.setAttribute('aria-selected', String(li.id === `cmd-${active}`)));
    input.setAttribute('aria-activedescendant', `cmd-${active}`);
    $(`#cmd-${active}`, list)?.scrollIntoView({ block: 'nearest' });
  };
  const filter = () => {
    const q = input.value.trim().toLowerCase();
    filtered = q ? commands.filter((c) => `${c.group} ${c.label} ${c.hint}`.toLowerCase().includes(q)) : commands;
    active = 0; render();
  };
  const openPalette = () => { lastFocus = document.activeElement; palette.hidden = false; input.value = ''; filter(); input.focus(); document.body.style.overflow = 'hidden'; };
  const closePalette = () => { palette.hidden = true; document.body.style.overflow = ''; lastFocus?.focus?.(); };
  const run = (i) => { const cmd = filtered[i]; closePalette(); cmd?.run(); };
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, filtered.length); update(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + filtered.length) % Math.max(1, filtered.length); update(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  });
  $$('[data-palette-open]').forEach((b) => b.addEventListener('click', openPalette));
  $$('[data-palette-close]').forEach((b) => b.addEventListener('click', closePalette));
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.hidden ? openPalette() : closePalette(); }
    else if (e.key === '/' && !typing && palette.hidden) { e.preventDefault(); openPalette(); }
    else if (e.key === 'Escape' && !palette.hidden) { closePalette(); }
    else if (e.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menu.focus(); }
  });
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    $$('.kbd-hint, .footer kbd').forEach((k) => { k.textContent = 'Ctrl K'; });
  }
})();
