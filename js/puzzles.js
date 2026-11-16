// puzzles.js – föremål och inventarie, logikgrindar med kablar, uttag/kortläsare, rörpost,
// hissar, terminaler med minispel, stegar och Birkin-väskan. Lägger metoder på Game.prototype.
(function () {
  'use strict';

  const G = window.Game.prototype;
  const TILE = 16;
  const C = () => window.GAME_CONST;
  const INV_MAX = 4;

  // ================= LOGIK =================
  // Uttryck: "3", "AND(1,2)", "OR(1,m)", "XOR(5,6)", "NOT(3)". ID = en siffra 1–9 eller bokstav m–z.
  function tokenize(s) { return s.match(/0x[0-9A-Fa-f]+|[A-Z]+|\d+|[a-z]|[(),]/g) || []; }
  function parse(expr) {
    const tk = tokenize(String(expr));
    let i = 0;
    function node() {
      const t = tk[i++];
      if (/^[A-Z]+$/.test(t)) {
        i++;
        const args = [];
        while (tk[i] !== ')') { args.push(node()); if (tk[i] === ',') i++; }
        i++;
        const n = { op: t, args };
        if (t === 'CODE') { n.value = args[0].value; n.args = args.slice(1); }
        return n;
      }
      if (/^0x/.test(t)) return { op: 'NUM', value: parseInt(t, 16) };
      if (t.length > 1) return { op: 'NUM', value: parseInt(t, 10) };
      return { op: 'ID', id: t };
    }
    return node();
  }
  G.logicNode = function (expr) {
    this._logicCache = this._logicCache || {};
    if (!this._logicCache[expr]) this._logicCache[expr] = parse(expr);
    return this._logicCache[expr];
  };
  G.evalNode = function (n) {
    switch (n.op) {
      case 'ID': return !!(this.triggers[n.id] && this.triggers[n.id].on);
      case 'AND': return n.args.every(a => this.evalNode(a));
      case 'OR': return n.args.some(a => this.evalNode(a));
      case 'XOR': return n.args.filter(a => this.evalNode(a)).length % 2 === 1;
      case 'NOT': return !this.evalNode(n.args[0]);
      case 'CODE': return n.args.reduce((v, a) => v * 2 + (this.evalNode(a) ? 1 : 0), 0) === n.value;
      default: return false;
    }
  };
  G.evalLogic = function (expr) { return expr ? this.evalNode(this.logicNode(expr)) : false; };

  const GATE_INFO = {
    AND: 'AND-grind: ger ström bara när ALLA ingångar har ström.',
    OR: 'OR-grind: ger ström när MINST EN ingång har ström.',
    XOR: 'XOR-grind: ger ström när EXAKT EN ingång har ström – inte båda.',
    NOT: 'NOT-grind: vänder signalen. Ström in = ingen ström ut, och tvärtom.'
  };

  // ================= FÖREMÅL =================
  const ITEMS = {
    wrench: { name: 'Skiftnyckel', heavy: false },
    battery: { name: 'Batteri', heavy: true },
    fuse: { name: 'Säkring', heavy: false },
    keycard: { name: 'Nyckelkort', heavy: false },
    birkin: { name: 'Birkin bag', heavy: false }
  };
  G.ITEMS = ITEMS;
  const IPAL = {
    M: '#b9bfcc', m: '#7d8496', D: '#4b5160',
    B: '#2b2f3a', Y: '#f2d25a', y: '#c9a63a', r: '#d8403d', k: '#c8ccd6',
    w: '#cfe9f2', W: '#ffffff', C: '#4a7ad0', c: '#2f5aa8', h: '#f2d25a',
    O: '#e07b2a', o: '#b85c18', d: '#7a3b10', G: '#f2d25a'
  };
  const ISPR = {
    wrench: ['.MM........', 'M..MMMMMMMm', 'm..mmmmmmmD', '.mm........'],
    battery: ['.kk...kk.', 'BBBBBBBBB', 'BYYYYYYYB', 'BYYrYYYYB', 'ByyyyyyyB', 'BBBBBBBBB', 'BDDDDDDDB', 'BBBBBBBBB'],
    fuse: ['.MMMM.', '.mmmm.', '.wrrw.', '.wrWw.', '.wrrw.', '.MMMM.', '.mmmm.'],
    keycard: ['CCCCCCCCC', 'ChhCCCCCC', 'ChhCCCWWC', 'CCCCCCCCC', 'CWWWWWWWC', 'ccccccccc'],
    birkin: ['..ddddd..', '.d.....d.', 'oOOOOOOOo', 'OOOOGOOOO', 'OOOOOOOOO', 'oOOOOOOOo', '.ooooooo.']
  };
  const sprCache = {};
  function itemSprite(type) {
    if (sprCache[type]) return sprCache[type];
    const g = ISPR[type];
    const c = document.createElement('canvas'); c.width = g[0].length; c.height = g.length;
    const ctx = c.getContext('2d');
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { ctx.fillStyle = IPAL[ch]; ctx.fillRect(x, y, 1, 1); } }));
    sprCache[type] = c;
    return c;
  }
  G.itemSprite = itemSprite;

  G.loadItems = function (lv) {
    this.items = (lv.items || []).map(([type, tx, ty]) => {
      const s = itemSprite(type);
      return { type, w: s.width, h: s.height, x: tx * TILE + (TILE - s.width) / 2, y: (ty + 1) * TILE - s.height, vy: 0, holder: null, socket: null, home: [tx, ty], anim: null };
    });
    // tömda inventarier
    for (const c of this.chars) { c.inv = []; c.sel = 0; }
  };
  G.heldBy = function (c) { return (c.inv && c.inv[c.sel]) || null; };
  G.handPos = function (c, it) { return [c.x + c.w / 2 - it.w / 2 + c.facing * 7, c.y + 15 - it.h / 2]; };
  G.removeFromInv = function (c, it) {
    const i = c.inv.indexOf(it);
    if (i >= 0) c.inv.splice(i, 1);
    if (c.sel >= c.inv.length) c.sel = Math.max(0, c.inv.length - 1);
    it.holder = null;
  };
  G.findInInv = function (c, types) {
    const sel = this.heldBy(c);
    if (sel && types.includes(sel.type)) return sel;
    return c.inv.find(i => types.includes(i.type)) || null;
  };

  G.pickUp = function (c, it, fromXY) {
    if (it.type === 'birkin') { this.findBirkin(c, it); return; }
    if (ITEMS[it.type].heavy && !c.stats.strong) { this.sound.nope(); this.toast('För tungt för Edvin – Hedda kan bära det', 2); return; }
    if (c.inv.length >= INV_MAX) { this.sound.nope(); this.toast('Inventariet är fullt (4 saker). Släpp något med F.', 2.2); return; }
    it.holder = c; it.socket = null;
    const [sx, sy] = fromXY || [it.x, it.y];
    it.anim = { kind: 'pick', t: 0, dur: 0.3, sx, sy };
    c.inv.push(it); c.sel = c.inv.length - 1;
    c.pickT = 0.3; c.vx = 0;
    this.sound.pickup();
    this.toast('+ ' + ITEMS[it.type].name, 1.3);
  };

  G.dropItem = function (c) {
    const it = this.heldBy(c);
    if (!it) { this.toast('Inget valt att släppa (välj fack 1–4)', 1.4); return; }
    this.removeFromInv(c, it);
    [it.x, it.y] = this.handPos(c, it);
    it.vy = -70; it.anim = null;
    this.sound.drop();
  };

  G.insertItem = function (c, it, trig) {
    this.removeFromInv(c, it);
    const [sx, sy] = this.handPos(c, it);
    trig.pending = it;
    it.anim = { kind: 'insert', t: 0, dur: 0.32, sx, sy, tx: trig.x * TILE + 8 - it.w / 2, ty: trig.y * TILE + 2 - it.h / 2, trig };
    c.pickT = 0.2;
    this.sound.drop();
  };

  G.sendTube = function (c, it, trig) {
    this.removeFromInv(c, it);
    const [sx, sy] = this.handPos(c, it);
    const [ox, oy] = trig.to;
    it.anim = { kind: 'tube', t: 0, dur: 1.0, sx, sy, tx: trig.x * TILE + 8 - it.w / 2, ty: trig.y * TILE + 4, ox: ox * TILE + 8 - it.w / 2, oy: oy * TILE + 2 };
    c.pickT = 0.2;
    this.sound.whoosh();
    this.toast(ITEMS[it.type].name + ' skickad med rörposten', 1.6);
  };

  G.updateItems = function (dt) {
    for (const it of this.items) {
      if (it.socket) continue;
      if (it.anim) {
        const a = it.anim;
        a.t += dt;
        const p = Math.min(1, a.t / a.dur);
        if (a.kind === 'pick') {
          const [hx, hy] = this.handPos(it.holder, it);
          it.x = a.sx + (hx - a.sx) * p; it.y = a.sy + (hy - a.sy) * p - Math.sin(p * Math.PI) * 14;
          if (p >= 1) { it.anim = null; this.sparkle(it.x + it.w / 2, it.y + it.h / 2, '#fff3c4'); }
        } else if (a.kind === 'insert') {
          const e = p * p * (3 - 2 * p);
          it.x = a.sx + (a.tx - a.sx) * e; it.y = a.sy + (a.ty - a.sy) * e - Math.sin(p * Math.PI) * 8;
          if (p >= 1) {
            it.anim = null; it.socket = a.trig; a.trig.holds = it; a.trig.pending = null; a.trig.on = true;
            this.sound.insert(); this.spawnRing(a.trig.x * TILE + 8, a.trig.y * TILE + 4, '#ffd23f');
          }
        } else if (a.kind === 'tube') {
          if (a.t < 0.3) { const q = a.t / 0.3; it.x = a.sx + (a.tx - a.sx) * q; it.y = a.sy + (a.ty - a.sy) * q; }
          else if (a.t < 0.75) { it.hidden = true; }
          else { it.hidden = false; it.x = a.ox; it.y = a.oy; it.vy = -40; it.anim = null; this.sound.pickup(); this.sparkle(it.x + it.w / 2, it.y + it.h / 2, '#9ad6ff'); }
        }
        continue;
      }
      if (it.holder) {
        [it.x, it.y] = this.handPos(it.holder, it);
        continue;
      }
      const oldBottom = it.y + it.h;
      it.vy = Math.min(360, it.vy + 900 * dt);
      let ny = it.y + it.vy * dt;
      const hit = this.collides({ x: it.x, y: ny, w: it.w, h: it.h });
      if (hit && it.vy > 0) { ny = hit.y - it.h; it.vy = 0; }
      else if (hit && it.vy < 0) { it.vy = 0; ny = it.y; }
      else if (it.vy > 0) {
        const row = Math.floor((ny + it.h) / TILE);
        if (oldBottom <= row * TILE + 0.5 && ny + it.h >= row * TILE) {
          for (let tx = Math.floor(it.x / TILE); tx <= Math.floor((it.x + it.w - 1) / TILE); tx++) {
            if (this.tileIs(tx, row, '=T')) { ny = row * TILE - it.h; it.vy = 0; break; }
          }
        }
      }
      it.y = ny;
      if (it.y > this.rows * TILE + 40) {
        it.x = it.home[0] * TILE + (TILE - it.w) / 2; it.y = (it.home[1] + 1) * TILE - it.h; it.vy = 0;
        this.toast(ITEMS[it.type].name + ' hittade tillbaka', 1.5);
      }
    }
  };

  G.sparkle = function (x, y, col) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.3, col, w: 1, h: 1, g: 0 });
    }
  };

  // ================= E-KNAPPEN =================
  G.doAction = function (c) {
    const footY = Math.floor((c.y + c.h - 1) / TILE);
    const ccx = c.x + c.w / 2;
    this.sound.ensure();
    if (c.pickT > 0) return;

    // 1. Saker vid figuren: spakar, knappar, uttag, kortläsare, rörpost, terminaler
    let bestT = null, bestD = 99;
    for (const key in this.triggers) {
      const t = this.triggers[key];
      if (t.type === 'plate') continue;
      const d = Math.abs(t.x * TILE + 8 - ccx);
      if (d < 16 && Math.abs(t.y - footY) <= 1 && d < bestD) { bestT = t; bestD = d; }
    }
    if (bestT && this.useTrigger(c, bestT)) return;

    // 2. Plocka upp närmaste föremål
    let best = null, bd = 99;
    for (const it of this.items) {
      if (it.holder || it.socket || it.anim || it.hidden) continue;
      const dx = Math.abs(it.x + it.w / 2 - ccx);
      const vOK = it.y + it.h > c.y - 2 && it.y < c.y + c.h + 3;
      if (dx < 19 && vOK && dx < bd) { best = it; bd = dx; }
    }
    if (best) { this.pickUp(c, best); return; }

    // 3. Spruckna och hemliga väggar
    const cx = Math.floor(ccx / TILE);
    for (let dy = 0; dy < 2; dy++) for (const tx of [cx + c.facing, cx]) {
      const ty = footY - dy;
      const t = this.tileAt(tx, ty);
      if (t !== 'C' && t !== 'X') continue;
      if (Math.abs(tx * TILE + 8 - ccx) > 18) continue;
      if (c.stats.strong) {
        if (c.smashT > 0) return;
        c.facing = tx * TILE + 8 > ccx ? 1 : -1;
        c.smashT = 0.36; c.smashTarget = [tx, ty]; c.punched = false; c.vx = 0;
        return;
      }
      if (t === 'C') { this.toast('Edvin är för klen – byt till Hedda (TAB)', 2); this.sound.nope(); return; }
    }

    // 4. Hedda slår i luften
    if (c.stats.strong && c.smashT <= 0 && c.onGround) { c.smashT = 0.36; c.smashTarget = null; c.punched = false; c.vx = 0; }
  };

  const names = types => types.map(a => ITEMS[a].name.toLowerCase()).join(' eller ');
  G.useTrigger = function (c, t) {
    if (t.type === 'lever') {
      if (t.broken) {
        const w = this.findInInv(c, ['wrench']);
        if (w) {
          t.broken = false;
          this.removeFromInv(c, w); this.items = this.items.filter(i => i !== w);
          c.pickT = 0.3; this.sound.lever(); this.spawnRing(t.x * TILE + 8, t.y * TILE + 8, '#b9bfcc');
          this.toast('Spaken lagad med skiftnyckeln! Tryck E igen för att dra.', 2.4);
        } else { this.sound.nope(); this.toast('Spaken är trasig – den behöver lagas med ett verktyg.', 2.4); }
        return true;
      }
      t.on = !t.on; this.sound.lever();
      return true;
    }
    if (t.type === 'button') { t.timer = t.time; t.on = true; this.sound.click(); this.toast('Snabbt nu!', 1.4); return true; }
    if (t.type === 'socket' || t.type === 'reader') {
      if (t.pending) return true;
      if (!t.holds) {
        const it = this.findInInv(c, t.accepts);
        if (it) { this.insertItem(c, it, t); return true; }
        this.sound.nope(); this.toast('Här behövs: ' + names(t.accepts), 1.8);
        return true;
      }
      // ta ut det som sitter i
      const it = t.holds;
      if (ITEMS[it.type].heavy && !c.stats.strong) { this.sound.nope(); this.toast('För tungt för Edvin – Hedda kan bära det', 2); return true; }
      if (c.inv.length >= INV_MAX) { this.sound.nope(); this.toast('Inventariet är fullt.', 1.6); return true; }
      t.holds = null; t.on = false; it.socket = null;
      this.pickUp(c, it, [it.x, it.y]);
      return true;
    }
    if (t.type === 'tube') {
      const it = this.heldBy(c) || c.inv[0];
      if (!it) { this.toast('Rörpost: välj något i inventariet och tryck E för att skicka det.', 2.4); return true; }
      if (ITEMS[it.type].heavy) { this.sound.nope(); this.toast('Batteriet är för stort för rörposten.', 2); return true; }
      this.sendTube(c, it, t);
      return true;
    }
    if (t.type === 'task') {
      if (t.done) { this.toast('Den uppgiften är redan klar.', 1.4); return true; }
      this.openTask(t, c);
      return true;
    }
    return false;
  };

  // ================= HISSAR =================
  G.loadLifts = function (lv) {
    this.lifts = (lv.lifts || []).map(d => {
      const L = { id: d.id, x: d.x * TILE, w: d.w * TILE, h: TILE, yB: d.bottom * TILE, yT: d.top * TILE, expr: d.logic, speed: d.speed || 70, moving: false };
      L.y = L.prevY = this.evalLogic(L.expr) ? L.yT : L.yB;
      return L;
    });
  };
  G.updateLifts = function (dt) {
    for (const L of this.lifts) {
      L.prevY = L.y;
      const target = this.evalLogic(L.expr) ? L.yT : L.yB;
      if (Math.abs(target - L.y) < 0.5) { if (L.moving) { L.moving = false; this.sound.thud(); } L.y = target; continue; }
      const step = Math.sign(target - L.y) * Math.min(Math.abs(target - L.y), L.speed * dt);
      const ny = L.y + step;
      const riders = this.chars.filter(c => c.onLift === L || (Math.abs(c.y + c.h - L.y) < 1.5 && c.x + c.w > L.x && c.x < L.x + L.w && !c.climbing));
      // stoppa om något står i vägen (under hissen på väg ner, eller i taket på väg upp)
      const newRect = { x: L.x, y: ny, w: L.w, h: L.h };
      const blocked = this.chars.some(c => !riders.includes(c) && this.overlap(newRect, c)) ||
        (step < 0 && riders.some(c => { const saved = this.lifts; this.lifts = []; const hit = this.collides({ x: c.x, y: c.y + step, w: c.w, h: c.h }); this.lifts = saved; return hit; }));
      if (blocked) continue;
      L.y = ny;
      if (!L.moving) { L.moving = true; this.sound.gate(step < 0); }
      for (const c of riders) { c.y += step; if (step < 0) c.vy = Math.min(c.vy, 0); }
      for (const it of this.items) {
        if (it.holder || it.socket || it.anim) continue;
        if (Math.abs(it.y + it.h - L.prevY) < 1.5 && it.x + it.w > L.x && it.x < L.x + L.w) it.y += step;
      }
    }
  };

  G.drawLiftShafts = function (ctx) {
    for (const L of this.lifts) {
      const top = L.yT - 8, bot = L.yB + L.h;
      ctx.fillStyle = 'rgba(30,26,44,0.22)'; ctx.fillRect(L.x, top, L.w, bot - top);
      ctx.fillStyle = '#4a4c5a'; ctx.fillRect(L.x - 2, top, 2, bot - top); ctx.fillRect(L.x + L.w, top, 2, bot - top);
      ctx.fillStyle = '#6d7080'; ctx.fillRect(L.x - 2, top, 1, bot - top); ctx.fillRect(L.x + L.w, top, 1, bot - top);
    }
  };
  G.drawLifts = function (ctx) {
    for (const L of this.lifts) {
      const x = L.x, y = Math.round(L.y), w = L.w;
      // vajrar upp till taket
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(x + 3, L.yT - 8, 1, y - (L.yT - 8)); ctx.fillRect(x + w - 4, L.yT - 8, 1, y - (L.yT - 8));
      // plattform med varningsränder
      ctx.fillStyle = '#5b5e6b'; ctx.fillRect(x, y, w, 16);
      ctx.fillStyle = '#8b8f9e'; ctx.fillRect(x, y + 4, w, 1);
      for (let i = 0; i < w; i += 6) { ctx.fillStyle = '#f2d25a'; ctx.fillRect(x + i, y, 3, 4); ctx.fillStyle = '#1e1e28'; ctx.fillRect(x + i + 3, y, 3, 4); }
      ctx.fillStyle = '#3a3c48'; ctx.fillRect(x, y + 14, w, 2);
      // motorlåda vid botten med lampa
      const powered = this.evalLogic(L.expr);
      const mx = x - 13, my = L.yB + 2;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(mx - 1, my - 1, 12, 12);
      ctx.fillStyle = '#55606e'; ctx.fillRect(mx, my, 10, 10);
      ctx.fillStyle = powered ? '#b6ef3a' : '#d8403d'; ctx.fillRect(mx + 3, my + 3, 4, 4);
      this.pixText(ctx, 'H', mx + 3, my - 8, '#fff3c4');
    }
  };

  // ================= TERMINALER OCH MINISPEL =================
  const TASK_INFO = {
    wires: { title: 'KOPPLA KABLARNA', help: 'Upp/ner väljer. E kopplar ihop samma färger, vänster till höger.' },
    calibrate: { title: 'KALIBRERA MÄTAREN', help: 'Tryck E när visaren är i det gröna fältet. Tre gånger.' },
    fill: { title: 'FYLL PÅ KYLVÄTSKA', help: 'Håll E för att fylla. Släpp mellan de gula strecken.' }
  };
  function shuffle(arr, seed) {
    const a = arr.slice(); let s = seed || 7;
    for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  G.openTask = function (trig, c) {
    const kind = trig.task;
    const ui = { trig, kind, t: 0, doneT: 0, done: false, err: 0 };
    if (kind === 'wires') { ui.right = shuffle([0, 1, 2, 3], trig.x * 31 + trig.y); if (ui.right.join() === '0,1,2,3') ui.right = [2, 0, 3, 1]; ui.links = {}; ui.phase = 'L'; ui.li = 0; ui.ri = 0; }
    if (kind === 'calibrate') { ui.p = 0; ui.dir = 1; ui.v = 0.7; ui.hits = 0; ui.zw = 0.24; ui.zc = 0.65; }
    if (kind === 'fill') { ui.l = 0; ui.holding = false; ui.lo = 0.70; ui.hi = 0.82; }
    this.taskUI = ui;
    c.vx = 0;
    this.sound.click();
  };
  G.closeTask = function () { this.taskUI = null; };
  G.debugCompleteTask = function () { if (this.taskUI) { this.taskUI.done = true; } };

  G.updateTask = function (dt) {
    const u = this.taskUI, k = this.keys;
    u.t += dt;
    if (u.err > 0) u.err -= dt;
    if (k.backPressed) { this.closeTask(); this.toast('Uppgiften avbruten', 1.2); return; }
    if (u.done) {
      u.doneT += dt;
      if (u.doneT > 0.8) {
        u.trig.done = true; u.trig.on = true;
        this.closeTask();
        this.sound.win(); this.toast('Uppgift klar!', 1.6);
        this.spawnRing(u.trig.x * TILE + 8, u.trig.y * TILE + 4, '#b6ef3a');
      }
      return;
    }
    const confirm = k.actionPressed || k.confirmPressed;
    const fail = () => { u.err = 0.4; this.sound.nope(); };
    if (u.kind === 'wires') {
      const free = i => u.links[i] === undefined;
      const usedR = r => Object.values(u.links).includes(r);
      if (u.phase === 'L') {
        if (k.upPressed || k.downPressed) {
          const d = k.upPressed ? -1 : 1;
          for (let n = 0; n < 4; n++) { u.li = (u.li + d + 4) % 4; if (free(u.li)) break; }
          this.sound.tick();
        }
        if (!free(u.li)) u.li = [0, 1, 2, 3].find(free);
        if (confirm) { u.phase = 'R'; u.ri = [0, 1, 2, 3].find(r => !usedR(r)); this.sound.click(); }
      } else {
        if (k.upPressed || k.downPressed) {
          const d = k.upPressed ? -1 : 1;
          for (let n = 0; n < 4; n++) { u.ri = (u.ri + d + 4) % 4; if (!usedR(u.ri)) break; }
          this.sound.tick();
        }
        if (confirm) {
          if (u.right[u.ri] === u.li) {
            u.links[u.li] = u.ri; this.sound.insert();
            if (Object.keys(u.links).length === 4) u.done = true;
            else u.li = [0, 1, 2, 3].find(free);
          } else fail();
          u.phase = 'L';
        }
      }
    } else if (u.kind === 'calibrate') {
      u.p += u.dir * u.v * dt;
      if (u.p > 1) { u.p = 1; u.dir = -1; } else if (u.p < 0) { u.p = 0; u.dir = 1; }
      if (confirm) {
        if (Math.abs(u.p - u.zc) <= u.zw / 2) {
          u.hits++; this.sound.insert();
          if (u.hits >= 3) u.done = true;
          else { u.zw *= 0.78; u.v *= 1.3; u.zc = 0.15 + ((u.hits * 0.37 + u.trig.x * 0.11) % 0.7); }
        } else { u.hits = Math.max(0, u.hits - 1); fail(); }
      }
    } else if (u.kind === 'fill') {
      const holding = !!(k.actionHeld || k.jump);
      if (holding) {
        u.l += 0.42 * dt;
        if (u.l > 1) { u.l = 0; fail(); this.toast('Det rann över!', 1.2); }
        if (Math.random() < 0.3) this.sound.step(false);
      } else if (u.holding) {
        if (u.l >= u.lo && u.l <= u.hi) { u.done = true; this.sound.insert(); }
        else if (u.l > u.hi) { u.l = 0; fail(); this.toast('För mycket – töm och försök igen', 1.4); }
      }
      u.holding = holding;
    }
  };

  G.drawTask = function (ctx) {
    const W = C().W, H = C().H, u = this.taskUI;
    ctx.fillStyle = 'rgba(14,12,22,0.72)'; ctx.fillRect(0, 0, W, H);
    const pw = 220, ph = 130, px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - ph / 2 + 10);
    ctx.fillStyle = '#0f0d18'; ctx.fillRect(px - 3, py - 3, pw + 6, ph + 6);
    ctx.fillStyle = u.err > 0 ? '#4a1e24' : (u.done ? '#1f3a22' : '#232036'); ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#3a3654'; ctx.fillRect(px, py, pw, 2);
    if (u.kind === 'wires') {
      const cols = ['#d8403d', '#4a7ad0', '#f2d25a', '#f0a3c2'];
      const ly = i => py + 20 + i * 26, lx = px + 22, rx = px + pw - 22;
      for (let i = 0; i < 4; i++) {
        // vänster ände
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(lx - 14, ly(i) - 4, 14, 9);
        ctx.fillStyle = cols[i]; ctx.fillRect(lx - 13, ly(i) - 3, 12, 7);
        // höger ände (blandad ordning)
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(rx, ly(i) - 4, 14, 9);
        ctx.fillStyle = cols[u.right[i]]; ctx.fillRect(rx + 1, ly(i) - 3, 12, 7);
      }
      // kopplade kablar
      for (const li in u.links) this.taskLine(ctx, lx, ly(+li), rx, ly(u.links[li]), cols[li]);
      // markör
      const blink = Math.floor(this.time * 6) % 2;
      ctx.fillStyle = blink ? '#ffffff' : '#fff3c4';
      if (u.phase === 'L') { ctx.fillRect(lx - 18, ly(u.li) - 1, 3, 3); }
      else {
        this.taskLine(ctx, lx, ly(u.li), rx, ly(u.ri), cols[u.li], true);
        ctx.fillRect(rx + 16, ly(u.ri) - 1, 3, 3);
      }
    } else if (u.kind === 'calibrate') {
      const bx = px + 20, by = py + 50, bw = pw - 40;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(bx - 2, by - 2, bw + 4, 24);
      ctx.fillStyle = '#3a3448'; ctx.fillRect(bx, by, bw, 20);
      ctx.fillStyle = '#3e7a2a'; ctx.fillRect(Math.round(bx + (u.zc - u.zw / 2) * bw), by, Math.round(u.zw * bw), 20);
      ctx.fillStyle = '#b6ef3a'; ctx.fillRect(Math.round(bx + (u.zc - u.zw / 2) * bw), by, Math.round(u.zw * bw), 2);
      const nx = Math.round(bx + u.p * bw);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(nx - 1, by - 6, 3, 32);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < u.hits ? '#b6ef3a' : '#4a4858'; ctx.fillRect(px + pw / 2 - 26 + i * 20, py + 90, 12, 12); }
    } else if (u.kind === 'fill') {
      const tx = px + pw / 2 - 25, ty = py + 14, tw = 50, th = 100;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(tx - 3, ty - 3, tw + 6, th + 6);
      ctx.fillStyle = '#2c3a48'; ctx.fillRect(tx, ty, tw, th);
      const lh = Math.round(u.l * th);
      ctx.fillStyle = '#4ab3d0'; ctx.fillRect(tx, ty + th - lh, tw, lh);
      ctx.fillStyle = '#9ad6ff'; ctx.fillRect(tx, ty + th - lh, tw, 2);
      ctx.fillStyle = '#f2d25a';
      ctx.fillRect(tx - 8, Math.round(ty + th - u.lo * th), tw + 16, 1);
      ctx.fillRect(tx - 8, Math.round(ty + th - u.hi * th), tw + 16, 1);
    }
    if (u.done) { ctx.fillStyle = 'rgba(182,239,58,0.25)'; ctx.fillRect(px, py, pw, ph); }
    const info = TASK_INFO[u.kind];
    this.ui.taskTitle = u.done ? 'KLART!' : info.title;
    this.ui.taskHelp = info.help + ' Esc avbryter.';
  };
  G.taskLine = function (ctx, x0, y0, x1, y1, col, dashed) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      if (dashed && (i >> 2) % 2) continue;
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(x - 1, y - 2, 3, 5);
      ctx.fillStyle = col; ctx.fillRect(x, y - 1, 1, 3);
    }
  };

  // ================= BIRKIN (easter egg) =================
  // Väskan gäller bara under en spelomgång – den måste hittas igen varje gång man börjar från bana 1.
  G.birkinUnlocked = function () { return !!this._birkinMem; };
  G.resetBirkin = function () {
    this._birkinMem = false;
    if (this.outfit && this.outfit.hedda.bag) { this.outfit.hedda.bag = 0; this.saveOutfit(); }
    try { window.localStorage.removeItem('edvin_hedda_birkin'); } catch (e) { /* ok */ }
  };
  G.findBirkin = function (c, item) {
    if (c.type !== 'hedda') { this.sound.nope(); this.toast('Den där väskan är nog Heddas...', 2); return; }
    this.items = this.items.filter(i => i !== item);
    const first = !this.birkinUnlocked();
    this._birkinMem = true;
    this.outfit.hedda.bag = 1; this.saveOutfit();
    const x = c.x + c.w / 2, y = c.y;
    c.pickT = 0.3;
    this.confetti(x, y, 26);
    for (let i = 0; i < 12; i++) this.particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 40, life: 1.4, col: i % 2 ? '#f0a3c2' : '#ffd23f', w: 2, h: 2, g: -0.02 });
    this.spawnRing(x, y + 10, '#f2d25a');
    this.sound.win();
    this.toast(first ? 'Hedda hittade en Birkin bag! Den finns nu i garderoben.' : 'Birkin-väskan igen – Hedda bär den redan.', 3.4);
    c.idleT = 3.01;
  };
  G.drawBag = function (ctx, x, y, s) {
    const img = itemSprite('birkin');
    ctx.drawImage(img, Math.round(x), Math.round(y), img.width * (s || 1), img.height * (s || 1));
  };
  G.hasBag = function (c) { return c.type === 'hedda' && this.outfit && this.outfit.hedda.bag === 1 && this.birkinUnlocked(); };

  const baseDrawCharacter = G.drawCharacter;
  G.drawCharacter = function (ctx, c, isActive) {
    baseDrawCharacter.call(this, ctx, c, isActive);
    if (this.hasBag(c) && !this.heldBy(c)) {
      const fx = Math.round(c.x + c.w / 2), fy = Math.round(c.y + c.h);
      const dy = (this.catchAnim && this.catchAnim.c === c) ? (c.drawDy || 0) : 0;
      this.drawBag(ctx, c.facing > 0 ? fx + 5 : fx - 14, fy - 14 + dy, 1);
    }
  };

  // ================= TEXT =================
  const FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111',
    'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111', 'J': '001001001101010',
    'K': '101101110101101', 'L': '100100100100111', 'M': '101111111101101', 'N': '101111111111101', 'O': '010101101101010',
    'P': '110101110100100', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111',
    'V': '101101101101010', 'X': '101101010101101', 'Y': '101101010010010', 'Å': '010000111101101', 'Ä': '101000111101101',
    'Ö': '101000111101111', 'x': '000101010101000', '=': '000111000111000', ' ': '000000000000000', '?': '111001011000010',
    '!': '010010010000010', '-': '000000111000000', '+': '000010111010000'
  };
  G.pixText = function (ctx, str, x, y, col, scale) {
    const s = scale || 1;
    ctx.fillStyle = col;
    let cx = x;
    for (const ch of String(str)) {
      const g = FONT[ch] || FONT['?'];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
      cx += 4 * s;
    }
  };
  const textW = (s, sc) => String(s).length * 4 * (sc || 1) - (sc || 1);

  // ================= RITNING =================
  G.drawItems = function (ctx) {
    const a = this.chars[this.active];
    for (const it of this.items) {
      if (it.socket || it.hidden) continue;
      // i inventariet syns bara den valda saken (i handen)
      if (it.holder && !it.anim && this.heldBy(it.holder) !== it) continue;
      ctx.drawImage(itemSprite(it.type), Math.round(it.x), Math.round(it.y));
      if (!it.holder && !it.anim && this.state === 'play' && !this.catchAnim) {
        const dx = Math.abs(it.x + it.w / 2 - (a.x + a.w / 2));
        if (dx < 19 && it.y + it.h > a.y - 2 && it.y < a.y + a.h + 3) this.ePrompt(ctx, it.x + it.w / 2, it.y - 4);
      }
      if (it.type === 'birkin' && Math.random() < 0.03) this.particles.push({ x: it.x + Math.random() * it.w, y: it.y + Math.random() * 3, vx: 0, vy: -12, life: 0.5, col: '#fff3c4', w: 1, h: 1, g: 0 });
    }
    // tryck-E-markering vid terminaler, uttag m.m. när aktiv figur står där
    if (this.state === 'play' && !this.catchAnim && !this.taskUI) {
      const footY = Math.floor((a.y + a.h - 1) / TILE);
      for (const key in this.triggers) {
        const t = this.triggers[key];
        if (t.type === 'plate' || (t.type === 'task' && t.done)) continue;
        if (Math.abs(t.x * TILE + 8 - (a.x + a.w / 2)) < 16 && Math.abs(t.y - footY) <= 1) { this.ePrompt(ctx, t.x * TILE + 8, t.y * TILE - 8); break; }
      }
    }
  };
  G.ePrompt = function (ctx, cx, y) {
    const bx = Math.round(cx) - 3, by = Math.round(y) - 6 + Math.round(Math.sin(this.time * 6));
    ctx.fillStyle = '#1e1e28'; ctx.fillRect(bx - 1, by - 1, 7, 8);
    ctx.fillStyle = '#fff3c4'; ctx.fillRect(bx, by, 5, 6);
    this.pixText(ctx, 'E', bx + 1, by, '#1e1e28');
  };

  const baseDrawTrigger = G.drawTrigger;
  G.drawTrigger = function (ctx, tr, px, py) {
    if (tr.type === 'socket' || tr.type === 'reader') {
      ctx.fillStyle = '#3a3f4c'; ctx.fillRect(px + 6, py + 9, 4, 7);
      ctx.fillStyle = '#5b6070'; ctx.fillRect(px + 6, py + 9, 1, 7);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(px + 1, py - 4, 14, 14);
      ctx.fillStyle = tr.type === 'reader' ? '#4c5a74' : '#55606e'; ctx.fillRect(px + 2, py - 3, 12, 12);
      ctx.fillStyle = '#7d8798'; ctx.fillRect(px + 2, py - 3, 12, 1);
      if (tr.type === 'socket') {
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(px + 4, py - 1, 8, 8);
        if (tr.holds) { const img = itemSprite(tr.holds.type); ctx.drawImage(img, px + 8 - Math.floor(img.width / 2), py + 3 - Math.floor(img.height / 2)); }
        else { ctx.fillStyle = '#3a3f4c'; ctx.fillRect(px + 5, py, 6, 6); }
        ctx.fillStyle = tr.on ? '#ffd23f' : '#8a8f9e';
        ctx.fillRect(px + 12, py - 2, 1, 2); ctx.fillRect(px + 11, py, 2, 1); ctx.fillRect(px + 12, py + 1, 1, 2);
      } else {
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(px + 4, py + 2, 8, 2);
        if (tr.holds) { ctx.fillStyle = '#4a7ad0'; ctx.fillRect(px + 5, py - 2, 6, 5); ctx.fillStyle = '#f2d25a'; ctx.fillRect(px + 6, py - 1, 2, 2); }
        ctx.fillStyle = '#2a2a33'; ctx.fillRect(px + 5, py + 5, 6, 3);
        ctx.fillStyle = '#9ad6ff'; ctx.fillRect(px + 6, py + 6, 4, 1);
      }
      ctx.fillStyle = tr.on ? '#b6ef3a' : '#d8403d'; ctx.fillRect(px + 3, py - 2, 2, 2);
      return;
    }
    if (tr.type === 'task') {
      // dator på ett bord
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(px, py + 10, 16, 2); ctx.fillRect(px + 1, py + 12, 2, 4); ctx.fillRect(px + 13, py + 12, 2, 4);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(px + 1, py - 3, 14, 12);
      ctx.fillStyle = '#3a3c48'; ctx.fillRect(px + 2, py - 2, 12, 10);
      const blink = Math.floor(this.time * 3) % 2;
      ctx.fillStyle = tr.done ? '#3e7a2a' : (blink ? '#2a6a8a' : '#1f5070'); ctx.fillRect(px + 3, py - 1, 10, 7);
      if (tr.done) { ctx.fillStyle = '#b6ef3a'; ctx.fillRect(px + 5, py + 3, 1, 1); ctx.fillRect(px + 6, py + 4, 1, 1); ctx.fillRect(px + 7, py + 3, 1, 1); ctx.fillRect(px + 8, py + 2, 1, 1); ctx.fillRect(px + 9, py + 1, 1, 1); }
      else { ctx.fillStyle = '#9ad6ff'; ctx.fillRect(px + 4, py, 6, 1); ctx.fillRect(px + 4, py + 2, 4, 1); ctx.fillRect(px + 4, py + 4, 7, 1); }
      ctx.fillStyle = '#4a4858'; ctx.fillRect(px + 7, py + 8, 2, 2);
      return;
    }
    if (tr.type === 'tube') {
      // rörpost: rör ut ur väggen med öppning
      const dir = tr.to[0] > tr.x ? 1 : -1;
      const wx = dir > 0 ? px + 10 : px;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(wx - 1, py - 3, 8, 16);
      ctx.fillStyle = '#7d8798'; ctx.fillRect(wx, py - 2, 6, 14);
      ctx.fillStyle = '#9ad6ff'; ctx.fillRect(wx + 1, py, 4, 6);
      ctx.fillStyle = '#d0dcea'; ctx.fillRect(wx, py - 2, 6, 1);
      // pil mot väggen
      ctx.fillStyle = '#fff3c4'; const ax = px + 8 - dir * 2;
      ctx.fillRect(ax - 2, py + 10, 5, 1); ctx.fillRect(ax + dir * 2, py + 9, 1, 3);
      return;
    }
    if (tr.type === 'lever' && tr.broken) {
      ctx.fillStyle = '#444857'; ctx.fillRect(px + 4, py + 12, 8, 4);
      ctx.fillStyle = '#7c8190'; ctx.fillRect(px + 4, py + 12, 8, 1);
      ctx.fillStyle = '#9aa0ae'; ctx.fillRect(px + 7, py + 10, 1, 2); ctx.fillRect(px + 8, py + 9, 1, 1);
      ctx.fillStyle = '#9aa0ae'; ctx.fillRect(px + 11, py + 14, 3, 1);
      ctx.fillStyle = '#d8403d'; ctx.fillRect(px + 13, py + 13, 2, 2);
      if (Math.random() < 0.04) this.particles.push({ x: px + 8, y: py + 9, vx: (Math.random() - 0.5) * 40, vy: -30, life: 0.3, col: '#ffd23f', w: 1, h: 1, g: 0.5 });
      return;
    }
    baseDrawTrigger.call(this, ctx, tr, px, py);
  };

  // Rörpostens utgång på andra sidan väggen
  G.drawTubeOutputs = function (ctx) {
    for (const key in this.triggers) {
      const t = this.triggers[key];
      if (t.type !== 'tube') continue;
      const [ox, oy] = t.to, px = ox * TILE, py = oy * TILE;
      const dir = ox > t.x ? 1 : -1;
      const wx = dir > 0 ? px : px + 10;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(wx - 1, py - 3, 8, 12);
      ctx.fillStyle = '#7d8798'; ctx.fillRect(wx, py - 2, 6, 10);
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(wx + 1, py + 4, 4, 4);
    }
  };

  // Stegar och tunna plattformar
  G.drawClimbTile = function (ctx, t, tx, ty, px, py) {
    if (t === 'L' || t === 'T') {
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(px + 3, py, 2, 16); ctx.fillRect(px + 11, py, 2, 16);
      ctx.fillStyle = '#8a6438';
      for (let y = 2; y < 16; y += 5) ctx.fillRect(px + 3, py + y, 10, 2);
      ctx.fillStyle = '#a07a48'; ctx.fillRect(px + 3, py, 1, 16); ctx.fillRect(px + 11, py, 1, 16);
    }
    if (t === 'T' || t === '=') {
      ctx.fillStyle = '#875d33'; ctx.fillRect(px, py, 16, 5);
      ctx.fillStyle = '#d9a86c'; ctx.fillRect(px, py, 16, 1);
      ctx.fillStyle = '#5e3e20'; ctx.fillRect(px, py + 4, 16, 1);
      if (t === '=') { ctx.fillStyle = '#5e3e20'; ctx.fillRect(px + 2, py + 5, 1, 3); ctx.fillRect(px + 13, py + 5, 1, 3); }
    }
  };

  G.drawSecretTile = function (ctx, tx, ty, px, py) {
    ctx.drawImage(this.sprites.tile('stone', tx, ty), px, py);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px + 5, py + 4, 1, 1); ctx.fillRect(px + 6, py + 5, 1, 1); ctx.fillRect(px + 10, py + 11, 1, 1);
    if (Math.random() < 0.006) this.particles.push({ x: px + 4 + Math.random() * 8, y: py + 4 + Math.random() * 8, vx: 0, vy: -8, life: 0.6, col: '#fff3c4', w: 1, h: 1, g: 0 });
  };

  G.drawLabels = function (ctx) {
    this.drawTubeOutputs(ctx);
    for (const [tx, ty, text] of (this.level.labels || [])) {
      const w = textW(text);
      const x = tx * TILE + 8 - Math.ceil(w / 2), y = ty * TILE - 9;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(x - 2, y - 2, w + 4, 9);
      ctx.fillStyle = '#fff3c4'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
      this.pixText(ctx, text, x, y, '#1e1e28');
    }
  };

  // ================= KRETSAR =================
  function seg(ctx, x0, y0, x1, y1, w) {
    const x = Math.min(x0, x1), y = Math.min(y0, y1);
    ctx.fillRect(Math.round(x) - (w >> 1), Math.round(y) - (w >> 1), Math.abs(x1 - x0) + w, Math.abs(y1 - y0) + w);
  }
  function wire(ctx, pts, lit) {
    ctx.fillStyle = '#1e1e28';
    for (let i = 1; i < pts.length; i++) seg(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 4);
    ctx.fillStyle = lit ? '#ffd23f' : '#5a566c';
    for (let i = 1; i < pts.length; i++) seg(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 2);
  }

  // Alla utgångar som styrs av logik: galler, broar och hissar
  G.logicOutputs = function () {
    const outs = [];
    for (const key in this.doors) {
      const d = this.doors[key];
      if (!d.expr) continue;
      const top = d.cells.reduce((m, c) => (c.y < m.y || (c.y === m.y && c.x < m.x)) ? c : m, d.cells[0]);
      outs.push({ key, expr: d.expr, ax: top.x * TILE + 8, ay: d.kind === 'gate' ? top.y * TILE - 5 : top.y * TILE });
    }
    for (const L of this.lifts) outs.push({ key: L.id, expr: L.expr, ax: L.x - 8, ay: L.yB + 2 });
    return outs;
  };

  G.drawCircuits = function (ctx) {
    const at = this.level.logicAt || {};
    for (const o of this.logicOutputs()) {
      const node = this.logicNode(o.expr);
      const out = this.evalNode(node);
      const leafs = node.op === 'ID' ? [{ id: node.id }] : node.args.filter(a => a.op === 'ID').map(a => ({ id: a.id }));
      const hasIcon = node.op !== 'ID';
      const ic = at[o.key] ? [at[o.key][0] * TILE + 8, at[o.key][1] * TILE + 8] : [o.ax, o.ay - 40];
      const target = hasIcon ? ic : [o.ax, o.ay - 14];
      leafs.forEach((l, i) => {
        const t = this.triggers[l.id]; if (!t) return;
        const sx = t.x * TILE + 8, sy = t.y * TILE + (['socket', 'reader', 'task'].includes(t.type) ? -5 : 4);
        const ly = target[1] + (i - (leafs.length - 1) / 2) * 4;
        const ex = hasIcon ? (sx < target[0] ? target[0] - 20 : target[0] + 20) : target[0];
        wire(ctx, [[sx, sy], [sx, ly], [ex, ly]].concat(hasIcon ? [] : [[ex, o.ay]]), t.on);
      });
      if (!hasIcon) continue;
      wire(ctx, o.ax === ic[0] ? [[ic[0], ic[1] + 8], [o.ax, o.ay]] : [[ic[0], ic[1] + 8], [ic[0], o.ay - 10], [o.ax, o.ay - 10], [o.ax, o.ay]], out);
      // grindskylt med tydligt namn
      const label = node.op;
      const w = Math.max(textW(label, 2) + 10, 30);
      const x = Math.round(ic[0] - w / 2), y = Math.round(ic[1] - 9);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(x - 2, y - 2, w + 4, 22);
      ctx.fillStyle = out ? '#3e5a2a' : '#3a2f44'; ctx.fillRect(x, y, w, 18);
      ctx.fillStyle = out ? '#b6ef3a' : '#8a7fa0'; ctx.fillRect(x, y, w, 1);
      this.pixText(ctx, label, x + Math.round((w - textW(label, 2)) / 2), y + 3, out ? '#e8ffc8' : '#f2ecff', 2);
      this.pixText(ctx, 'GRIND', x + Math.round((w - textW('GRIND')) / 2), y + 20 + 2, '#fff3c4');
      if (node.op === 'NOT') { ctx.fillStyle = '#1e1e28'; ctx.fillRect(ic[0] - 3, y + 18, 7, 4); ctx.fillStyle = '#fff3c4'; ctx.fillRect(ic[0] - 2, y + 19, 5, 2); }
    }
  };

  // Tips: förklara grinden man står nära
  G.updateTips = function () {
    const a = this.chars[this.active];
    const tx = (a.x + a.w / 2) / TILE, fy = Math.floor((a.y + a.h - 1) / TILE);
    this.ui.tip = '';
    for (const t of (this.level.tips || [])) {
      if (Math.abs(tx - t.x) < 3.5 && (t.y === undefined || Math.abs(fy - t.y) <= 2)) { this.ui.tip = t.text; return; }
    }
    const at = this.level.logicAt || {};
    let best = null, bd = 1e9;
    for (const o of this.logicOutputs()) {
      const node = this.logicNode(o.expr);
      if (!GATE_INFO[node.op]) continue;
      const pts = [[o.ax, o.ay]]; if (at[o.key]) pts.push([at[o.key][0] * TILE + 8, at[o.key][1] * TILE + 8]);
      for (const [x, y] of pts) {
        const d = Math.hypot(x - (a.x + a.w / 2), y - (a.y + a.h / 2));
        if (d < 72 && d < bd) { bd = d; best = node.op; }
      }
    }
    if (best) this.ui.tip = GATE_INFO[best];
  };

  // ================= HUD: inventarie =================
  G.drawHUDItems = function (ctx) {
    const H = C().H;
    // vald sak bredvid porträtten
    this.chars.forEach((c, i) => {
      const it = this.heldBy(c);
      if (!it) return;
      const img = itemSprite(it.type);
      const x = 6 + i * 34 + 20, y = 6 + 12;
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(x - 1, y - 1, img.width + 2, img.height + 2);
      ctx.drawImage(img, x, y);
    });
    // inventarieraden för den aktiva figuren
    const c = this.chars[this.active];
    const x0 = 6, y0 = H - 26;
    ctx.fillStyle = 'rgba(20,16,30,0.7)'; ctx.fillRect(x0 - 3, y0 - 9, INV_MAX * 22 + 4, 32);
    this.pixText(ctx, c.type === 'edvin' ? 'EDVIN' : 'HEDDA', x0, y0 - 7, c.stats.color);
    for (let i = 0; i < INV_MAX; i++) {
      const x = x0 + i * 22, sel = i === c.sel;
      ctx.fillStyle = sel ? '#fff3c4' : '#1e1e28'; ctx.fillRect(x - 1, y0 - 1, 20, 20);
      ctx.fillStyle = sel ? '#3a3654' : '#2a2834'; ctx.fillRect(x, y0, 18, 18);
      const it = c.inv[i];
      if (it) { const img = itemSprite(it.type); ctx.drawImage(img, x + 9 - Math.floor(img.width / 2), y0 + 9 - Math.floor(img.height / 2)); }
      this.pixText(ctx, String(i + 1), x + 1, y0 + 1, sel ? '#f2d25a' : '#8a7fa0');
    }
  };
})();
