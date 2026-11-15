// sprites.js – bygger all grafik till canvas: figurer, höna, tiles och bakgrund.
(function () {
  'use strict';

  // ---------- Grundfunktioner ----------
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function blit(ctx, grid, pal, ox, oy) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  function flipCanvas(src) {
    const c = makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.translate(src.width, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0);
    return c;
  }
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function validate(name, grid, w) {
    grid.forEach((row, i) => { if (row.length !== w) throw new Error(`Sprite ${name} rad ${i}: bredd ${row.length}, väntade ${w}`); });
  }

  // ---------- Figurer ----------
  // Varje frame är 32x40. Figurens 24x36-grid ritas vid (4,4) så att förskjutningar inte klipps.
  const FW = 32, FH = 40, OX = 4, OY = 4;

  function frame(art, legs, torso, o) {
    o = o || {};
    const up = o.upDx || 0, upY = o.upDy || 0, all = o.allDy || 0, hd = o.headDy || 0;
    const c = makeCanvas(FW, FH);
    const ctx = c.getContext('2d');
    blit(ctx, legs, art.pal, OX + (o.legDx || 0), OY + 26 + all);
    if (art.hairBack) blit(ctx, art.hairBack, art.pal, OX + up, OY + 14 + upY + all);
    blit(ctx, torso, art.pal, OX + up, OY + 14 + upY + all);
    if (art.hairFront) blit(ctx, art.hairFront, art.pal, OX + up, OY + 14 + upY + all);
    blit(ctx, art.head, art.pal, OX + up, OY + upY + hd + all);
    return c;
  }

  function buildCharacter(name, art, L) {
    validate(name + '.head', art.head, 24);
    Object.keys(art.torso).forEach(k => validate(name + '.torso.' + k, art.torso[k], 24));
    Object.keys(L).forEach(k => validate('legs.' + k, L[k], 24));
    const T = art.torso;
    const anims = {
      idle: [frame(art, L.idle, T.idle), frame(art, L.idle, T.idle, { upDy: 1 })],
      run: [
        frame(art, L.contact, T.runA),
        frame(art, L.down, T.runA, { upDy: 1 }),
        frame(art, L.pass, T.idle, { allDy: -2 }),
        frame(art, L.contact, T.runB),
        frame(art, L.down, T.runB, { upDy: 1 }),
        frame(art, L.pass, T.idle, { allDy: -2 })
      ],
      jump: [frame(art, L.jump, T.jump)],
      fall: [frame(art, L.fall, T.jump, { headDy: 1 })],
      land: [frame(art, L.squat, T.idle, { upDy: 2 })],
      push: [
        frame(art, L.push1, T.push, { upDx: 2, upDy: 1 }),
        frame(art, L.push2, T.push, { upDx: 2, upDy: 1 }),
        frame(art, L.push2, T.push, { upDx: 3, upDy: 2 })
      ],
      // utkast (hukad, bakåtlutad, armen bakåt) -> slag (utfall, rak arm)
      smash: [
        frame(art, L.squat, T.runB, { upDx: -2, upDy: 2 }),
        frame(art, L.push2, T.punch || T.push, { upDx: 3, upDy: 1 })
      ]
    };
    if (T.flex) anims.flex = [frame(art, L.idle, T.flex), frame(art, L.idle, T.flex, { upDy: 1 })];
    if (T.watch) {
      // tittar ner på klockan (huvudet sänkt), sedan en liten nick
      anims.watch = [frame(art, L.idle, T.watch, { headDy: 1 }), frame(art, L.idle, T.watch, { headDy: 1 }), frame(art, L.idle, T.watch, { headDy: 1, upDy: 1 }), frame(art, L.idle, T.watch, { headDy: 1 })];
      // joggar på stället
      anims.jog = [
        frame(art, L.down, T.runA, { upDy: 1 }),
        frame(art, L.pass, T.idle, { allDy: -1 }),
        frame(art, L.down, T.runB, { upDy: 1 }),
        frame(art, L.pass, T.idle, { allDy: -1 })
      ];
    }
    const left = {};
    for (const k in anims) left[k] = anims[k].map(flipCanvas);
    const portrait = makeCanvas(24, 14);
    blit(portrait.getContext('2d'), art.head, art.pal, 0, 0);
    return { right: anims, left, portrait, name };
  }

  // ---------- Hönan (16x16, vänd åt höger) ----------
  // Ingefärsbrun med vita stänk, vitt bröst och vita stjärtspetsar – som på fotot.
  const HEN_PAL = {
    b: '#b8693a', B: '#7c4325', o: '#d9945a', W: '#f7f1e6', v: '#e3d6c2',
    R: '#d93b36', r: '#a3271f', Y: '#f2b33d', L: '#e09a3e', E: '#1b1b1b'
  };
  // Kropp utan huvud
  const HEN_BODY = [
    '................',
    '................',
    '................',
    '.W..............',
    'WbW.............',
    'WbbW......oo....',
    '.bWbb....obbo...',
    '.bbWbobbWbbbo...',
    '..bbbBBBBbbWbo..',
    '..bWbBobbBbbbo..',
    '..obbBBBBBbWbb..',
    '...obbbbbbbbWo..',
    '....oWWWWWWWo...',
    '.....vvvvvvv....',
    '.......L..L.....',
    '......LL.LL.....'
  ];
  const HEN_BODY_WALK = HEN_BODY.slice(0, 14).concat([
    '......L...L.....',
    '.....LL....LL...'
  ]);
  // Vinge uppåt (flax) – ersätter vingfältet
  const HEN_BODY_FLAP = [
    '................',
    '................',
    '....BBB.........',
    '.W.BbbbB........',
    'WbWBbWbB........',
    'WbbBbbB...oo....',
    '.bWbBB...obbo...',
    '.bbWbobbWbbbo...',
    '..bbbbbbbbbWbo..',
    '..bWbbobbbbbbo..',
    '..obbbbbbbbWbb..',
    '...obbbbbbbbWo..',
    '....oWWWWWWWo...',
    '.....vvvvvvv....',
    '......L...L.....',
    '.....LL....LL...'
  ];
  // Huvud 6x7, ritas med förskjutning ovanpå kroppen
  const HEN_HEAD = [
    '.R.R..',
    '.RRRR.',
    'obbbo.',
    'obbEoY',
    'obbbYY',
    '.obrR.',
    '.obr..'
  ];
  const HEN_HEAD_JERK = HEN_HEAD; // samma grid, annan position

  function henFrame(body, hx, hy) {
    const c = makeCanvas(16, 16);
    const ctx = c.getContext('2d');
    blit(ctx, body, HEN_PAL, 0, 0);
    // hals som fyller mellan kropp och huvud
    if (hy > 2) {
      ctx.fillStyle = HEN_PAL.o;
      for (let y = 5; y < hy + 3; y++) ctx.fillRect(10 + Math.round((hx - 0) * (y - 5) / Math.max(1, hy - 2)), y, 2, 1);
    }
    blit(ctx, HEN_HEAD, HEN_PAL, 9 + hx, 0 + hy);
    return c;
  }

  function buildHen() {
    validate('hen.body', HEN_BODY, 16); validate('hen.flap', HEN_BODY_FLAP, 16); validate('hen.walk', HEN_BODY_WALK, 16);
    HEN_HEAD.forEach((r, i) => { if (r.length !== 6) throw new Error('hen.head rad ' + i); });
    void HEN_HEAD_JERK;
    const f = {
      idle: [henFrame(HEN_BODY, 0, 1)],
      jerk: [henFrame(HEN_BODY, 1, 1), henFrame(HEN_BODY, 0, 1)],
      peck: [henFrame(HEN_BODY, 0, 1), henFrame(HEN_BODY, 1, 4), henFrame(HEN_BODY, 2, 7), henFrame(HEN_BODY, 1, 4)],
      flap: [henFrame(HEN_BODY_FLAP, 0, 1), henFrame(HEN_BODY, 0, 1)],
      walk: [henFrame(HEN_BODY, 0, 1), henFrame(HEN_BODY_WALK, 1, 2)]
    };
    const left = {};
    for (const k in f) left[k] = f[k].map(flipCanvas);
    return { right: f, left };
  }

  // ---------- Tiles (16x16) ----------
  const P = {
    grass: '#78b85a', grassD: '#5a9a48', grassL: '#9ed36f', grassEdge: '#3f7a3a',
    dirt: '#8b5d3f', dirtD: '#734a31', dirtL: '#a2714d', pebble: '#a89a8a', pebbleD: '#7b6f63',
    stone: '#7b7f8f', stoneL: '#9a9eac', stoneD: '#585c6b', mortar: '#474a57', moss: '#6d9a52',
    crate: '#b07a44', crateD: '#8a5c31', crateL: '#d29c62', metal: '#5b5e6b', metalL: '#9ca1b0',
    crack: '#2a2a33', plate: '#d4ad52', plateD: '#8a6a2a', plateOn: '#9bd84e',
    plank: '#b9874f', plankD: '#875d33', plankL: '#d9a86c', rope: '#e3d3a8'
  };

  function px(ctx, x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }

  function drawDirt(ctx, tx, ty, variant) {
    ctx.fillStyle = P.dirt; ctx.fillRect(0, 0, 16, 16);
    // mjuka lager (ordnad dither, inte brus)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if ((y === 5 || y === 11) && ((x + y + tx) % 3 === 0)) px(ctx, x, y, P.dirtD);
      if ((y === 2 || y === 8 || y === 14) && ((x * 7 + ty * 3) % 11 === 0)) px(ctx, x, y, P.dirtL);
    }
    // småstenar per variant
    const stones = [[[3, 6], [11, 12]], [[8, 3], [2, 11], [12, 8]], [[6, 9]], [[12, 4], [4, 13]]][variant];
    stones.forEach(([sx, sy]) => {
      ctx.fillStyle = P.pebble; ctx.fillRect(sx, sy, 3, 2);
      ctx.fillStyle = P.pebbleD; ctx.fillRect(sx, sy + 1, 3, 1); ctx.fillRect(sx + 2, sy, 1, 1);
      px(ctx, sx, sy, '#c9bcab');
    });
    if (variant === 2) { // rot
      ctx.fillStyle = P.dirtD;
      [[2, 3], [3, 4], [4, 4], [5, 5], [6, 5], [7, 6]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    }
  }

  function drawGrassTop(ctx, tx, ty, variant) {
    drawDirt(ctx, tx, ty, variant);
    // gräskant med ojämn underkant
    for (let x = 0; x < 16; x++) {
      const depth = 3 + ((hash(tx * 16 + x, ty, 3) > 0.6) ? 1 : 0) + ((x % 5 === 2) ? 1 : 0);
      ctx.fillStyle = P.grass; ctx.fillRect(x, 0, 1, depth);
      ctx.fillStyle = P.grassD; ctx.fillRect(x, depth - 1, 1, 1);
      ctx.fillStyle = P.grassEdge; ctx.fillRect(x, depth, 1, 1);
    }
    ctx.fillStyle = P.grassL; ctx.fillRect(0, 0, 16, 1);
    for (let x = 1; x < 16; x += 4) px(ctx, x + (variant & 1), 1, P.grassL);
  }

  // Grästuvor som sticker upp ovanför tilen (ritas separat, 16x4)
  function drawTufts(ctx, tx, variant) {
    const spots = [[2, 9], [5, 13], [1, 7, 12], [4, 10]][variant];
    spots.forEach((x, i) => {
      const h = 2 + ((i + variant) % 2);
      ctx.fillStyle = P.grass;
      ctx.fillRect(x, 4 - h, 1, h); ctx.fillRect(x + 1, 4 - h + 1, 1, h - 1);
      ctx.fillStyle = P.grassL; ctx.fillRect(x, 4 - h, 1, 1);
    });
    if (variant === 2) { // en liten blomma
      px(ctx, 9, 1, '#f6f1e8'); px(ctx, 8, 2, '#f6f1e8'); px(ctx, 10, 2, '#f6f1e8'); px(ctx, 9, 2, '#f2d25a'); px(ctx, 9, 3, P.grassD);
    }
    void tx;
  }

  function drawStone(ctx, tx, ty, variant) {
    ctx.fillStyle = P.mortar; ctx.fillRect(0, 0, 16, 16);
    const off = (ty & 1) ? 8 : 0;
    const bricks = [];
    for (let row = 0; row < 2; row++) {
      const o = row === 0 ? off : (off + 8) % 16;
      bricks.push([o - 16, row * 8], [o, row * 8], [o + 16, row * 8]);
    }
    bricks.forEach(([bx, by]) => {
      const x0 = Math.max(0, bx + 1), x1 = Math.min(16, bx + 16), y0 = by, y1 = by + 7;
      if (x1 <= x0) return;
      ctx.fillStyle = P.stone; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = P.stoneL; ctx.fillRect(x0, y0, x1 - x0, 1);
      if (bx + 1 >= 0) ctx.fillRect(x0, y0, 1, y1 - y0);
      ctx.fillStyle = P.stoneD; ctx.fillRect(x0, y1 - 1, x1 - x0, 1);
      if (bx + 16 <= 16) ctx.fillRect(x1 - 1, y0, 1, y1 - y0);
    });
    if (variant === 1) { ctx.fillStyle = P.moss; ctx.fillRect(2, 7, 4, 1); ctx.fillRect(3, 8, 2, 1); }
    if (variant === 3) { px(ctx, 11, 3, P.stoneD); px(ctx, 12, 4, P.stoneD); px(ctx, 12, 5, P.stoneD); }
  }

  function drawCracked(ctx, tx, ty) {
    drawStone(ctx, tx, ty, 0);
    ctx.fillStyle = P.crack;
    [[7, 0], [8, 1], [8, 2], [7, 3], [6, 4], [7, 5], [8, 6], [9, 7], [8, 8], [7, 9], [7, 10], [8, 11], [9, 12], [10, 13], [9, 14], [9, 15]]
      .forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    [[5, 4], [4, 5], [3, 5], [10, 7], [11, 6], [12, 6], [6, 10], [5, 11]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    [[8, 3], [9, 8], [10, 12]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
  }

  function drawCrate(ctx) {
    ctx.fillStyle = P.crate; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = P.crateL; ctx.fillRect(1, 1, 14, 1); ctx.fillRect(1, 1, 1, 14);
    ctx.fillStyle = P.crateD; ctx.fillRect(1, 14, 14, 1); ctx.fillRect(14, 1, 1, 14);
    ctx.fillStyle = P.crateD; ctx.fillRect(2, 5, 12, 1); ctx.fillRect(2, 10, 12, 1);
    ctx.fillStyle = P.crateL; ctx.fillRect(2, 6, 12, 1); ctx.fillRect(2, 11, 12, 1);
    // diagonal stag
    ctx.fillStyle = P.crateD;
    for (let i = 0; i < 10; i++) ctx.fillRect(3 + i, 12 - i, 1, 1);
    ctx.fillStyle = P.metal;
    [[0, 0], [13, 0], [0, 13], [13, 13]].forEach(([x, y]) => ctx.fillRect(x, y, 3, 3));
    ctx.fillStyle = P.metalL;
    [[1, 1], [14, 1], [1, 14], [14, 14]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    ctx.fillStyle = '#2a1f17'; ctx.fillRect(0, 15, 16, 1);
  }

  function drawSpikes(ctx) {
    ctx.fillStyle = '#4a4c5a'; ctx.fillRect(0, 13, 16, 3);
    ctx.fillStyle = '#6d7080'; ctx.fillRect(0, 13, 16, 1);
    for (let i = 0; i < 4; i++) {
      const bx = i * 4;
      ctx.fillStyle = '#d6dae3'; ctx.fillRect(bx + 1, 6, 1, 7); px(ctx, bx + 1, 4, '#ffffff'); ctx.fillRect(bx + 1, 5, 1, 1);
      ctx.fillStyle = '#8b8f9e'; ctx.fillRect(bx + 2, 7, 1, 6); ctx.fillRect(bx, 9, 1, 4);
    }
  }

  function drawPlate(ctx, on) {
    ctx.fillStyle = '#4a4c5a'; ctx.fillRect(1, 14, 14, 2);
    const top = on ? 13 : 11;
    ctx.fillStyle = on ? P.plateOn : P.plate; ctx.fillRect(2, top, 12, 14 - top);
    ctx.fillStyle = on ? '#cdf58f' : '#f3dc8a'; ctx.fillRect(2, top, 12, 1);
    ctx.fillStyle = P.plateD; ctx.fillRect(2, 13, 12, 1);
  }

  function drawButton(ctx, on) {
    ctx.fillStyle = '#555a68'; ctx.fillRect(3, 10, 10, 6);
    ctx.fillStyle = '#7c8190'; ctx.fillRect(3, 10, 10, 1);
    const top = on ? 8 : 5;
    ctx.fillStyle = '#8e2724'; ctx.fillRect(5, top, 6, 10 - top);
    ctx.fillStyle = on ? '#9bd84e' : '#d8403d'; ctx.fillRect(5, top - 1, 6, 2);
    px(ctx, 6, top - 1, on ? '#cdf58f' : '#ff8a86'); px(ctx, 7, top - 1, on ? '#cdf58f' : '#ff8a86');
  }

  function drawLever(ctx, on) {
    ctx.fillStyle = '#444857'; ctx.fillRect(4, 12, 8, 4);
    ctx.fillStyle = '#7c8190'; ctx.fillRect(4, 12, 8, 1);
    ctx.fillStyle = '#9aa0ae';
    const pts = on ? [[8, 11], [9, 10], [9, 9], [10, 8], [10, 7], [11, 6]] : [[7, 11], [6, 10], [6, 9], [5, 8], [5, 7], [4, 6]];
    pts.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    ctx.fillStyle = on ? '#9bd84e' : '#d8403d';
    if (on) ctx.fillRect(11, 4, 3, 3); else ctx.fillRect(3, 4, 3, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    if (on) px(ctx, 11, 4); else px(ctx, 3, 4);
  }
  // px med 3 arg anropar fillRect med senaste fillStyle
  function pxCur(ctx, x, y) { ctx.fillRect(x, y, 1, 1); }

  function drawPlank(ctx, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = P.plank; ctx.fillRect(0, 0, 16, 5);
    ctx.fillStyle = P.plankL; ctx.fillRect(0, 0, 16, 1);
    ctx.fillStyle = P.plankD; ctx.fillRect(0, 4, 16, 1); ctx.fillRect(7, 1, 1, 3);
    ctx.fillStyle = '#5b5e6b'; px(ctx, 2, 2, '#5b5e6b'); px(ctx, 13, 2, '#5b5e6b');
    ctx.globalAlpha = 1;
  }

  const tileCache = new Map();
  function tile(kind, tx, ty, arg) {
    const variant = Math.floor(hash(tx, ty, 77) * 4);
    const key = kind + ':' + ((kind === 'grass' || kind === 'dirt' || kind === 'stone' || kind === 'cracked' || kind === 'tufts') ? (variant + ':' + (ty & 1) + ':' + (tx & 3)) : '') + ':' + (arg || 0);
    if (tileCache.has(key)) return tileCache.get(key);
    const c = makeCanvas(16, kind === 'tufts' ? 4 : 16);
    const ctx = c.getContext('2d');
    switch (kind) {
      case 'grass': drawGrassTop(ctx, tx, ty, variant); break;
      case 'dirt': drawDirt(ctx, tx, ty, variant); break;
      case 'tufts': drawTufts(ctx, tx, variant); break;
      case 'stone': drawStone(ctx, tx, ty, variant); break;
      case 'cracked': drawCracked(ctx, tx, ty); break;
      case 'crate': drawCrate(ctx); break;
      case 'spikes': drawSpikes(ctx); break;
      case 'plate': drawPlate(ctx, !!arg); break;
      case 'button': drawButton(ctx, !!arg); break;
      case 'lever': drawLever(ctx, !!arg); break;
      case 'plank': drawPlank(ctx, arg === undefined ? 1 : arg); break;
    }
    tileCache.set(key, c);
    return c;
  }
  void pxCur;

  // ---------- Bakgrund ----------
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function rgb(a) { return `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`; }

  function buildSky(W, H) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const stops = ['#5aa6d6', '#6fb5de', '#86c3e4', '#9dd0e8', '#b6dcec', '#cbe6ef', '#dbeef2'].map(hex);
    const n = stops.length - 1;
    for (let y = 0; y < H; y++) {
      const t = Math.min(0.9999, y / (H * 0.78)) * n;
      const i = Math.floor(t), f = t - i;
      for (let x = 0; x < W; x++) {
        const useNext = f * 16 > BAYER[y & 3][x & 3] + 0.5;
        ctx.fillStyle = rgb(stops[Math.min(n, i + (useNext ? 1 : 0))]);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // sol med mjuk ditrad gloria
    const sx = W - 60, sy = 34;
    for (let y = -18; y <= 18; y++) for (let x = -18; x <= 18; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= 9.5) { ctx.fillStyle = d < 6 ? '#fffbe3' : '#fff1b8'; ctx.fillRect(sx + x, sy + y, 1, 1); }
      else if (d <= 13 && ((x + y) & 1) === 0) { ctx.fillStyle = 'rgba(255,246,200,0.55)'; ctx.fillRect(sx + x, sy + y, 1, 1); }
      else if (d <= 17 && (x & 1) === 0 && (y & 1) === 0) { ctx.fillStyle = 'rgba(255,246,200,0.3)'; ctx.fillRect(sx + x, sy + y, 1, 1); }
    }
    return c;
  }

  function buildCloud(seed) {
    const w = 40 + Math.floor(hash(seed, 1) * 24), h = 16;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const blobs = [];
    const n = 3 + Math.floor(hash(seed, 2) * 3);
    for (let i = 0; i < n; i++) blobs.push([8 + (w - 16) * i / (n - 1), 9 - hash(seed, i + 5) * 4, 5 + hash(seed, i + 9) * 4]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let inside = false, top = false;
      for (const [bx, by, r] of blobs) {
        const d = Math.hypot(x - bx, (y - by) * 1.2);
        if (d <= r) inside = true;
        if (d <= r && y < by - r * 0.3) top = true;
      }
      if (y > 12) inside = inside && y <= 12;
      if (!inside) continue;
      ctx.fillStyle = y >= 11 ? '#d7e8f1' : (top ? '#ffffff' : '#f2f8fb');
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = '#c4dbe8'; ctx.fillRect(4, 12, w - 8, 1);
    return c;
  }

  // Lager som går att upprepa i x-led (bredd 512)
  function buildLayer(H, kind) {
    const LW = 512;
    const c = makeCanvas(LW, H);
    const ctx = c.getContext('2d');
    if (kind === 'mountains') {
      for (let x = 0; x < LW; x++) {
        const a = x / LW * Math.PI * 2;
        let h = 62 + Math.sin(a * 2) * 16 + Math.sin(a * 5 + 1) * 9 + Math.abs(Math.sin(a * 3 + 0.4)) * 14;
        h = Math.round(h / 2) * 2;
        ctx.fillStyle = '#a8c9d8'; ctx.fillRect(x, H - h - 60, 1, h + 60);
        ctx.fillStyle = '#bdd7e2'; ctx.fillRect(x, H - h - 60, 1, 2);
      }
    } else if (kind === 'hills') {
      for (let x = 0; x < LW; x++) {
        const a = x / LW * Math.PI * 2;
        let h = 46 + Math.sin(a * 3 + 2) * 12 + Math.sin(a * 7) * 5;
        h = Math.round(h);
        ctx.fillStyle = '#86b9a3'; ctx.fillRect(x, H - h - 40, 1, h + 40);
        ctx.fillStyle = '#a2cdb8'; ctx.fillRect(x, H - h - 40, 1, 1);
      }
    } else if (kind === 'forest') {
      ctx.fillStyle = '#5e9a72'; ctx.fillRect(0, H - 52, LW, 52);
      for (let i = 0; i < 46; i++) {
        const cx = Math.floor(i * LW / 46 + hash(i, 3) * 8);
        const th = 22 + Math.floor(hash(i, 4) * 18);
        const base = H - 50 + Math.floor(hash(i, 5) * 6);
        for (let r = 0; r < th; r++) {
          const w = Math.max(1, Math.floor((r / th) * 9) + ((r % 4 === 3) ? 1 : 0));
          ctx.fillStyle = '#4f8963'; ctx.fillRect(cx - w, base - th + r, w, 1);
          ctx.fillStyle = '#5e9a72'; ctx.fillRect(cx, base - th + r, w, 1);
          if (r % 4 === 0) { ctx.fillStyle = '#74ad83'; ctx.fillRect(cx, base - th + r, 1, 1); }
        }
      }
    }
    return c;
  }

  // ---------- Export ----------
  window.SPRITES = {
    build(W, H) {
      const A = window.CHARACTER_ART;
      this.edvin = buildCharacter('edvin', A.edvin, A.legs);
      this.hedda = buildCharacter('hedda', A.hedda, A.legs);
      this.hen = buildHen();
      this.bg = {
        sky: buildSky(W, H),
        clouds: [0, 1, 2, 3].map(buildCloud),
        mountains: buildLayer(H, 'mountains'),
        hills: buildLayer(H, 'hills'),
        forest: buildLayer(H, 'forest')
      };
      return this;
    },
    // Bygger om en figur med valda kläder: outfit = { top, pants, shoes } (index)
    dress(name, outfit) {
      const A = window.CHARACTER_ART, O = A.outfits;
      const pick = (list, i) => (list[i] || list[0]).pal;
      const pal = Object.assign({}, A[name].pal, pick(O[name].tops, outfit.top), pick(O.pants, outfit.pants), pick(O.shoes, outfit.shoes));
      this[name] = buildCharacter(name, Object.assign({}, A[name], { pal }), A.legs);
    },
    tile, hash, P, FW, FH
  };
})();
