// main.js – kopplar ihop tangentbord, canvas-skalning, UI och spel-loop.
(function () {
  'use strict';

  function showError(msg) {
    const el = document.getElementById('error');
    el.textContent += msg + '\n';
    el.style.display = 'block';
  }
  window.addEventListener('error', e => showError('Fel: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'));

  const canvas = document.getElementById('game');
  const { W, H } = window.GAME_CONST;
  canvas.width = W; canvas.height = H;

  const sprites = window.SPRITES.build(W, H);
  const game = new window.Game(canvas, window.LEVELS, sprites);
  window.game = game;
  // ?garderob öppnar garderoben direkt (används av skärmdumpsverktyget)
  if (/garderob/.test(location.search)) game.state = 'wardrobe';

  // Fyll hela fönstret: heltalsskala (skarpa pixlar) och vyn växer i stället för att lämna kanter.
  const C = window.GAME_CONST;
  const MIN_LEVEL_W = Math.min(...window.LEVELS.map(l => l.map[0].length)) * C.TILE;
  const wrap = document.getElementById('wrap');
  let lastView = '';
  function resize() {
    const s = Math.max(1, Math.floor(window.innerHeight / C.WORLD_H));
    const w = Math.max(320, Math.min(Math.max(MIN_LEVEL_W, 900), Math.ceil(window.innerWidth / s)));
    const h = Math.max(C.WORLD_H, Math.ceil(window.innerHeight / s));
    const key = w + 'x' + h;
    if (key !== lastView) {
      lastView = key;
      C.setView(w, h);
      canvas.width = w; canvas.height = h;
      sprites.buildBg(w, h);
      // kameran räknas om direkt för den nya vystorleken
      const c0 = game.chars[game.active];
      game.camX = game.clampCam(c0.x + c0.w / 2 - w / 2);
      game.camY = game.clampCamY(c0.y - h * 0.55);
    }
    wrap.style.width = (w * s) + 'px';
    wrap.style.height = (h * s) + 'px';
    document.documentElement.style.setProperty('--scale', s);
  }
  window.addEventListener('resize', resize);
  resize();

  // Tangenter
  const k = game.keys;
  // W och mellanslag hoppar alltid. Pil upp/ner klättrar i stegar (pil upp hoppar när man inte står vid en stege).
  const move = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'jump', ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyE: 'actionHeld', Enter: 'actionHeld' };
  window.addEventListener('keydown', e => {
    const m = move[e.code];
    if (m) e.preventDefault();
    if (e.repeat) return;
    if (m) { k[m] = true; if (m === 'jump') k.jumpPressed = true; }
    if (e.code === 'Tab' || e.code === 'KeyQ' || e.code === 'ShiftLeft') { k.swapPressed = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Enter') { k.actionPressed = true; e.preventDefault(); }
    if (e.code === 'KeyF') k.dropPressed = true;
    if (/^Digit[1-4]$/.test(e.code)) k.slotPressed = +e.code.slice(5);
    if (e.code === 'KeyR') k.restartPressed = true;
    // menyknappar (garderob)
    if (e.code === 'ArrowUp' || e.code === 'KeyW') k.upPressed = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') k.downPressed = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.leftPressed = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') k.rightPressed = true;
    if (e.code === 'Escape') k.backPressed = true;
    if (e.code === 'KeyC') k.wardrobePressed = true;
    if (e.code === 'Space' || e.code === 'Enter') k.confirmPressed = true;
    game.sound.ensure();
  });
  window.addEventListener('keyup', e => { const m = move[e.code]; if (m) { k[m] = false; e.preventDefault(); } });
  window.addEventListener('blur', () => { k.left = k.right = k.jump = k.up = k.down = k.actionHeld = false; });

  // UI-synk
  const el = id => document.getElementById(id);
  const ui = { title: el('title'), subtitle: el('subtitle'), hint: el('hint'), toast: el('toast'), level: el('level'), tip: el('tip'), taskTitle: el('tasktitle'), taskHelp: el('taskhelp') };
  const panel = el('titlepanel'), controls = el('controls'), wdEl = el('wardrobe');
  let last = {}, lastWd = '';
  function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }
  function syncUI() {
    const u = game.ui;
    const wdKey = JSON.stringify(u.wd || null);
    if (wdKey !== lastWd) {
      lastWd = wdKey;
      if (u.wd) {
        wdEl.innerHTML =
          `<div class="wd-name">${esc(u.wd.name)}</div>` +
          u.wd.rows.map(r => `<div class="wd-row${r.sel ? ' sel' : ''}"><span class="wd-label">${esc(r.label)}</span><span class="wd-val">◀ ${esc(r.value)} ▶</span></div>`).join('') +
          `<div class="wd-help">UPP/NER välj rad &nbsp; VÄNSTER/HÖGER byt<br>TAB annan figur &nbsp; ENTER klar</div>`;
        wdEl.classList.toggle('right', u.wd.side === 0);
        wdEl.classList.toggle('left', u.wd.side === 1);
      }
      wdEl.classList.toggle('show', !!u.wd);
    }
    for (const key in ui) {
      if (u[key] !== last[key]) {
        ui[key].textContent = u[key] || '';
        ui[key].classList.toggle('show', !!u[key]);
      }
    }
    const big = game.state !== 'play' && game.state !== 'wardrobe';
    document.body.classList.toggle('title-mode', big);
    panel.classList.toggle('show', !!u.title);
    controls.classList.toggle('show', game.state === 'title');
    last = Object.assign({}, u);
  }

  // Loop med fast tidssteg
  let prev = performance.now(), acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    acc += Math.min(0.1, (now - prev) / 1000);
    prev = now;
    while (acc >= STEP) { game.update(STEP); acc -= STEP; }
    game.render();
    syncUI();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
