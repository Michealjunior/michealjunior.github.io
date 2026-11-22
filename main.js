// Portfolio interactions: nav, reveals, sky, terminal, manifesto, counters, clock, ticker, magnetic buttons, command palette.
(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Year
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // Nav: glass on scroll, mobile menu, active section
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

  // Reveal on scroll: checked in the shared frame loop (anything at or above 92% of the viewport is shown)
  let pendingReveal = $$('.reveal');

  // Screenshots: fall back to a clean panel if an image is missing
  $$('.shot img').forEach((img) => {
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true });
  });

  // Local time in Ibadan (WAT)
  const clock = $('[data-clock]');
  const clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
  const tick = () => { if (clock) clock.textContent = clockFmt.format(new Date()); };
  tick(); setInterval(tick, 15000);

  // Terminal: lines appear as if typed
  const terminal = $('.terminal');
  if (terminal && !reduceMotion) {
    const lines = $$('.t-line, .t-out', terminal);
    terminal.classList.add('typing');
    let delay = 700;
    lines.forEach((line) => {
      const isCmd = line.classList.contains('t-line');
      setTimeout(() => line.classList.add('shown'), delay);
      delay += isCmd ? 620 : 260;
    });
  }

  // Manifesto: words light up as you scroll past
  const manifesto = $('[data-manifesto]');
  let words = [];
  if (manifesto) {
    const text = manifesto.textContent.trim().replace(/\s+/g, ' ');
    manifesto.textContent = '';
    words = text.split(' ').map((w, i, all) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = w + (i < all.length - 1 ? ' ' : '');
      manifesto.appendChild(span);
      return span;
    });
    if (reduceMotion) words.forEach((w) => w.classList.add('lit'));
  }

  // Counters
  let pendingCounters = $$('[data-count]');
  const startCounter = (el) => {
      if (reduceMotion) return;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const start = performance.now();
      const dur = 1400;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
  };

  // Scroll-linked effects share one rAF
  const progress = $('.progress span');
  const tickers = $$('.ticker-row');
  let tickerOffset = 0;
  let lastScroll = window.scrollY;
  let velocity = 0;
  let lastFrame = performance.now();
  const frame = (now) => {
    const dt = Math.min(64, now - lastFrame);
    lastFrame = now;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    nav.classList.toggle('scrolled', y > 24);
    const vh = window.innerHeight;

    if (pendingReveal.length) {
      pendingReveal = pendingReveal.filter((el) => {
        if (el.getBoundingClientRect().top < vh * 0.92) { el.classList.add('in'); return false; }
        return true;
      });
    }
    if (pendingCounters.length) {
      pendingCounters = pendingCounters.filter((el) => {
        if (el.getBoundingClientRect().top < vh * 0.85) { startCounter(el); return false; }
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

    velocity = velocity * 0.9 + Math.abs(y - lastScroll) * 0.1;
    lastScroll = y;
    if (!reduceMotion) {
      tickerOffset += (0.035 + velocity * 0.02) * dt;
      tickers.forEach((row) => {
        const width = row.firstElementChild.offsetWidth || 1;
        const dir = Number(row.dataset.speed || 1);
        const raw = (tickerOffset * Math.abs(dir)) % width;
        row.style.setProperty('--x', `${dir > 0 ? -raw : raw - width}px`);
      });
    }

    if (words.length && !reduceMotion) {
      const r = manifesto.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const litCount = Math.round(t * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < litCount));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Sky: drifting stars that join into constellations near the pointer
  const skies = $$('canvas.sky').map((canvas) => {
    const ctx = canvas.getContext('2d');
    const state = { canvas, ctx, stars: [], w: 0, h: 0, dpr: 1, pointer: { x: -9999, y: -9999 }, visible: true };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      state.dpr = Math.min(2, window.devicePixelRatio || 1);
      state.w = rect.width; state.h = rect.height;
      canvas.width = Math.round(rect.width * state.dpr);
      canvas.height = Math.round(rect.height * state.dpr);
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      const count = Math.round(Math.min(140, (rect.width * rect.height) / 9000));
      state.stars = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        r: Math.random() * 1.3 + 0.3,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        tw: Math.random() * Math.PI * 2,
        gold: Math.random() < 0.12,
      }));
    };
    resize();
    window.addEventListener('resize', resize);
    const host = canvas.parentElement;
    host.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      state.pointer.x = e.clientX - rect.left; state.pointer.y = e.clientY - rect.top;
    });
    host.addEventListener('pointerleave', () => { state.pointer.x = -9999; state.pointer.y = -9999; });
    return state;
  });

  const drawSky = (s, time) => {
    const { ctx, stars, w, h, pointer } = s;
    ctx.clearRect(0, 0, w, h);
    for (const star of stars) {
      if (!reduceMotion) {
        star.x += star.vx; star.y += star.vy;
        if (star.x < -10) star.x = w + 10; if (star.x > w + 10) star.x = -10;
        if (star.y < -10) star.y = h + 10; if (star.y > h + 10) star.y = -10;
      }
      const twinkle = reduceMotion ? 0.8 : 0.55 + Math.sin(time / 900 + star.tw) * 0.35;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = star.gold ? `rgba(246,169,59,${twinkle})` : `rgba(220,224,245,${twinkle * 0.8})`;
      ctx.fill();
    }
    // Constellation lines: stars near the pointer join each other
    const near = stars.filter((st) => (st.x - pointer.x) ** 2 + (st.y - pointer.y) ** 2 < 180 ** 2);
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i], b = near[j];
        const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        if (d2 < 110 ** 2) {
          const alpha = 0.35 * (1 - Math.sqrt(d2) / 110);
          ctx.strokeStyle = `rgba(246,169,59,${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
  };
  const skyLoop = (time) => {
    skies.forEach((s) => {
      const r = s.canvas.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) drawSky(s, time);
    });
    if (!reduceMotion) requestAnimationFrame(skyLoop);
  };
  requestAnimationFrame(skyLoop);

  // Magnetic buttons (mouse only)
  if (finePointer && !reduceMotion) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18;
        const y = (e.clientY - r.top - r.height / 2) * 0.25;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  // Command palette
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
    { group: 'Projects', label: 'repo-doctor: live demo', hint: 'GitHub profile audit', run: open('https://michealjunior.github.io/repo-doctor/') },
    { group: 'Projects', label: 'nuban-check: live demo', hint: 'NUBAN validator', run: open('https://michealjunior.github.io/nuban-check/') },
    { group: 'Projects', label: 'naira-invoice: live demo', hint: 'Invoice generator', run: open('https://michealjunior.github.io/naira-invoice/') },
    { group: 'Links', label: 'Download résumé (PDF)', hint: 'PDF', run: open('assets/Ayeni-Oluwaferanmi-Micheal-CV.pdf') },
    { group: 'Links', label: 'GitHub', hint: 'github.com/Michealjunior', run: open('https://github.com/Michealjunior') },
    { group: 'Links', label: 'LinkedIn', hint: 'linkedin.com', run: open('https://www.linkedin.com/in/ayeni-oluwaferanmi-668ba6301') },
    { group: 'Links', label: 'StarNex', hint: 'starnex.company', run: open('https://starnex.company') },
    { group: 'Actions', label: 'Copy link to this portfolio', hint: 'clipboard', run: () => navigator.clipboard?.writeText('https://michealjunior.github.io/') },
  ];
  let filtered = commands;
  let active = 0;
  let lastFocus = null;

  const render = () => {
    list.textContent = '';
    if (!filtered.length) {
      const li = document.createElement('li');
      li.className = 'palette-empty';
      li.textContent = 'No matches. Try "work" or "github".';
      list.appendChild(li);
      return;
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
      li.className = 'palette-item';
      li.id = `cmd-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
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
    active = 0;
    render();
  };
  const openPalette = () => {
    lastFocus = document.activeElement;
    palette.hidden = false;
    input.value = '';
    filter();
    input.focus();
    document.body.style.overflow = 'hidden';
  };
  const closePalette = () => {
    palette.hidden = true;
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  };
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

  // Show the right shortcut on non-Mac keyboards
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    $$('.kbd-hint, .footer kbd').forEach((k) => { k.textContent = 'Ctrl K'; });
  }
})();
