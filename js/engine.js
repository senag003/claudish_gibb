// engine.js – spelmotor: fysik, pussel, kamera, rendering, ljud.
(function () {
  'use strict';

  const TILE = 16;
  // Vyns storlek i spelpixlar. Anpassas efter fönstret (main.js) så att hela skärmen fylls
  // med skarpa pixlar: bredare fönster = mer bana i sidled, högre = mer himmel ovanför.
  let W = 448, H = 256;
  const WORLD_H = 256;              // basvyns höjd (16 tiles); banor kan vara högre, kameran följer i höjdled
  function setView(w, h) { W = w; H = h; }
  // Tecken: galler a–d och i–l, broar e–h, utlösare 1–9 och m–z
  const isGateCh = ch => (ch >= 'a' && ch <= 'd') || (ch >= 'i' && ch <= 'l');
  const isTrigCh = ch => (ch >= '1' && ch <= '9') || (ch >= 'm' && ch <= 'z');
  const st0 = c => c.stats.wallJump;   // kan glida längs väggar
  const GRAVITY = 900;
  const MAX_FALL = 360;

  // Edvin: snabb, studsig, direkt. Hedda: tung, tröghet, kraftfulla landningar.
  const STATS = {
    edvin: {
      speed: 130, accel: 1400, airAccel: 950, friction: 1500, jump: 320, gravity: 1.0,
      strong: false, stride: 8, prejump: 0, color: '#6f8fd6', name: 'EDVIN', emotes: ['watch', 'jog'], wallJump: true
    },
    hedda: {
      speed: 100, accel: 700, airAccel: 450, friction: 520, jump: 235, gravity: 1.12,
      strong: true, stride: 7, prejump: 0.05, color: '#f0a3c2', name: 'HEDDA', emotes: ['flex']
    }
  };
  const HIT_W = 12, HIT_H = 30;

  // ---------- Ljud ----------
  class Sound {
    constructor() { this.ctx = null; this.enabled = true; }
    ensure() {
      if (this.ctx || !this.enabled) return;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.enabled = false; }
    }
    tone(freq, dur, type, vol, slide) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur);
    }
    noise(dur, vol, lowpass) {
      if (!this.enabled || !this.ctx) return;
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.max(1, sr * dur), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.1;
      if (lowpass) {
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
        s.connect(f); f.connect(g);
      } else s.connect(g);
      g.connect(this.ctx.destination);
      s.start();
    }
    jump(light) { light ? this.tone(440, 0.12, 'square', 0.045, 1.9) : this.tone(260, 0.16, 'square', 0.05, 1.5); }
    land(heavy) { heavy ? (this.noise(0.12, 0.16, 500), this.tone(70, 0.12, 'sine', 0.12, 0.6)) : this.noise(0.04, 0.04, 2000); }
    step(heavy) { heavy ? this.noise(0.05, 0.05, 400) : this.noise(0.02, 0.015, 3000); }
    swap() { this.tone(520, 0.06, 'triangle', 0.08); setTimeout(() => this.tone(780, 0.08, 'triangle', 0.08), 60); }
    push() { this.noise(0.35, 0.05, 300); }
    thud() { this.noise(0.1, 0.12, 300); this.tone(60, 0.1, 'sine', 0.1, 0.7); }
    brk() { this.noise(0.35, 0.18, 1200); this.tone(90, 0.25, 'sawtooth', 0.08, 0.5); }
    click() { this.tone(900, 0.05, 'square', 0.05, 0.6); }
    lever() { this.tone(220, 0.07, 'square', 0.06, 0.7); setTimeout(() => this.tone(150, 0.08, 'square', 0.06), 70); }
    gate(open) { this.tone(open ? 150 : 240, 0.35, 'sawtooth', 0.035, open ? 1.6 : 0.6); }
    tick() { this.tone(1200, 0.025, 'square', 0.025); }
    pickup() { this.tone(660, 0.06, 'square', 0.04); setTimeout(() => this.tone(990, 0.07, 'square', 0.04), 50); }
    drop() { this.tone(330, 0.07, 'square', 0.04, 0.7); }
    insert() { this.tone(440, 0.05, 'square', 0.05); setTimeout(() => this.tone(880, 0.12, 'triangle', 0.06), 60); }
    hurt() { this.tone(300, 0.3, 'sawtooth', 0.07, 0.3); }
    whoosh() { this.noise(0.12, 0.07, 5000); this.tone(500, 0.08, 'triangle', 0.02, 0.5); }
    nope() { this.tone(180, 0.12, 'square', 0.04, 0.8); }
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.08), i * 90)); }
    cluck() { this.tone(720, 0.05, 'square', 0.03, 0.8); setTimeout(() => this.tone(620, 0.07, 'square', 0.03, 0.7), 70); }
  }

  // ---------- Spelet ----------
  class Game {
    constructor(canvas, levels, sprites) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.levels = levels;
      this.sprites = sprites;
      this.sound = new Sound();
      this.keys = { left: false, right: false, jump: false, jumpPressed: false, swapPressed: false, actionPressed: false, restartPressed: false, confirmPressed: false };
      this.state = 'title';
      this.time = 0;
      this.shake = 0;
      this.flash = 0;
      this.particles = [];
      this.ui = { title: '', subtitle: '', hint: '', toast: '', level: '', tip: '' };
      this.toastT = 0;
      this.wd = { char: 0, row: 0 };
      this.outfit = this.loadOutfit();
      if (this.resetBirkin) this.resetBirkin();   // ingen väska när spelet startar
      this.sprites.dress('edvin', this.outfit.edvin);
      this.sprites.dress('hedda', this.outfit.hedda);
      this.loadLevel(0);
      this.placeTitleHen();
    }

    // ----- Garderob -----
    loadOutfit() {
      const O = window.CHARACTER_ART.outfits;
      const def = { edvin: Object.assign({}, O.edvin.defaults), hedda: Object.assign({}, O.hedda.defaults) };
      try {
        const s = JSON.parse(window.localStorage.getItem('edvin_hedda_outfit') || 'null');
        if (s && s.edvin && s.hedda) return { edvin: Object.assign(def.edvin, s.edvin), hedda: Object.assign(def.hedda, s.hedda) };
      } catch (e) { /* ingen lagring tillgänglig */ }
      return def;
    }
    saveOutfit() {
      try { window.localStorage.setItem('edvin_hedda_outfit', JSON.stringify(this.outfit)); } catch (e) { /* ok */ }
    }
    wardrobeLists(name) {
      const O = window.CHARACTER_ART.outfits;
      const rows = [['Tröja', 'top', O[name].tops], ['Byxor', 'pants', O.pants], ['Skor', 'shoes', O.shoes]];
      if (name === 'hedda') {
        // hemligt tillbehör – syns först när Birkin-väskan hittats
        rows.push(['Väska', 'bag', this.birkinUnlocked() ? [{ name: 'Ingen' }, { name: 'Birkin bag' }] : [{ name: '??? (hemlig)' }]]);
      }
      return rows;
    }
    updateWardrobe() {
      const k = this.keys, w = this.wd;
      const nameNow = () => (w.char === 0 ? 'edvin' : 'hedda');
      if (k.swapPressed) { w.char = 1 - w.char; this.sound.swap(); }
      const n = this.wardrobeLists(nameNow()).length;
      if (w.row >= n) w.row = n - 1;
      if (k.upPressed) { w.row = (w.row + n - 1) % n; this.sound.tick(); }
      if (k.downPressed) { w.row = (w.row + 1) % n; this.sound.tick(); }
      const dir = (k.rightPressed ? 1 : 0) - (k.leftPressed ? 1 : 0);
      if (dir) {
        const name = nameNow();
        const [, key, list] = this.wardrobeLists(name)[w.row];
        const o = this.outfit[name];
        if (o[key] === undefined || o[key] >= list.length) o[key] = 0;
        o[key] = (o[key] + dir + list.length) % list.length;
        this.sprites.dress(name, o);
        this.saveOutfit();
        this.sound.click();
      }
      if (k.backPressed || k.wardrobePressed || k.confirmPressed) {
        this.state = this.wdReturn || 'title';
        this.wdReturn = null;
        this.sound.swap();
      }
    }

    // På titelskärmen pickar hönan bredvid Hedda
    placeTitleHen() {
      const ed = this.chars[0];
      this.hen.x = this.hen.homeX = ed.x - 26;
      this.hen.y = ed.y + ed.h - 16;
      this.hen.facing = 1;
    }

    // ----- Banladdning -----
    loadLevel(i) {
      const lv = this.levels[i];
      this.levelIndex = i;
      this.level = lv;
      this.rows = lv.map.length;
      this.cols = lv.map[0].length;
      this.grid = lv.map.map(r => r.split(''));
      this.blocks = []; this.chars = []; this.triggers = {}; this.doors = {};
      this.hen = null;
      this.winT = 0; this.deathT = 0; this.levelT = 0; this.catchAnim = null;
      this.hintT = 7;
      this.tipsSeen = {};
      this.particles = [];
      this.nopeCool = 0;

      for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
        const ch = this.grid[y][x];
        if (ch === 'E' || ch === 'H') { this.chars.push(this.makeChar(ch === 'E' ? 'edvin' : 'hedda', x, y)); this.grid[y][x] = '.'; }
        else if (ch === 'B') { this.blocks.push({ tx: x, ty: y, x: x * TILE, y: y * TILE, move: null, wobble: 0 }); this.grid[y][x] = '.'; }
        else if (ch === 'O') {
          this.hen = { x: x * TILE, y: y * TILE, homeX: x * TILE, facing: -1, anim: 'idle', frame: 0, animT: 0, nextT: 1.2, hop: 0, walkTo: null };
          this.grid[y][x] = '.';
        } else if (isTrigCh(ch)) {
          if (this.triggers[ch]) { this.triggers[ch].cells.push({ x, y }); continue; }   // plattor kan vara flera tiles breda
          const def = (lv.triggers || {})[ch] || { type: 'lever' };
          this.triggers[ch] = {
            type: def.type, time: def.time || 4, on: !!def.on, timer: 0, x, y, lastTick: 0,
            broken: !!def.broken, accepts: def.accepts || [], holds: null, cells: [{ x, y }],
            task: def.task, to: def.to, done: false
          };
        } else if (isGateCh(ch) || (ch >= 'e' && ch <= 'h')) {
          if (!this.doors[ch]) this.doors[ch] = { kind: isGateCh(ch) ? 'gate' : 'bridge', open: 0, target: 0, cells: [], expr: (lv.logic || {})[ch] || '' };
          this.doors[ch].cells.push({ x, y });
        }
      }
      this.loadItems(lv);
      this.loadLifts(lv);
      this.taskUI = null;
      // dörrar som är öppna från start ska inte animeras upp
      for (const key in this.doors) { const d = this.doors[key]; d.target = this.evalLogic(d.expr) ? 1 : 0; d.open = d.target; }
      this.chars.sort((a, b) => (a.type === 'edvin' ? -1 : 1));
      this.active = 0;
      this.camX = this.clampCam(this.chars[0].x - W / 2);
      this.camY = this.clampCamY(this.chars[0].y - H * 0.55);
    }

    makeChar(type, tx, ty) {
      return {
        type, stats: STATS[type], w: HIT_W, h: HIT_H,
        x: tx * TILE + (TILE - HIT_W) / 2, y: (ty + 1) * TILE - HIT_H,
        vx: 0, vy: 0, onGround: true, facing: 1,
        anim: 'idle', frame: 0, animT: 0, stepAcc: 0,
        coyote: 0, jumpBuf: 0, prejumpT: 0,
        pushing: 0, pushHold: 0, landT: 0, smashT: 0, smashTarget: null,
        standingOn: null, prevX: 0, prevY: 0, input: null, idleT: 0,
        inv: [], sel: 0, climbing: false, wallT: 0, wallDir: 0, lastWallDir: 0, pickT: 0, dropT: 0, onLift: null
      };
    }

    clampCam(x) { return Math.max(0, Math.min(this.cols * TILE - W, x)); }
    // Kameran i höjdled. Är banan lägre än vyn ligger den längst ner (negativt värde = extra himmel).
    clampCamY(y) {
      const maxY = this.rows * TILE - H;
      if (maxY <= 0) return maxY;
      return Math.max(0, Math.min(maxY, y));
    }
    tileIs(tx, ty, chars) { return chars.indexOf(this.tileAt(tx, ty)) >= 0; }
    // Står figurens mittlinje i en stege?
    onLadder(c) {
      const tx = Math.floor((c.x + c.w / 2) / TILE);
      const y0 = Math.floor((c.y + 4) / TILE), y1 = Math.floor((c.y + c.h - 1) / TILE);
      for (let ty = y0; ty <= y1; ty++) if (this.tileIs(tx, ty, 'LT')) return true;
      return false;
    }
    // Står figuren ovanpå en stegtopp (för att klättra ner)?
    aboveLadder(c) {
      const tx = Math.floor((c.x + c.w / 2) / TILE), ty = Math.floor((c.y + c.h + 1) / TILE);
      return c.onGround && this.tileIs(tx, ty, 'T');
    }

    // ----- Kollision -----
    tileAt(tx, ty) {
      if (tx < 0 || tx >= this.cols) return 'S';
      if (ty < 0 || ty >= this.rows) return '.';
      return this.grid[ty][tx];
    }
    isSolidTile(tx, ty) {
      const t = this.tileAt(tx, ty);
      if (t === '#' || t === 'S' || t === 'C' || t === 'X') return true;
      if (isGateCh(t)) return this.doors[t].open < 0.9;
      if (t >= 'e' && t <= 'h') return this.doors[t].open > 0.5;
      return false;
    }
    overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
    collides(r, ignoreBlock) {
      const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - 0.001) / TILE);
      const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - 0.001) / TILE);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
        if (this.isSolidTile(tx, ty)) return { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
      for (const b of this.blocks) {
        if (b === ignoreBlock) continue;
        const br = { x: b.x, y: b.y, w: TILE, h: TILE };
        if (this.overlap(r, br)) return Object.assign(br, { block: b });
      }
      for (const L of (this.lifts || [])) {
        const lr = { x: L.x, y: L.y, w: L.w, h: L.h };
        if (this.overlap(r, lr)) return Object.assign(lr, { lift: L });
      }
      return null;
    }
    cellFree(tx, ty, ignoreBlock) {
      if (this.isSolidTile(tx, ty)) return false;
      for (const b of this.blocks) if (b !== ignoreBlock && b.tx === tx && b.ty === ty) return false;
      const r = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
      return !this.chars.some(c => this.overlap(r, c));
    }

    // ----- Uppdatering -----
    update(dt) {
      this.time += dt;
      const k = this.keys;
      if (this.state === 'wardrobe') {
        this.sound.ensure();
        this.updateWardrobe();
        this.consumeKeys();
        return;
      }
      if (this.state === 'title' || this.state === 'done') {
        this.updateHen(dt);
        this.updateParticles(dt);
        if (k.wardrobePressed) { this.sound.ensure(); this.sound.swap(); this.state = 'wardrobe'; this.consumeKeys(); return; }
        if (k.confirmPressed || k.jumpPressed || (this.state === 'done' && k.restartPressed)) {
          this.sound.ensure();
          this.resetBirkin();   // ny spelomgång: väskan måste hittas igen
          this.state = 'play';
          this.loadLevel(0);
        }
        this.consumeKeys();
        return;
      }

      this.levelT += dt;
      if (this.hintT > 0) this.hintT -= dt;
      if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.ui.toast = ''; }
      if (this.nopeCool > 0) this.nopeCool -= dt;

      if (this.winT > 0) {
        this.winT -= dt;
        const ca = this.catchAnim;
        this.chars.forEach(c => {
          if (ca && c === ca.c) return;           // fångaren styrs av animationen
          c.prevX = c.x; c.prevY = c.y;
          this.control(c, {}, dt); this.physics(c, dt); this.animate(c, dt);
          // den andra hoppar av glädje när hönan är fångad
          if (ca && ca.caught && c.onGround) {
            c.cheerCool = (c.cheerCool || 0) - dt;
            if (c.cheerCool <= 0) { c.vy = -175; c.onGround = false; c.cheerCool = 0.5; c.facing = ca.c.x > c.x ? 1 : -1; }
          }
        });
        if (ca) this.updateCatch(dt); else this.updateHen(dt);
        this.updateParticles(dt);
        if (ca) {
          const target = this.clampCam(ca.c.x + ca.c.w / 2 - W / 2);
          this.camX += (target - this.camX) * Math.min(1, dt * 4);
          const ty = this.clampCamY(ca.c.y - H * 0.5);
          this.camY += (ty - this.camY) * Math.min(1, dt * 4);
        }
        if (this.winT <= 0) {
          this.catchAnim = null;
          if (this.levelIndex + 1 < this.levels.length) this.loadLevel(this.levelIndex + 1);
          else { this.state = 'done'; this.loadLevel(0); this.placeTitleHen(); }
        }
        this.consumeKeys();
        return;
      }
      if (this.deathT > 0) {
        this.deathT -= dt;
        this.updateParticles(dt);
        if (this.deathT <= 0) this.loadLevel(this.levelIndex);
        this.consumeKeys();
        return;
      }

      if (k.wardrobePressed) {
        // garderoben mitt i spelet – banan pausas och fortsätter där den var
        this.wdReturn = 'play';
        this.wd.char = this.active;
        this.state = 'wardrobe';
        this.sound.ensure(); this.sound.swap();
        this.consumeKeys();
        return;
      }
      if (k.restartPressed) { this.loadLevel(this.levelIndex); this.consumeKeys(); return; }
      // Minispel vid en terminal: spelet pausas medan uppgiften görs
      if (this.taskUI) { this.updateTask(dt); this.updateParticles(dt); this.consumeKeys(); return; }
      if (k.swapPressed) {
        this.active = 1 - this.active;
        const c = this.chars[this.active];
        this.sound.ensure(); this.sound.swap();
        this.spawnRing(c.x + c.w / 2, c.y + c.h / 2, c.stats.color);
        this.toast(c.stats.name, 0.9);
      }

      this.chars.forEach(c => { c.prevX = c.x; c.prevY = c.y; });
      this.updateLifts(dt);
      // inventariet: välj fack 1–4, släpp vald sak med F
      const ac = this.chars[this.active];
      if (k.slotPressed) { ac.sel = Math.min(3, k.slotPressed - 1); this.sound.tick(); }
      if (k.dropPressed) this.dropItem(ac);
      // Den som står underst uppdateras först så att den som står ovanpå kan följa med
      const order = this.chars.slice().sort((a, b) => (b.y - a.y));
      for (const c of order) {
        const isActive = c === this.chars[this.active];
        this.control(c, isActive ? k : {}, dt);
        this.physics(c, dt);
      }
      this.carryRiders();
      this.chars.forEach(c => this.animate(c, dt));

      if (k.actionPressed) this.doAction(this.chars[this.active]);

      this.updateBlocks(dt);
      this.updateItems(dt);
      this.updateTriggers(dt);
      this.updateDoors(dt);
      this.updateHen(dt);
      this.updateTips();
      this.checkHazards();
      this.checkWin();
      this.updateParticles(dt);

      const a = this.chars[this.active];
      const target = this.clampCam(a.x + a.w / 2 - W / 2 + a.facing * 28);
      this.camX += (target - this.camX) * Math.min(1, dt * 5);
      const targetY = this.clampCamY(a.y + a.h / 2 - H * 0.55);
      this.camY += (targetY - this.camY) * Math.min(1, dt * 4);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 25);
      this.consumeKeys();
    }

    consumeKeys() {
      const k = this.keys;
      k.jumpPressed = k.swapPressed = k.actionPressed = k.restartPressed = k.confirmPressed = false;
      k.upPressed = k.downPressed = k.leftPressed = k.rightPressed = k.backPressed = k.wardrobePressed = false;
      k.dropPressed = false; k.slotPressed = 0;
    }

    control(c, input, dt) {
      const st = c.stats;
      c.input = input;
      let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      // Plockar upp något: står still en kort stund
      if (c.pickT > 0) { c.pickT -= dt; c.vx *= 0.5; c.jumpBuf = 0; return; }
      if (c.dropT > 0) c.dropT -= dt;
      if (c.wallT > 0) c.wallT -= dt;

      // ----- Stegar -----
      const ladder = this.onLadder(c);
      if (!c.climbing && ((input.up && ladder) || (input.down && (ladder && !c.onGround || this.aboveLadder(c))))) {
        c.climbing = true; c.vx = 0; c.jumpBuf = 0;
        if (this.aboveLadder(c) && input.down) { c.y += 2; c.dropT = 0.25; }
      }
      if (c.climbing) {
        if (!ladder && !(input.down && this.aboveLadder(c))) { c.climbing = false; }
        else {
          if (input.jumpPressed) { // hoppa av stegen
            c.climbing = false; c.vy = -st.jump * 0.6; c.vx = dir * st.speed * 0.6;
            this.sound.jump(!st.strong); return;
          }
          const ud = (input.down ? 1 : 0) - (input.up ? 1 : 0);
          c.vy = ud * 80;
          c.vx = dir * 45;
          // dra in mot stegens mitt
          const lx = Math.floor((c.x + c.w / 2) / TILE) * TILE + TILE / 2 - c.w / 2;
          if (!dir) c.x += (lx - c.x) * Math.min(1, dt * 12);
          if (dir) c.facing = dir;
          c.onGround = false;
          return;
        }
      }

      // Pil upp hoppar när man inte står vid en stege
      if (input.upPressed && !ladder) input = Object.assign({}, input, { jumpPressed: true, jump: true });
      // att hålla pil upp räknas som att hålla hoppknappen (annars klipps Heddas hopp efter hennes ansats)
      if (input.up && !ladder) input = Object.assign({}, input, { jump: true });
      c.input = input;

      // ----- Väggstudsning (Edvin) -----
      if (st.wallJump && !c.onGround && c.wallT > 0 && input.jumpPressed && c.wallDir !== c.lastWallDir) {
        c.vy = -st.jump * 0.92;
        c.vx = -c.wallDir * st.speed;
        c.facing = -c.wallDir;
        c.lastWallDir = c.wallDir;
        c.wallT = 0; c.jumpBuf = 0; c.coyote = 0;
        this.sound.ensure(); this.sound.jump(true);
        this.spawnDust(c.x + (c.wallDir > 0 ? c.w : 0), c.y + c.h / 2, 4);
        return;
      }
      if (c.onGround) c.lastWallDir = 0;

      if (c.smashT > 0) {
        // slår: står still
        c.vx *= 0.5;
      } else if (dir !== 0) {
        const accel = c.onGround ? st.accel : st.airAccel;
        // vändning går snabbare (bättre styrkänsla)
        const turn = Math.sign(c.vx) !== 0 && Math.sign(c.vx) !== dir ? 1.8 : 1;
        c.vx += dir * accel * turn * dt;
        c.facing = dir;
      } else {
        const f = (c.onGround ? st.friction : st.airAccel * 0.4) * dt;
        if (Math.abs(c.vx) <= f) c.vx = 0; else c.vx -= Math.sign(c.vx) * f;
      }
      c.vx = Math.max(-st.speed, Math.min(st.speed, c.vx));

      // Hopp med coyote-tid, buffert och (för Hedda) upptakt
      if (c.onGround) c.coyote = 0.1; else c.coyote -= dt;
      if (input.jumpPressed) c.jumpBuf = 0.14; else c.jumpBuf -= dt;
      if (c.prejumpT > 0) {
        c.prejumpT -= dt;
        if (c.prejumpT <= 0) this.launch(c);
      } else if (c.jumpBuf > 0 && c.coyote > 0 && c.smashT <= 0) {
        c.jumpBuf = 0; c.coyote = 0;
        if (st.prejump > 0) { c.prejumpT = st.prejump; c.vx *= 0.6; }
        else this.launch(c);
      }
      if (!input.jump && c.vy < -90 && c.prejumpT <= 0) c.vy = -90;
    }

    launch(c) {
      c.vy = -c.stats.jump;
      c.onGround = false; c.standingOn = null;
      this.sound.ensure(); this.sound.jump(!c.stats.strong);
      this.spawnDust(c.x + c.w / 2, c.y + c.h, c.stats.strong ? 6 : 4);
    }

    physics(c, dt) {
      const st = c.stats;
      if (c.climbing) { /* ingen gravitation i stegen */ }
      else if (c.prejumpT > 0) { c.vy = 5; }
      else c.vy = Math.min(MAX_FALL, c.vy + GRAVITY * st.gravity * dt);
      // glider långsamt längs väggen (Edvin)
      if (st.wallJump && !c.onGround && c.wallT > 0 && c.vy > 60 && c.input && ((c.wallDir > 0 && c.input.right) || (c.wallDir < 0 && c.input.left))) c.vy = 60;
      const wasPushing = c.pushing;
      c.pushing = 0;

      // --- X ---
      let nx = c.x + c.vx * dt;
      let hit = this.collides({ x: nx, y: c.y, w: c.w, h: c.h });
      if (hit) {
        if (c.vx > 0) nx = hit.x - c.w; else if (c.vx < 0) nx = hit.x + hit.w;
        // väggkontakt i luften (för väggstudsning)
        if (!c.onGround && !hit.block && !hit.lift && c.vx !== 0) { c.wallDir = c.vx > 0 ? 1 : -1; c.wallT = 0.12; }
        const inDir = c.input && ((c.input.right && hit.x > c.x) || (c.input.left && hit.x < c.x));
        if (hit.block && c.onGround && inDir) {
          c.pushing = hit.x > c.x ? 1 : -1;
          if (st.strong) this.tryPush(c, hit.block, c.pushing, dt);
          else if (this.nopeCool <= 0) { this.toast('För tungt för Edvin – Hedda kan knuffa', 2); this.sound.nope(); this.nopeCool = 3; }
        }
        c.vx = 0;
      }
      c.x = nx;
      if (!c.pushing) c.pushHold = 0;
      void wasPushing;

      // --- Y ---
      const oldBottom = c.y + c.h;
      let ny = c.y + c.vy * dt;
      hit = this.collides({ x: c.x, y: ny, w: c.w, h: c.h });
      const wasOnGround = c.onGround;
      c.onGround = false;
      c.standingOn = null;
      c.onLift = null;
      if (hit) {
        if (c.vy > 0) { ny = hit.y - c.h; c.onGround = true; if (hit.lift) c.onLift = hit.lift; if (c.climbing) c.climbing = false; }
        else if (c.vy < 0) ny = hit.y + hit.h;
        if (c.vy > 0 || c.vy < 0) { this.landing(c, wasOnGround); c.vy = 0; }
      }
      // Plattformar man hoppar upp igenom (= och stegtoppar T): fasta bara uppifrån
      if (!c.onGround && c.vy >= 0 && !(c.climbing && c.input && c.input.down) && c.dropT <= 0) {
        const row = Math.floor((ny + c.h) / TILE);
        if (oldBottom <= row * TILE + 0.5 && ny + c.h >= row * TILE) {
          const x0 = Math.floor((c.x + 1) / TILE), x1 = Math.floor((c.x + c.w - 1) / TILE);
          for (let tx = x0; tx <= x1; tx++) {
            if (this.tileIs(tx, row, '=T')) {
              // från stegen: bara när man klättrar upp över toppen
              if (c.climbing && c.input && c.input.up) break;
              ny = row * TILE - c.h; c.onGround = true; c.climbing = false; this.landing(c, wasOnGround); c.vy = 0; break;
            }
          }
        }
      }
      // ner genom en tunn plattform: håll ner + hoppa
      if (c.onGround && c.input && c.input.down && c.input.jumpPressed && this.tileIs(Math.floor((c.x + c.w / 2) / TILE), Math.floor((ny + c.h + 1) / TILE), '=')) {
        c.dropT = 0.25; c.onGround = false; ny += 2;
      }
      if (!c.onGround && !hit && c.vy >= 0) {
        // Landa på den andras huvud
        for (const o of this.chars) {
          if (o === c) continue;
          const overlapX = c.x + c.w > o.x + 1 && c.x < o.x + o.w - 1;
          if (overlapX && oldBottom <= o.y + 1 && ny + c.h >= o.y) {
            ny = o.y - c.h; c.onGround = true; c.standingOn = o;
            this.landing(c, wasOnGround);
            c.vy = 0;
            break;
          }
        }
      }
      c.y = ny;

      if (c.x < 0) { c.x = 0; c.vx = 0; }
      if (c.x + c.w > this.cols * TILE) { c.x = this.cols * TILE - c.w; c.vx = 0; }
      if (c.landT > 0) c.landT -= dt;
      if (c.smashT > 0) {
        c.smashT -= dt;
        if (c.smashT <= 0.14 && !c.punched) {
          c.punched = true;
          if (c.smashTarget) { this.breakWall(c.smashTarget[0], c.smashTarget[1]); c.smashTarget = null; }
          else this.punchAir(c);
        }
      }

      // Fartstreck för Edvin
      if (!st.strong && c.onGround && Math.abs(c.vx) > st.speed * 0.92 && Math.random() < 0.5) {
        this.particles.push({ x: c.x + c.w / 2 - c.facing * 8, y: c.y + 6 + Math.random() * 20, vx: -c.facing * 40, vy: 0, life: 0.18, col: 'rgba(255,255,255,0.7)', w: 4, h: 1, g: 0 });
      }
    }

    landing(c, wasOnGround) {
      if (wasOnGround || c.vy <= 60) return;
      const heavy = c.stats.strong;
      const hard = c.vy > 200;
      c.landT = heavy ? (hard ? 0.16 : 0.08) : (hard ? 0.07 : 0.03);
      this.sound.ensure(); this.sound.land(heavy && hard);
      this.spawnDust(c.x + c.w / 2, c.y + c.h + (c.vy * 0), heavy ? (hard ? 10 : 5) : 3);
      if (heavy && hard) this.shake = Math.max(this.shake, 2);
    }

    // Den som står på någon följer med i x och y
    carryRiders() {
      for (const c of this.chars) {
        if (!c.standingOn) continue;
        const o = c.standingOn;
        const dx = o.x - o.prevX;
        const targetY = o.y - c.h;
        const r = { x: c.x + dx, y: targetY, w: c.w, h: c.h };
        if (!this.collides(r)) { c.x += dx; c.y = targetY; }
        else if (!this.collides({ x: c.x, y: targetY, w: c.w, h: c.h })) c.y = targetY;
        else { o.y = c.y + c.h; o.vy = Math.max(0, o.vy); }
      }
    }

    tryPush(c, b, dir, dt) {
      if (b.move) return;
      c.pushHold += dt;
      b.wobble = Math.min(1, c.pushHold / 0.14);
      if (c.pushHold < 0.14) return;    // upptakt – det ska kännas tungt
      if (this.cellFree(b.tx + dir, b.ty, b) && !this.charOnBlock(b)) {
        b.move = { fx: b.x, fy: b.y, tx: (b.tx + dir) * TILE, ty: b.y, t: 0, dur: 0.42, push: dir };
        b.tx += dir;
        c.pushHold = 0.06;
        this.sound.ensure(); this.sound.push();
      }
    }
    charOnBlock(b) {
      const r = { x: b.x, y: b.y - 2, w: TILE, h: 2 };
      return this.chars.some(c => this.overlap(r, c));
    }

    animate(c, dt) {
      let anim;
      if (c.smashT > 0) anim = 'smash';
      else if (c.pickT > 0) anim = 'land';
      else if (c.climbing) anim = 'climb';
      else if (st0(c) && !c.onGround && c.wallT > 0 && c.vy > 0) anim = 'push';
      else if (c.prejumpT > 0) anim = 'land';
      else if (c.pushing) anim = 'push';
      else if (!c.onGround) anim = c.vy < 0 ? 'jump' : 'fall';
      else if (c.landT > 0) anim = 'land';
      else if (Math.abs(c.vx) > 6) anim = 'run';
      else anim = 'idle';
      // Emote när figuren stått still en stund (Hedda spänner musklerna, Edvin kollar klockan / joggar)
      if (anim === 'idle') c.idleT += dt; else c.idleT = 0;
      const em = c.stats.emotes;
      if (anim === 'idle' && em && c.idleT > 3 && ((c.idleT - 3) % 6) < 1.8) {
        const pick = em[Math.floor((c.idleT - 3) / 6) % em.length];
        if (this.sprites[c.type].right[pick]) anim = pick;
      }
      if (anim !== c.anim) { c.anim = anim; c.frame = 0; c.animT = 0; c.stepAcc = 0; }
      const frames = this.sprites[c.type].right[anim];
      if (anim === 'climb') {
        c.stepAcc += Math.abs(c.vy) * dt;
        while (c.stepAcc >= 7) { c.stepAcc -= 7; c.frame = (c.frame + 1) % frames.length; }
      } else if (anim === 'run') {
        // Frame-byte styrs av tillryggalagd sträcka – fötterna glider aldrig
        c.stepAcc += Math.abs(c.vx) * dt;
        while (c.stepAcc >= c.stats.stride) {
          c.stepAcc -= c.stats.stride;
          c.frame = (c.frame + 1) % frames.length;
          if (c.frame === 0 || c.frame === 3) {
            this.sound.step(c.stats.strong);
            if (c.stats.strong) this.spawnDust(c.x + c.w / 2 - c.facing * 3, c.y + c.h, 2);
          }
        }
      } else if (anim === 'smash') {
        c.frame = c.smashT > 0.14 ? 0 : 1;
      } else {
        const fps = anim === 'idle' ? (c.stats.strong ? 1.4 : 1.8) : (anim === 'push' ? 5 : ({ flex: 3, watch: 2.5, jog: 8 }[anim] || 6));
        c.animT += dt * fps;
        if (c.animT >= 1) { c.animT -= 1; c.frame = (c.frame + 1) % frames.length; }
      }
      if (c.frame >= frames.length) c.frame = 0;
    }

    doAction(c) {
      const footY = Math.floor((c.y + c.h - 1) / TILE);
      for (const key in this.triggers) {
        const t = this.triggers[key];
        if (t.type === 'plate') continue;
        const near = Math.abs(t.x * TILE + 8 - (c.x + c.w / 2)) < 16 && Math.abs(t.y - footY) <= 1;
        if (!near) continue;
        this.sound.ensure();
        if (t.type === 'lever') { t.on = !t.on; this.sound.lever(); this.toast(t.on ? 'Klick! Något öppnades.' : 'Spaken tillbaka.', 1.6); }
        else if (t.type === 'button') { t.timer = t.time; t.on = true; this.sound.click(); this.toast('Snabbt nu!', 1.4); }
        return;
      }
      // Sprucken vägg framför eller intill
      const cx = Math.floor((c.x + c.w / 2) / TILE);
      const cand = [];
      for (let dy = 0; dy < 2; dy++) {
        cand.push([cx + c.facing, footY - dy], [cx, footY - dy]);
      }
      for (const [tx, ty] of cand) {
        if (this.tileAt(tx, ty) !== 'C') continue;
        const dist = Math.abs((tx * TILE + 8) - (c.x + c.w / 2));
        if (dist > 18) continue;
        if (c.stats.strong) {
          if (c.smashT > 0) return;
          c.facing = tx * TILE + 8 > c.x + c.w / 2 ? 1 : -1;
          c.smashT = 0.36; c.smashTarget = [tx, ty]; c.punched = false; c.vx = 0;
        } else { this.toast('Edvin är för klen – byt till Hedda (TAB)', 2); this.sound.nope(); }
        return;
      }
      // Hedda kan alltid slå, även i luften framför sig
      if (c.stats.strong && c.smashT <= 0 && c.onGround) {
        c.smashT = 0.36; c.smashTarget = null; c.punched = false; c.vx = 0;
      }
    }

    // Slag som inte träffar en sprucken vägg: låda skakar, annars ett svisch i luften
    punchAir(c) {
      const fx = c.x + c.w / 2 + c.facing * 18, fy = c.y + 12;
      const hitBlock = this.blocks.find(b => fx >= b.x && fx <= b.x + TILE && fy >= b.y - 4 && fy <= b.y + TILE);
      this.sound.ensure();
      if (hitBlock) {
        hitBlock.wobble = 1;
        this.shake = Math.max(this.shake, 2);
        this.sound.thud();
        for (let i = 0; i < 6; i++) this.particles.push({ x: fx, y: fy + Math.random() * 6, vx: -c.facing * (20 + Math.random() * 40), vy: -Math.random() * 60, life: 0.35, col: '#d29c62', w: 1, h: 1, g: 0.5 });
      } else {
        this.sound.whoosh();
        for (let i = 0; i < 4; i++) this.particles.push({ x: fx - c.facing * 4, y: fy + i * 2 - 2, vx: c.facing * (60 + i * 15), vy: 0, life: 0.14, col: 'rgba(255,255,255,0.8)', w: 3, h: 1, g: 0 });
      }
    }

    breakWall(tx, ty) {
      let y0 = ty; while (this.tileAt(tx, y0 - 1) === 'C') y0--;
      let y1 = ty; while (this.tileAt(tx, y1 + 1) === 'C') y1++;
      if (this.tileAt(tx, ty) === 'X') { // hemlig vägg: bryt alla X i kolumnen
        y0 = ty; while (this.tileAt(tx, y0 - 1) === 'X') y0--;
        y1 = ty; while (this.tileAt(tx, y1 + 1) === 'X') y1++;
      }
      for (let y = y0; y <= y1; y++) {
        this.grid[y][tx] = '.';
        for (let i = 0; i < 10; i++) {
          const big = Math.random() > 0.6;
          this.particles.push({
            x: tx * TILE + Math.random() * TILE, y: y * TILE + Math.random() * TILE,
            vx: (Math.random() - 0.3) * 170 * (this.chars[this.active].facing), vy: -Math.random() * 170 - 30,
            life: 0.7 + Math.random() * 0.5, col: Math.random() > 0.5 ? '#7b7f8f' : '#9a9eac', w: big ? 2 : 1, h: big ? 2 : 1, g: 1, bounce: true
          });
        }
      }
      this.shake = 6;
      this.sound.ensure(); this.sound.brk();
    }

    updateBlocks(dt) {
      for (const b of this.blocks) {
        b._prevX = b.x;
        if (b.wobble > 0 && !b.move) b.wobble = Math.max(0, b.wobble - dt * 4);
        if (b.move) {
          b.move.t += dt;
          const p = Math.min(1, b.move.t / b.move.dur);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // ease-in-out
          b.x = b.move.fx + (b.move.tx - b.move.fx) * (b.move.fall ? p * p : e);
          b.y = b.move.fy + (b.move.ty - b.move.fy) * (b.move.fall ? p * p : e);
          if (b.move.push && Math.random() < 0.4) {
            this.particles.push({ x: b.x + (b.move.push > 0 ? 1 : 15), y: b.y + 15, vx: -b.move.push * 20, vy: -10, life: 0.3, col: 'rgba(200,180,150,0.8)', w: 1, h: 1, g: 0.1 });
          }
          if (p >= 1) {
            if (b.move.fall || b.move.push) { this.shake = Math.max(this.shake, b.move.fall ? 3 : 1); this.sound.thud(); this.spawnDust(b.x + 8, b.y + 16, 4); }
            b.move = null; b.x = b.tx * TILE; b.y = b.ty * TILE;
          }
        } else {
          const below = b.ty + 1;
          const solidBelow = this.isSolidTile(b.tx, below) || this.tileIs(b.tx, below, '=T') || this.blocks.some(o => o !== b && o.tx === b.tx && o.ty === below);
          if (!solidBelow && below < this.rows) {
            const r = { x: b.tx * TILE, y: below * TILE, w: TILE, h: TILE };
            if (!this.chars.some(c => this.overlap(r, c))) {
              b.move = { fx: b.x, fy: b.y, tx: b.x, ty: below * TILE, t: 0, dur: 0.16, fall: true };
              b.ty = below;
            }
          }
        }
      }
    }

    updateTriggers(dt) {
      for (const key in this.triggers) {
        const t = this.triggers[key];
        if (t.type === 'plate') {
          const pressed = t.cells.some(cell => {
            const r = { x: cell.x * TILE + 2, y: cell.y * TILE + 8, w: TILE - 4, h: 8 };
            return this.blocks.some(b => this.overlap(r, { x: b.x, y: b.y, w: TILE, h: TILE })) ||
              this.chars.some(c => this.overlap(r, { x: c.x, y: c.y + c.h - 3, w: c.w, h: 3 }));
          });
          if (pressed !== t.on) { this.sound.ensure(); this.sound.click(); }
          t.on = pressed;
        } else if (t.type === 'button' && t.timer > 0) {
          t.timer -= dt;
          const sec = Math.ceil(t.timer);
          if (sec !== t.lastTick) { t.lastTick = sec; this.sound.tick(); }
          if (t.timer <= 0) { t.on = false; t.timer = 0; }
        }
      }
    }

    updateDoors(dt) {
      for (const key in this.doors) {
        const d = this.doors[key];
        const open = this.evalLogic(d.expr);
        const was = d.target;
        d.target = open ? 1 : 0;
        if (d.target !== was) { this.sound.ensure(); this.sound.gate(open); }
        const speed = d.kind === 'gate' ? (open ? 4 : 6) : 7;
        if (d.open < d.target) d.open = Math.min(d.target, d.open + dt * speed);
        else if (d.open > d.target) d.open = Math.max(d.target, d.open - dt * speed);
        // Ett galler stänger aldrig på någon
        if (d.kind === 'gate' && d.target === 0) {
          for (const cell of d.cells) {
            const r = { x: cell.x * TILE, y: cell.y * TILE, w: TILE, h: TILE };
            if (this.chars.some(c => this.overlap(r, c)) || this.blocks.some(b => this.overlap(r, { x: b.x, y: b.y, w: TILE, h: TILE }))) d.open = Math.max(d.open, 0.95);
          }
        }
      }
    }

    updateHen(dt) {
      const h = this.hen; if (!h) return;
      h.animT += dt;
      h.nextT -= dt;
      const celebrating = this.winT > 0 || this.state === 'done';
      if (celebrating) {
        h.anim = 'flap';
        if (h.animT > 0.09) { h.animT = 0; h.frame = (h.frame + 1) % 2; }
        h.hop = Math.abs(Math.sin(this.time * 9)) * 4;
        if (Math.random() < dt * 4) this.particles.push({ x: h.x + 8, y: h.y + 8, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, life: 1.3, col: Math.random() > 0.5 ? '#f7f1e6' : '#d9945a', w: 1, h: 1, g: 0.12, feather: true });
        return;
      }
      h.hop = Math.max(0, h.hop - dt * 20);
      if (h.walkTo !== null) {
        const d = h.walkTo - h.x;
        if (Math.abs(d) < 0.5) { h.walkTo = null; h.anim = 'idle'; }
        else { h.x += Math.sign(d) * Math.min(Math.abs(d), 18 * dt); h.facing = Math.sign(d); h.anim = 'walk'; }
      }
      if (h.nextT <= 0 && h.walkTo === null) {
        const r = Math.random();
        if (r < 0.38) { h.anim = 'peck'; h.nextT = 0.9; }
        else if (r < 0.55) { h.anim = 'jerk'; h.nextT = 0.5; }
        else if (r < 0.7) { const t = h.homeX + (Math.random() - 0.5) * 20; h.walkTo = t; h.nextT = 1.2; }
        else if (r < 0.8) { h.anim = 'flap'; h.nextT = 0.5; h.hop = 3; if (this.state === 'play' && Math.abs(h.x - this.camX - W / 2) < W / 2) this.sound.cluck(); }
        else if (r < 0.88) { h.facing = -h.facing; h.anim = 'idle'; h.nextT = 0.7; }
        else { h.anim = 'idle'; h.nextT = 0.8 + Math.random(); }
        h.animT = 0; h.frame = 0;
      }
      const fps = { peck: 10, jerk: 6, flap: 12, walk: 6, idle: 1 }[h.anim] || 4;
      if (h.animT > 1 / fps) {
        h.animT = 0;
        const n = this.sprites.hen.right[h.anim].length;
        h.frame = (h.frame + 1) % n;
      }
    }

    updateTips() {
      const tips = this.level.tips || [];
      const a = this.chars[this.active];
      const tx = (a.x + a.w / 2) / TILE;
      let cur = '';
      for (const t of tips) if (Math.abs(tx - t.x) < 3.5) cur = t.text;
      this.ui.tip = cur;
    }

    checkHazards() {
      let dead = false;
      for (const c of this.chars) {
        if (c.y > this.rows * TILE + 30) dead = true;
        const x0 = Math.floor(c.x / TILE), x1 = Math.floor((c.x + c.w - 0.001) / TILE);
        const y0 = Math.floor(c.y / TILE), y1 = Math.floor((c.y + c.h - 0.001) / TILE);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
          if (this.tileAt(tx, ty) === '^' && this.overlap({ x: tx * TILE + 1, y: ty * TILE + 6, w: TILE - 2, h: TILE - 6 }, c)) dead = true;
        }
      }
      if (dead) {
        this.deathT = 1.0; this.shake = 6; this.flash = 1;
        this.sound.ensure(); this.sound.hurt();
        this.toast('Aj! Vi tar det igen.', 1.2);
      }
    }

    checkWin() {
      const h = this.hen;
      if (!h) return;
      const hr = { x: h.x + 2, y: h.y + 4, w: 12, h: 12 };
      for (const c of this.chars) {
        if (this.overlap(hr, c)) { this.startCatch(c); return; }
      }
    }

    // ----- Fångstanimation -----
    // 0–0.35 s: hönan blir skrämd ("!") och flaxar upp
    // 0.35–0.8 s: hon flyger i en båge och landar på fångarens huvud
    // 0.8– s: fångaren jublar och hoppar med hönan på huvudet, konfetti; slutet tonas ut
    startCatch(c) {
      const h = this.hen;
      this.winT = 3.4;
      this.catchAnim = { c, t: 0, sx: h.x, sy: h.y, caught: false, lastHop: 0 };
      c.vx = 0; c.vy = 0; c.pushing = 0; c.smashT = 0; c.prejumpT = 0;
      c.facing = (h.x + 8 > c.x + c.w / 2) ? 1 : -1;
      h.facing = -c.facing; h.walkTo = null; h.hop = 0;
      this.sound.ensure(); this.sound.cluck();
      this.ui.tip = ''; this.hintT = 0;
    }

    updateCatch(dt) {
      const ca = this.catchAnim, c = ca.c, h = this.hen;
      ca.t += dt;
      const t = ca.t;
      const fx = c.x + c.w / 2, fy = c.y + c.h;
      // hönans vingslag
      h.animT += dt;
      if (h.animT > 0.08) { h.animT = 0; h.frame = (h.frame + 1) % 2; }
      h.anim = 'flap'; h.hop = 0;

      if (t < 0.35) {
        const p = t / 0.35;
        h.x = ca.sx; h.y = ca.sy - Math.sin(p * Math.PI) * 10;
        c.anim = 'land'; c.frame = 0; c.drawDy = 0;
      } else if (t < 0.8) {
        const p = (t - 0.35) / 0.45;
        const tx = fx - 8, ty = fy - 50;
        const e = p * p * (3 - 2 * p);
        h.x = ca.sx + (tx - ca.sx) * e;
        h.y = ca.sy + (ty - ca.sy) * e - Math.sin(p * Math.PI) * 24;
        h.facing = c.facing;
        c.anim = 'land'; c.frame = 0; c.drawDy = 0;
      } else {
        if (!ca.caught) {
          ca.caught = true;
          this.sound.win();
          this.toast('Fångad!', 2.4);
          this.spawnRing(fx, fy - 40, '#fff3c4');
          this.confetti(fx, fy - 44, 30);
        }
        // jubelhopp med hönan på huvudet
        const period = 0.46;
        const ph = ((t - 0.8) % period) / period;
        const hop = Math.sin(ph * Math.PI) * 9;
        const hopIndex = Math.floor((t - 0.8) / period);
        if (hopIndex !== ca.lastHop) {
          ca.lastHop = hopIndex;
          this.spawnDust(fx, fy, 3);
          this.sound.step(false);
          if (hopIndex % 2 === 0) this.confetti(fx, fy - 50, 10);
        }
        c.drawDy = -Math.round(hop);
        c.anim = 'cheer';
        c.frame = hop > 1.5 ? 0 : 1;
        const headDrop = c.frame === 1 ? 2 : 0;
        h.x = fx - 8;
        h.y = fy + c.drawDy - 50 + headDrop;
        h.facing = c.facing;
        if (Math.random() < dt * 6) this.particles.push({ x: h.x + 8, y: h.y + 6, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, life: 1.3, col: Math.random() > 0.5 ? '#f7f1e6' : '#d9945a', w: 1, h: 1, g: 0.12, feather: true });
      }
    }

    confetti(x, y, n) {
      const cols = ['#f2d25a', '#f0a3c2', '#b6ef3a', '#6f8fd6', '#fff3c4', '#d8403d'];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const v = 60 + Math.random() * 110;
        this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + Math.random() * 0.8, col: cols[i % cols.length], w: Math.random() > 0.5 ? 2 : 1, h: 1, g: 0.25, feather: true });
      }
    }

    toast(msg, t) { this.ui.toast = msg; this.toastT = t || 2; }

    // ----- Partiklar -----
    spawnDust(x, y, n) {
      for (let i = 0; i < n; i++) this.particles.push({
        x: x + (Math.random() - 0.5) * 8, y: y - 1 - Math.random() * 2,
        vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 25,
        life: 0.25 + Math.random() * 0.3, col: 'rgba(235,225,205,0.9)', w: Math.random() > 0.5 ? 2 : 1, h: 1, g: 0.08
      });
    }
    spawnRing(x, y, col) {
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2;
        this.particles.push({ x, y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0.3, col, w: 1, h: 1, g: 0 });
      }
    }
    updateParticles(dt) {
      for (const p of this.particles) {
        p.life -= dt;
        p.vy += GRAVITY * (p.g || 0) * dt;
        if (p.feather) p.vx += Math.sin(this.time * 10 + p.y) * 30 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.bounce && this.isSolidTile(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) && p.vy > 0) { p.vy *= -0.35; p.vx *= 0.6; p.y -= 1; }
      }
      this.particles = this.particles.filter(p => p.life > 0);
    }

    // ----- Rendering -----
    renderWardrobe() {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      this.drawBackground(ctx, 0);
      ctx.fillStyle = 'rgba(20,16,30,0.55)'; ctx.fillRect(0, 0, W, H);
      // golv
      const floorY = 214 + (H - WORLD_H);
      ctx.fillStyle = '#3a3448'; ctx.fillRect(0, floorY, W, H - floorY);
      ctx.fillStyle = '#4c4560'; ctx.fillRect(0, floorY, W, 2);
      const names = ['edvin', 'hedda'];
      names.forEach((name, i) => {
        const sel = this.wd.char === i;
        const set = this.sprites[name].right;
        const em = STATS[name].emotes;
        const cyc = Math.floor(this.time / 5);
        const emoting = sel && (this.time % 5) > 3.2;
        const frames = emoting ? set[em[cyc % em.length]] : set.idle;
        const img = frames[Math.floor(this.time * (emoting ? 4 : 1.6)) % frames.length];
        const s = 3, cx = i === 0 ? 66 : W - 66;
        // spotlight
        ctx.fillStyle = sel ? 'rgba(255,243,196,0.16)' : 'rgba(255,255,255,0.04)';
        ctx.beginPath(); ctx.ellipse(cx, floorY - 2, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
        if (sel) { // pil ovanför vald figur
          const ay = floorY - 40 * s - 4 + Math.round(Math.sin(this.time * 6) * 2);
          ctx.fillStyle = '#f2d25a';
          ctx.fillRect(cx - 4, ay, 9, 2); ctx.fillRect(cx - 3, ay + 2, 7, 1); ctx.fillRect(cx - 2, ay + 3, 5, 1); ctx.fillRect(cx - 1, ay + 4, 3, 1);
        }
        ctx.globalAlpha = sel ? 1 : 0.45;
        ctx.drawImage(img, cx - 16 * s, floorY - 40 * s, 32 * s, 40 * s);
        if (name === 'hedda' && this.outfit.hedda.bag === 1 && this.birkinUnlocked()) this.drawBag(ctx, cx + 5 * s, floorY - 14 * s, s);
        ctx.globalAlpha = 1;
      });
      const u = this.ui;
      const name = this.wd.char === 0 ? 'edvin' : 'hedda';
      u.title = 'GARDEROB'; u.subtitle = ''; u.hint = ''; u.level = ''; u.tip = ''; u.toast = '';
      u.wd = {
        name: name === 'edvin' ? 'EDVIN' : 'HEDDA',
        side: this.wd.char,
        rows: this.wardrobeLists(name).map(([label, key, list], r) => ({ label, value: (list[this.outfit[name][key] || 0] || list[0]).name, sel: r === this.wd.row }))
      };
    }

    render() {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      if (this.state === 'wardrobe') { this.renderWardrobe(); return; }
      this.ui.wd = null;
      ctx.save();
      if (this.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
      const camX = Math.round(this.camX);
      this.drawBackground(ctx, camX);

      ctx.save();
      const camY = Math.round(this.camY);
      ctx.translate(-camX, -camY);   // camY < 0 när banan är lägre än vyn: extra himmel ovanför
      this.drawLiftShafts(ctx);
      this.drawTiles(ctx, camX);
      this.drawCircuits(ctx);
      this.drawLabels(ctx);
      this.drawLifts(ctx);
      this.drawBlocks(ctx);
      this.drawItems(ctx);
      const henOnTop = this.catchAnim && this.catchAnim.t > 0.35;   // hönan på huvudet ritas ovanpå
      if (!henOnTop) this.drawHen(ctx);
      const order = [1 - this.active, this.active];
      if (this.catchAnim) order.sort((a, b) => (this.chars[a] === this.catchAnim.c ? 1 : 0) - (this.chars[b] === this.catchAnim.c ? 1 : 0));
      order.forEach(i => this.drawCharacter(ctx, this.chars[i], i === this.active && this.state === 'play'));
      if (henOnTop) this.drawHen(ctx);
      this.drawParticles(ctx);
      ctx.restore();

      if (this.state === 'play') { this.drawHUD(ctx); this.drawHUDItems(ctx); }
      ctx.restore();
      if (this.taskUI) this.drawTask(ctx); else { this.ui.taskTitle = ''; this.ui.taskHelp = ''; }

      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`; ctx.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - 0.08); }
      if (this.deathT > 0) { ctx.fillStyle = `rgba(20,16,30,${Math.min(1, (1 - this.deathT) * 1.6)})`; ctx.fillRect(0, 0, W, H); }
      if (this.winT > 0 && this.winT < 0.45) { ctx.fillStyle = `rgba(20,16,30,${1 - this.winT / 0.45})`; ctx.fillRect(0, 0, W, H); }
      if (this.state === 'play' && this.levelT < 0.5) { ctx.fillStyle = `rgba(20,16,30,${1 - this.levelT * 2})`; ctx.fillRect(0, 0, W, H); }

      // Text till HTML-lagret
      const u = this.ui;
      if (this.state === 'title') {
        u.title = 'EDVIN & HEDDA'; u.subtitle = 'och hönan som rymde'; u.hint = 'Tryck MELLANSLAG för att börja'; u.level = '';
      } else if (this.state === 'done') {
        u.title = 'HÖNAN ÄR HEMMA!'; u.subtitle = 'Bra jobbat, Edvin och Hedda'; u.hint = 'Tryck MELLANSLAG för att spela igen'; u.level = '';
      } else {
        u.title = this.levelT < 2.6 ? this.level.name : '';
        u.subtitle = this.levelT < 2.6 ? `Bana ${this.levelIndex + 1}` : '';
        u.hint = this.hintT > 0 && !u.tip ? this.level.hint : '';
        u.level = `BANA ${this.levelIndex + 1}/${this.levels.length}`;
      }
    }

    drawBackground(ctx, camX) {
      const bg = this.sprites.bg;
      ctx.drawImage(bg.sky, 0, 0);
      // moln
      for (let i = 0; i < 6; i++) {
        const img = bg.clouds[i % bg.clouds.length];
        const span = W + 140;
        const x = ((i * 131 - camX * 0.08 + this.time * (2 + i % 3)) % span + span) % span - 70;
        const y = 16 + (i * 29) % 64;
        ctx.drawImage(img, Math.round(x), y);
      }
      // parallax i höjdled: när kameran går uppåt sjunker bakgrunden lite
      const up = Math.max(0, (this.rows * TILE - H) - (this.camY || 0));
      const layer = (img, f, yOff) => {
        const off = ((Math.round(camX * f) % img.width) + img.width) % img.width;
        const y = yOff + Math.round(up * f * 0.5);
        ctx.drawImage(img, -off, y); ctx.drawImage(img, img.width - off, y);
      };
      layer(bg.mountains, 0.15, -30);
      layer(bg.hills, 0.3, -24);
      // dis mellan lagren
      ctx.fillStyle = 'rgba(220,238,242,0.25)'; ctx.fillRect(0, H - 120, W, 120);
      layer(bg.forest, 0.5, -36);
    }

    drawTiles(ctx, camX) {
      const S = this.sprites;
      const x0 = Math.max(0, Math.floor(camX / TILE) - 1), x1 = Math.min(this.cols - 1, Math.ceil((camX + W) / TILE) + 1);
      const tufts = [];
      const cy = Math.round(this.camY || 0);
      const y0 = Math.max(0, Math.floor(cy / TILE) - 1), y1 = Math.min(this.rows - 1, Math.ceil((cy + H) / TILE) + 1);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = this.grid[ty][tx];
        const px = tx * TILE, py = ty * TILE;
        if (t === '#') {
          const above = this.tileAt(tx, ty - 1);
          const top = !(above === '#' || above === 'S');
          ctx.drawImage(S.tile(top ? 'grass' : 'dirt', tx, ty), px, py);
          if (top && (above === '.' || above === 'O')) tufts.push([tx, ty]);
          // kantlinje mot luft
          if (!this.isSolidTile(tx - 1, ty)) { ctx.fillStyle = 'rgba(40,24,16,0.35)'; ctx.fillRect(px, py, 1, TILE); }
          if (!this.isSolidTile(tx + 1, ty)) { ctx.fillStyle = 'rgba(40,24,16,0.35)'; ctx.fillRect(px + 15, py, 1, TILE); }
        } else if (t === 'S') {
          ctx.drawImage(S.tile('stone', tx, ty), px, py);
          // väggar som når banans tak fortsätter upp i den extra himlen
          if (ty === 0 && cy < 0) for (let k = 1; k * TILE < -cy + TILE; k++) ctx.drawImage(S.tile('stone', tx, -k & 7), px, py - k * TILE);
        }
        else if (t === 'C') ctx.drawImage(S.tile('cracked', tx, ty), px, py);
        else if (t === 'X') this.drawSecretTile(ctx, tx, ty, px, py);
        else if (t === '^') ctx.drawImage(S.tile('spikes', tx, ty), px, py);
        else if (t === 'L' || t === 'T' || t === '=') this.drawClimbTile(ctx, t, tx, ty, px, py);
        else if (isTrigCh(t)) this.drawTrigger(ctx, this.triggers[t], px, py);
        else if (isGateCh(t)) this.drawGateCell(ctx, tx, ty, px, py);
        else if (t >= 'e' && t <= 'h') this.drawBridgeCell(ctx, this.doors[t], px, py);
      }
      for (const [tx, ty] of tufts) ctx.drawImage(S.tile('tufts', tx, ty), tx * TILE, ty * TILE - 4);
    }

    drawTrigger(ctx, tr, px, py) {
      const S = this.sprites;
      if (tr.type === 'plate') ctx.drawImage(S.tile('plate', 0, 0, tr.on ? 1 : 0), px, py);
      else if (tr.type === 'lever') ctx.drawImage(S.tile('lever', 0, 0, tr.on ? 1 : 0), px, py);
      else {
        ctx.drawImage(S.tile('button', 0, 0, tr.on ? 1 : 0), px, py);
        if (tr.on) {
          const frac = tr.timer / tr.time;
          ctx.fillStyle = '#1e1e28'; ctx.fillRect(px, py - 7, 16, 4);
          ctx.fillStyle = frac > 0.35 ? '#b6ef3a' : (Math.floor(this.time * 8) % 2 ? '#d8403d' : '#ff8a86');
          ctx.fillRect(px + 1, py - 6, Math.max(1, Math.round(14 * frac)), 2);
        }
      }
    }

    drawGateCell(ctx, tx, ty, px, py) {
      const t = this.grid[ty][tx];
      const d = this.doors[t];
      const above = this.tileAt(tx, ty - 1);
      if (above === t) return;              // ritas från översta cellen
      let n = 0; while (this.tileAt(tx, ty + n) === t) n++;
      const total = n * TILE;
      const h = Math.round(total * (1 - d.open));
      // skena i väggen
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + 2, py, 12, total);
      // gallerstänger
      for (const bx of [2, 7, 12]) {
        ctx.fillStyle = '#3a3f4c'; ctx.fillRect(px + bx, py, 2, h);
        ctx.fillStyle = '#7d8596'; ctx.fillRect(px + bx, py, 1, h);
      }
      for (let yy = 6; yy < h - 2; yy += 10) { ctx.fillStyle = '#4c5262'; ctx.fillRect(px + 1, py + yy, 14, 2); ctx.fillStyle = '#8f97a8'; ctx.fillRect(px + 1, py + yy, 14, 1); }
      if (h > 3) {
        ctx.fillStyle = '#4c5262'; ctx.fillRect(px + 1, py + h - 3, 14, 3);
        ctx.fillStyle = '#9ba4b8'; ctx.fillRect(px + 1, py + h - 3, 14, 1);
        // spetsar
        ctx.fillStyle = '#7d8596'; [2, 7, 12].forEach(bx => ctx.fillRect(px + bx, py + h, 2, 1));
      }
      // lampa
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(px + 5, py - 5, 6, 4);
      ctx.fillStyle = d.target ? '#b6ef3a' : '#d8403d'; ctx.fillRect(px + 6, py - 4, 4, 2);
    }

    drawBridgeCell(ctx, d, px, py) {
      if (d.open > 0.02) {
        const dy = Math.round((1 - d.open) * 6);
        ctx.globalAlpha = d.open;
        ctx.drawImage(this.sprites.tile('plank', 0, 0, 1), px, py + dy);
        ctx.globalAlpha = 1;
      } else {
        // streckad kontur som visar var bron kommer
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let x = 0; x < 16; x += 4) ctx.fillRect(px + x, py, 2, 1);
      }
    }

    drawBlocks(ctx) {
      for (const b of this.blocks) {
        const wob = b.wobble > 0 && !b.move ? Math.round(Math.sin(this.time * 60) * b.wobble) : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y) + 15, 15, 2);
        ctx.drawImage(this.sprites.tile('crate', 0, 0), Math.round(b.x) + wob, Math.round(b.y));
      }
    }

    drawHen(ctx) {
      const h = this.hen; if (!h) return;
      const set = h.facing > 0 ? this.sprites.hen.right : this.sprites.hen.left;
      const frames = set[h.anim] || set.idle;
      const img = frames[h.frame % frames.length];
      const x = Math.round(h.x), y = Math.round(h.y - h.hop);
      const ca = this.catchAnim;
      if (!ca) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(Math.round(h.x) + 4, Math.round(h.y) + 15, 9, 1); }
      ctx.drawImage(img, x, y);
      // skrämd: "!" i en pratbubbla
      if (ca && ca.t < 0.45) {
        const bx = x + 4, by = y - 13;
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(bx - 1, by - 1, 9, 11);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, 7, 9);
        ctx.fillStyle = '#d8403d'; ctx.fillRect(bx + 3, by + 1, 1, 5); ctx.fillRect(bx + 3, by + 7, 1, 1);
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(bx + 2, by + 10, 3, 1); ctx.fillRect(bx + 3, by + 11, 1, 1);
      }
      // liten studsande markering första sekunderna så man ser målet
      if (this.state === 'play' && this.levelT < 4 && this.winT <= 0) {
        const by = y - 8 + Math.round(Math.sin(this.time * 5) * 2);
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(x + 6, by - 1, 5, 6);
        ctx.fillStyle = '#f2d25a'; ctx.fillRect(x + 7, by, 3, 3); ctx.fillRect(x + 8, by + 3, 1, 1);
      }
    }

    drawCharacter(ctx, c, isActive) {
      const set = c.facing > 0 ? this.sprites[c.type].right : this.sprites[c.type].left;
      const frames = set[c.anim] || set.idle;
      const img = frames[c.frame % frames.length];
      const fx = Math.round(c.x + c.w / 2), fy = Math.round(c.y + c.h);
      const dy = (this.catchAnim && this.catchAnim.c === c) ? (c.drawDy || 0) : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(fx - 6, fy - 1, 12, 2);
      ctx.drawImage(img, fx - 16, fy - 40 + dy);
      if (this.catchAnim) isActive = false;
      if (isActive) {
        const bob = Math.round(Math.sin(this.time * 6) * 1.5);
        const ax = fx, ay = fy - 44 + bob;
        ctx.fillStyle = '#1e1e28';
        ctx.fillRect(ax - 4, ay - 4, 9, 2); ctx.fillRect(ax - 3, ay - 2, 7, 1); ctx.fillRect(ax - 2, ay - 1, 5, 1); ctx.fillRect(ax - 1, ay, 3, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ax - 3, ay - 3, 7, 1); ctx.fillRect(ax - 2, ay - 2, 5, 1); ctx.fillRect(ax - 1, ay - 1, 3, 1); ctx.fillRect(ax, ay, 1, 1);
      }
    }

    drawParticles(ctx) {
      for (const p of this.particles) {
        ctx.globalAlpha = Math.min(1, p.life * 3);
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w || 1, p.h || 1);
      }
      ctx.globalAlpha = 1;
    }

    drawHUD(ctx) {
      // Porträtt med ram; aktiv figur i färg, inaktiv gråtonad
      this.chars.forEach((c, i) => {
        const x = 6 + i * 34, y = 6;
        const act = i === this.active;
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(x - 2, y - 2, 32, 22);
        ctx.fillStyle = act ? c.stats.color : '#4a4858'; ctx.fillRect(x - 1, y - 1, 30, 20);
        ctx.fillStyle = act ? '#2c2a3a' : '#2a2834'; ctx.fillRect(x, y, 28, 18);
        if (!act) ctx.filter = 'grayscale(1) brightness(0.7)';
        ctx.drawImage(this.sprites[c.type].portrait, x + 2, y + 3);
        ctx.filter = 'none';
      });
      // TAB-knapp
      const kx = 74, ky = 8;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(kx - 1, ky - 1, 23, 15);
      ctx.fillStyle = '#d9d6e4'; ctx.fillRect(kx, ky, 21, 13);
      ctx.fillStyle = '#f6f4fb'; ctx.fillRect(kx, ky, 21, 2);
      ctx.fillStyle = '#9c98ad'; ctx.fillRect(kx, ky + 11, 21, 2);
      ctx.fillStyle = '#1e1e28';
      // T
      ctx.fillRect(kx + 3, ky + 3, 5, 1); ctx.fillRect(kx + 5, ky + 4, 1, 5);
      // A
      ctx.fillRect(kx + 9, ky + 4, 1, 5); ctx.fillRect(kx + 12, ky + 4, 1, 5); ctx.fillRect(kx + 10, ky + 3, 2, 1); ctx.fillRect(kx + 10, ky + 6, 2, 1);
      // B
      ctx.fillRect(kx + 14, ky + 3, 1, 6); ctx.fillRect(kx + 15, ky + 3, 2, 1); ctx.fillRect(kx + 15, ky + 5, 2, 1); ctx.fillRect(kx + 15, ky + 8, 2, 1);
      ctx.fillRect(kx + 17, ky + 4, 1, 1); ctx.fillRect(kx + 17, ky + 6, 1, 2);
    }
  }

  window.Game = Game;
  window.GAME_CONST = { TILE, get W() { return W; }, get H() { return H; }, WORLD_H, STATS, HIT_W, HIT_H, setView };
})();
