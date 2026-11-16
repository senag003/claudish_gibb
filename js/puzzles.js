// puzzles.js – föremål, verktyg, logikgrindar med kablar, uttag/kortläsare, binärlås och Birkin-väskan.
// Lägger till metoder på Game.prototype. Laddas efter engine.js.
(function () {
  'use strict';

  const G = window.Game.prototype;
  const TILE = 16;

  // ================= LOGIK =================
  // Uttryck: "3", "AND(1,2)", "OR(1,3)", "XOR(5,6)", "NOT(3)", "CODE(0xB,1,2,3,4)" (bitar MSB först)
  function tokenize(s) { return s.match(/0x[0-9A-Fa-f]+|[A-Z]+|\d+|[(),]/g) || []; }
  function parse(expr) {
    const tk = tokenize(String(expr));
    let i = 0;
    function node() {
      const t = tk[i++];
      if (/^[A-Z]+$/.test(t)) {
        i++; // '('
        const args = [];
        while (tk[i] !== ')') { args.push(node()); if (tk[i] === ',') i++; }
        i++; // ')'
        const n = { op: t, args };
        if (t === 'CODE') { n.value = args[0].value; n.args = args.slice(1); }
        return n;
      }
      if (/^0x/.test(t)) return { op: 'NUM', value: parseInt(t, 16), hex: true };
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
      case 'CODE': return this.codeValue(n) === n.value;
      default: return false;
    }
  };
  G.codeValue = function (n) { return n.args.reduce((v, a) => v * 2 + (this.evalNode(a) ? 1 : 0), 0); };
  G.evalLogic = function (expr) { return expr ? this.evalNode(this.logicNode(expr)) : false; };

  // ================= FÖREMÅL =================
  const ITEMS = {
    wrench: { name: 'Skiftnyckel', heavy: false },
    battery: { name: 'Batteri', heavy: true },
    fuse: { name: 'Säkring', heavy: false },
    keycard: { name: 'Nyckelkort', heavy: false },
    birkin: { name: 'Birkin bag', heavy: false }
  };
  const IPAL = {
    M: '#b9bfcc', m: '#7d8496', D: '#4b5160',
    B: '#2b2f3a', Y: '#f2d25a', y: '#c9a63a', r: '#d8403d', k: '#c8ccd6',
    w: '#cfe9f2', W: '#ffffff', g: '#e0b040',
    C: '#4a7ad0', c: '#2f5aa8', h: '#f2d25a',
    O: '#e07b2a', o: '#b85c18', d: '#7a3b10', G: '#f2d25a'
  };
  const ISPR = {
    wrench: [
      '.MM........',
      'M..MMMMMMMm',
      'm..mmmmmmmD',
      '.mm........'
    ],
    battery: [
      '.kk...kk.',
      'BBBBBBBBB',
      'BYYYYYYYB',
      'BYYrYYYYB',
      'ByyyyyyyB',
      'BBBBBBBBB',
      'BDDDDDDDB',
      'BBBBBBBBB'
    ],
    fuse: [
      '.MMMM.',
      '.mmmm.',
      '.wrrw.',
      '.wrWw.',
      '.wrrw.',
      '.MMMM.',
      '.mmmm.'
    ],
    keycard: [
      'CCCCCCCCC',
      'ChhCCCCCC',
      'ChhCCCWWC',
      'CCCCCCCCC',
      'CWWWWWWWC',
      'ccccccccc'
    ],
    birkin: [
      '..ddddd..',
      '.d.....d.',
      'oOOOOOOOo',
      'OOOOGOOOO',
      'OOOOOOOOO',
      'oOOOOOOOo',
      '.ooooooo.'
    ]
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
      return { type, w: s.width, h: s.height, x: tx * TILE + (TILE - s.width) / 2, y: (ty + 1) * TILE - s.height, vy: 0, holder: null, socket: null, home: [tx, ty] };
    });
  };
  G.heldBy = function (c) { return (this.items || []).find(i => i.holder === c) || null; };

  G.updateItems = function (dt) {
    for (const it of this.items) {
      if (it.socket) continue;
      if (it.holder) {
        const c = it.holder;
        it.x = c.x + c.w / 2 - it.w / 2 + c.facing * 7;
        it.y = c.y + 15 - it.h / 2;
        continue;
      }
      it.vy = Math.min(360, it.vy + 900 * dt);
      const ny = it.y + it.vy * dt;
      const hit = this.collides({ x: it.x, y: ny, w: it.w, h: it.h });
      if (hit && it.vy > 0) { it.y = hit.y - it.h; it.vy = 0; }
      else it.y = ny;
      if (it.y > this.rows * TILE + 40) { // föll ut ur banan – tillbaka till start
        it.x = it.home[0] * TILE + (TILE - it.w) / 2; it.y = (it.home[1] + 1) * TILE - it.h; it.vy = 0;
        this.toast(ITEMS[it.type].name + ' hittade tillbaka', 1.5);
      }
    }
  };

  // ================= E-KNAPPEN =================
  G.doAction = function (c) {
    const held = this.heldBy(c);
    const footY = Math.floor((c.y + c.h - 1) / TILE);
    const ccx = c.x + c.w / 2;
    this.sound.ensure();

    // 1. Spakar, knappar, uttag och kortläsare
    for (const key in this.triggers) {
      const t = this.triggers[key];
      if (t.type === 'plate') continue;
      const near = Math.abs(t.x * TILE + 8 - ccx) < 16 && Math.abs(t.y - footY) <= 1;
      if (!near) continue;
      if (t.type === 'lever') {
        if (t.broken) {
          if (held && held.type === 'wrench') {
            t.broken = false;
            this.items = this.items.filter(i => i !== held);
            this.sound.lever(); this.spawnRing(t.x * TILE + 8, t.y * TILE + 8, '#b9bfcc');
            this.toast('Spaken lagad! Tryck E igen för att dra i den.', 2.4);
          } else { this.sound.nope(); this.toast('Spaken är trasig – den behöver lagas med ett verktyg.', 2.4); }
          return;
        }
        t.on = !t.on; this.sound.lever();
        return;
      }
      if (t.type === 'button') { t.timer = t.time; t.on = true; this.sound.click(); this.toast('Snabbt nu!', 1.4); return; }
      if (t.type === 'socket' || t.type === 'reader') {
        const accepts = t.accepts || [];
        if (held && !t.holds) {
          if (accepts.includes(held.type)) {
            held.holder = null; held.socket = t; t.holds = held; t.on = true;
            this.sound.insert(); this.spawnRing(t.x * TILE + 8, t.y * TILE + 6, '#ffd23f');
            this.toast(ITEMS[held.type].name + ' på plats.', 1.4);
          } else {
            this.sound.nope();
            this.toast('Här passar bara: ' + accepts.map(a => ITEMS[a].name.toLowerCase()).join(', '), 2);
          }
          return;
        }
        if (!held && t.holds) {
          const it = t.holds;
          if (ITEMS[it.type].heavy && !c.stats.strong) { this.sound.nope(); this.toast('För tungt för Edvin – Hedda kan bära det', 2); return; }
          t.holds = null; t.on = false; it.socket = null; it.holder = c;
          this.sound.pickup();
          return;
        }
        if (!held && !t.holds) { this.toast('Här saknas: ' + accepts.map(a => ITEMS[a].name.toLowerCase()).join(', '), 1.8); return; }
        // bär något och uttaget är fullt: släpp istället (faller igenom nedan)
        break;
      }
    }

    // 2. Släpp det man bär
    if (held) {
      held.holder = null; held.vy = 0;
      held.x = ccx - held.w / 2 + c.facing * 6;
      this.sound.drop();
      return;
    }

    // 3. Plocka upp närmaste föremål
    let best = null, bestD = 99;
    for (const it of this.items) {
      if (it.holder || it.socket) continue;
      const dx = Math.abs(it.x + it.w / 2 - ccx);
      const vOK = it.y + it.h > c.y - 2 && it.y < c.y + c.h + 3;
      if (dx < 19 && vOK && dx < bestD) { best = it; bestD = dx; }
    }
    if (best) {
      if (best.type === 'birkin') { this.findBirkin(c, best); return; }
      if (ITEMS[best.type].heavy && !c.stats.strong) { this.sound.nope(); this.toast('För tungt för Edvin – Hedda kan bära det', 2); return; }
      best.holder = c;
      this.sound.pickup();
      this.toast((c.stats.name === 'EDVIN' ? 'Edvin' : 'Hedda') + ' tog: ' + ITEMS[best.type].name.toLowerCase(), 1.4);
      return;
    }

    // 4. Spruckna och hemliga väggar
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

    // 5. Hedda slår i luften
    if (c.stats.strong && c.smashT <= 0 && c.onGround) {
      c.smashT = 0.36; c.smashTarget = null; c.punched = false; c.vx = 0;
    }
  };

  // ================= BIRKIN (easter egg) =================
  G.birkinUnlocked = function () {
    try { return window.localStorage.getItem('edvin_hedda_birkin') === '1'; } catch (e) { return !!this._birkinMem; }
  };
  G.findBirkin = function (c, item) {
    if (c.type !== 'hedda') { this.sound.nope(); this.toast('Den där väskan är nog Heddas...', 2); return; }
    this.items = this.items.filter(i => i !== item);
    const first = !this.birkinUnlocked();
    try { window.localStorage.setItem('edvin_hedda_birkin', '1'); } catch (e) { this._birkinMem = true; }
    this._birkinMem = true;
    this.outfit.hedda.bag = 1; this.saveOutfit();
    const x = c.x + c.w / 2, y = c.y;
    this.confetti(x, y, 26);
    for (let i = 0; i < 12; i++) this.particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 40, life: 1.4, col: i % 2 ? '#f0a3c2' : '#ffd23f', w: 2, h: 2, g: -0.02 });
    this.spawnRing(x, y + 10, '#f2d25a');
    this.sound.win();
    this.toast(first ? 'Hedda hittade en Birkin bag! Den finns nu i garderoben.' : 'Birkin-väskan igen – Hedda bär den redan.', 3.4);
    c.idleT = 3.01; // spänner musklerna av glädje
  };

  // Rita väskan i Heddas hand (i spelet och i garderoben)
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

  // ================= RITNING =================
  // 3x5-typsnitt för skyltar och kretsar
  const FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111',
    'F': '111100110100100', 'N': '101111111111101', 'O': '010101101101010', 'R': '110101110101101', 'T': '111010010010010',
    'X': '101101010101101', 'x': '000101010101000', '=': '000111000111000', ' ': '000000000000000', '?': '111001011000010'
  };
  G.pixText = function (ctx, str, x, y, col) {
    ctx.fillStyle = col;
    let cx = x;
    for (const ch of String(str)) {
      const g = FONT[ch] || FONT['?'];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3), y + Math.floor(i / 3), 1, 1);
      cx += 4;
    }
  };
  const textW = s => String(s).length * 4 - 1;

  G.drawItems = function (ctx) {
    const a = this.chars[this.active];
    for (const it of this.items) {
      if (it.socket) continue;
      const img = itemSprite(it.type);
      ctx.drawImage(img, Math.round(it.x), Math.round(it.y));
      // "E"-markering när den aktiva figuren kan plocka upp
      if (!it.holder && this.state === 'play' && !this.catchAnim && !this.heldBy(a)) {
        const dx = Math.abs(it.x + it.w / 2 - (a.x + a.w / 2));
        if (dx < 19 && it.y + it.h > a.y - 2 && it.y < a.y + a.h + 3) {
          const bx = Math.round(it.x + it.w / 2) - 3, by = Math.round(it.y) - 10 + Math.round(Math.sin(this.time * 6));
          ctx.fillStyle = '#1e1e28'; ctx.fillRect(bx - 1, by - 1, 7, 8);
          ctx.fillStyle = '#fff3c4'; ctx.fillRect(bx, by, 5, 6);
          this.pixText(ctx, 'E', bx + 1, by, '#1e1e28');
        }
      }
      if (it.type === 'birkin' && Math.random() < 0.03) this.particles.push({ x: it.x + Math.random() * it.w, y: it.y + Math.random() * 3, vx: 0, vy: -12, life: 0.5, col: '#fff3c4', w: 1, h: 1, g: 0 });
    }
  };

  const baseDrawTrigger = G.drawTrigger;
  G.drawTrigger = function (ctx, tr, px, py) {
    if (tr.type === 'socket' || tr.type === 'reader') {
      // stolpe + låda
      ctx.fillStyle = '#3a3f4c'; ctx.fillRect(px + 6, py + 9, 4, 7);
      ctx.fillStyle = '#5b6070'; ctx.fillRect(px + 6, py + 9, 1, 7);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(px + 1, py - 4, 14, 14);
      ctx.fillStyle = tr.type === 'reader' ? '#4c5a74' : '#55606e'; ctx.fillRect(px + 2, py - 3, 12, 12);
      ctx.fillStyle = '#7d8798'; ctx.fillRect(px + 2, py - 3, 12, 1);
      if (tr.type === 'socket') {
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(px + 4, py - 1, 8, 8);
        if (tr.holds) { const img = itemSprite(tr.holds.type); ctx.drawImage(img, px + 8 - Math.floor(img.width / 2), py + 3 - Math.floor(img.height / 2)); }
        else { ctx.fillStyle = '#3a3f4c'; ctx.fillRect(px + 5, py, 6, 6); }
        // symbol: blixt
        ctx.fillStyle = tr.on ? '#ffd23f' : '#8a8f9e';
        ctx.fillRect(px + 12, py - 2, 1, 2); ctx.fillRect(px + 11, py, 2, 1); ctx.fillRect(px + 12, py + 1, 1, 2);
      } else {
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(px + 4, py + 2, 8, 2);
        if (tr.holds) { ctx.fillStyle = '#4a7ad0'; ctx.fillRect(px + 5, py - 2, 6, 5); ctx.fillStyle = '#f2d25a'; ctx.fillRect(px + 6, py - 1, 2, 2); }
        ctx.fillStyle = '#2a2a33'; ctx.fillRect(px + 5, py + 5, 6, 3);
        ctx.fillStyle = '#9ad6ff'; ctx.fillRect(px + 6, py + 6, 4, 1);
      }
      // lampa
      ctx.fillStyle = tr.on ? '#b6ef3a' : '#d8403d'; ctx.fillRect(px + 3, py - 2, 2, 2);
      return;
    }
    if (tr.type === 'lever' && tr.broken) {
      ctx.fillStyle = '#444857'; ctx.fillRect(px + 4, py + 12, 8, 4);
      ctx.fillStyle = '#7c8190'; ctx.fillRect(px + 4, py + 12, 8, 1);
      ctx.fillStyle = '#9aa0ae'; ctx.fillRect(px + 7, py + 10, 1, 2); ctx.fillRect(px + 8, py + 9, 1, 1);
      // avbrutet handtag på marken
      ctx.fillStyle = '#9aa0ae'; ctx.fillRect(px + 11, py + 14, 3, 1);
      ctx.fillStyle = '#d8403d'; ctx.fillRect(px + 13, py + 13, 2, 2);
      if (Math.random() < 0.04) this.particles.push({ x: px + 8, y: py + 9, vx: (Math.random() - 0.5) * 40, vy: -30, life: 0.3, col: '#ffd23f', w: 1, h: 1, g: 0.5 });
      return;
    }
    baseDrawTrigger.call(this, ctx, tr, px, py);
  };

  // Hemlig vägg: ser ut som sten men har en liten ljus spricka och gnistrar ibland
  G.drawSecretTile = function (ctx, tx, ty, px, py) {
    ctx.drawImage(this.sprites.tile('stone', tx, ty), px, py);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px + 5, py + 4, 1, 1); ctx.fillRect(px + 6, py + 5, 1, 1); ctx.fillRect(px + 10, py + 11, 1, 1);
    if (Math.random() < 0.006) this.particles.push({ x: px + 4 + Math.random() * 8, y: py + 4 + Math.random() * 8, vx: 0, vy: -8, life: 0.6, col: '#fff3c4', w: 1, h: 1, g: 0 });
  };

  // Etiketter (t.ex. bitvärden ovanför spakar)
  G.drawLabels = function (ctx) {
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
    for (let i = 1; i < pts.length; i++) seg(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 3);
    ctx.fillStyle = lit ? '#ffd23f' : '#5a566c';
    for (let i = 1; i < pts.length; i++) seg(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1);
  }

  G.drawCircuits = function (ctx) {
    const at = this.level.logicAt || {};
    for (const key in this.doors) {
      const d = this.doors[key];
      if (!d.expr) continue;
      const node = this.logicNode(d.expr);
      const top = d.cells.reduce((m, c) => (c.y < m.y || (c.y === m.y && c.x < m.x)) ? c : m, d.cells[0]);
      const ax = top.x * TILE + 8, ay = d.kind === 'gate' ? top.y * TILE - 5 : top.y * TILE;
      const out = this.evalNode(node);
      // ingångar: ID eller NOT(ID)
      const leafs = node.op === 'ID' ? [{ id: node.id }] :
        node.args.map(a => a.op === 'ID' ? { id: a.id } : (a.op === 'NOT' && a.args[0].op === 'ID' ? { id: a.args[0].id, inv: true } : null)).filter(Boolean);
      if (node.op === 'NOT') leafs.forEach(l => { l.inv = false; });
      const hasIcon = node.op !== 'ID';
      const ic = at[key] ? [at[key][0] * TILE + 8, at[key][1] * TILE + 8] : [ax, Math.min(ay - 24, 4 * TILE)];
      const target = hasIcon ? ic : [ax, ay - 12];
      leafs.forEach((l, i) => {
        const t = this.triggers[l.id]; if (!t) return;
        const sx = t.x * TILE + 8, sy = t.y * TILE + (t.type === 'socket' || t.type === 'reader' ? -5 : 4);
        const ly = target[1] + (i - (leafs.length - 1) / 2) * 3;
        const ex = hasIcon ? (sx < target[0] ? target[0] - 13 : target[0] + 13) : target[0];
        wire(ctx, [[sx, sy], [sx, ly], [ex, ly]].concat(hasIcon ? [] : [[ex, ay]]), t.on);
      });
      if (!hasIcon) continue;
      // utgång till dörren
      wire(ctx, ax === ic[0] ? [[ic[0], ic[1] + 5], [ax, ay]] : [[ic[0], ic[1] + 5], [ic[0], ay - 8], [ax, ay - 8], [ax, ay]], out);
      // grind-ikon
      const label = node.op === 'CODE' ? (this.level.codeLabel || ('=' + node.value)) : node.op;
      const w = Math.max(textW(label) + 6, 17);
      const x = Math.round(ic[0] - w / 2), y = Math.round(ic[1] - 5);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(x - 1, y - 1, w + 2, 12);
      ctx.fillStyle = out ? '#3e5a2a' : '#3a2f44'; ctx.fillRect(x, y, w, 10);
      ctx.fillStyle = out ? '#b6ef3a' : '#8a7fa0'; ctx.fillRect(x, y, w, 1);
      this.pixText(ctx, label, x + Math.round((w - textW(label)) / 2), y + 3, out ? '#e8ffc8' : '#e6e0f0');
      // binärlås: visa nuvarande värde under ikonen
      if (node.op === 'CODE') {
        const cur = this.codeValue(node);
        const bits = cur.toString(2).padStart(node.args.length, '0');
        const bw = textW(bits) + 4;
        ctx.fillStyle = '#1e1e28'; ctx.fillRect(ic[0] - bw / 2 - 1, y + 12, bw + 2, 9);
        this.pixText(ctx, bits, Math.round(ic[0] - textW(bits) / 2), y + 14, out ? '#b6ef3a' : '#ff8a86');
      }
    }
  };

  // HUD: föremål som figurerna bär
  G.drawHUDItems = function (ctx) {
    this.chars.forEach((c, i) => {
      const it = this.heldBy(c);
      if (!it) return;
      const x = 6 + i * 34 + 20, y = 6 + 12;
      const img = itemSprite(it.type);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(x - 1, y - 1, img.width + 2, img.height + 2);
      ctx.drawImage(img, x, y);
    });
  };
})();
