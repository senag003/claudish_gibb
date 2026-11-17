// levels.js – höga banor byggda med kod. Tile = 16 px. Kameran följer i både sidled och höjdled.
//
// Tecken i griden:
//   #  mark   S  sten   C  sprucken vägg (Hedda)   X  hemlig vägg (Hedda)   ^  spikar
//   L  stege  T  stegtopp (går att stå på, klättra ner med pil ner)   =  tunn planka (hoppa upp igenom)
//   B  tung låda (Hedda knuffar)   O  hönan   E/H  start för Edvin/Hedda
//   1–9, m–z  utlösare (typ i triggers): lever, plate, button, socket, reader, task, tube
//   a–d, i–l  galler (öppna när logiken ger ström)   e–h  broar (fasta när logiken ger ström)
//
// logic: uttryck per galler/bro – "3", "AND(1,2)", "OR(1,m)", "XOR(r,s)", "NOT(m)"
// lifts: hissar { id, x, w, bottom, top, logic } – plattformen åker upp till 'top' när logiken ger ström
// items: [typ, x, y] – wrench, battery (tungt, bara Hedda), fuse, keycard, birkin
// tips: { x, y, text } – visas när den aktiva figuren är nära (y = fotens rad)
//
// Förmågor (kontrolleras i utveckling/solve.html):
//   Edvin hoppar 3,5 tiles och kan studsa mellan två väggar (växelvis). Hedda hoppar 1,7 tiles.
//   Båda klättrar i stegar. Batteriet kan bara Hedda bära och det får inte plats i rörposten.

(function () {
  'use strict';

  function build(cols, rows, fn) {
    const g = [];
    for (let y = 0; y < rows; y++) g.push(new Array(cols).fill('.'));
    const api = {
      set(x, y, ch) { g[y][x] = ch; },
      fill(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; },
      ground(surface) {
        api.fill(0, surface, cols - 1, rows - 1, '#');
        api.fill(0, 0, 0, surface - 1, 'S');
        api.fill(cols - 1, 0, cols - 1, surface - 1, 'S');
      },
      floor(row, x0, x1) { api.fill(x0, row, x1, row, 'S'); },
      // stege: stegtopp i golvet på raden 'top', stegpinnar ner till och med 'bottom'
      ladder(x, top, bottom) { g[top][x] = 'T'; api.fill(x, top + 1, x, bottom, 'L'); },
      // vägg med galler/spricka nederst (från rad 'from' till 'to'), sten ovanför upp till 'roof'
      door(x, roof, from, to, ch) { api.fill(x, roof, x, from - 1, 'S'); api.fill(x, from, x, to, ch); }
    };
    fn(api);
    return g.map(r => r.join(''));
  }

  window.LEVELS = [
    {
      // Golv 1 -> 2: hiss = OR(batteri, spak). Hedda sätter i batteriet så Edvin åker upp, tar ut det,
      // ställer sig på hissen och Edvin drar spaken. Golv 2: AND(kabeluppgift, batteri) öppnar gallret.
      // Golv 3: Hedda slår sönder väggen, Edvin klättrar plankorna till hönan.
      name: 'Fabriken',
      hint: 'E tar upp och använder saker. 1–4 väljer, F släpper. W hoppar och klättrar i stegar, S klättrar ner.',
      map: build(40, 32, L => {
        L.ground(29);
        L.set(4, 28, 'E'); L.set(6, 28, 'H');
        L.set(21, 28, '1');                         // batteriuttag (hiss A)
        L.floor(21, 1, 38); L.fill(24, 21, 26, 21, '.');   // golv 2 med hisschakt
        L.set(22, 20, '2');                         // spak (hiss A)
        L.set(16, 20, '3');                         // terminal: koppla kablarna
        L.set(29, 20, '4');                         // batteriuttag (galler a)
        L.door(31, 14, 17, 20, 'a');                // galler a = AND(3,4)
        L.floor(13, 1, 38); L.ladder(34, 13, 20);   // golv 3 + stege upp
        L.door(28, 0, 9, 12, 'C');                  // sprucken vägg
        L.fill(22, 10, 24, 10, '='); L.fill(17, 7, 19, 7, '=');   // plankor (bara Edvin)
        L.floor(5, 1, 14);                          // översta avsatsen
        L.set(5, 4, 'O');
      }),
      triggers: {
        '1': { type: 'socket', accepts: ['battery'] },
        '2': { type: 'lever' },
        '3': { type: 'task', task: 'wires' },
        '4': { type: 'socket', accepts: ['battery'] }
      },
      logic: { a: 'AND(3,4)' },
      lifts: [{ id: 'A', x: 24, w: 3, bottom: 28, top: 21, logic: 'OR(1,2)' }],
      logicAt: { A: [19, 24], a: [31, 15] },
      items: [['battery', 12, 28]],
      tips: [
        { x: 12, y: 28, text: 'Batteriet är tungt – bara Hedda orkar bära det.' },
        { x: 25, y: 28, text: 'Hissen åker upp när kabeln till den får ström. Följ kablarna!' },
        { x: 16, y: 20, text: 'Terminal: tryck E för att göra uppgiften.' },
        { x: 24, y: 12, text: 'Bara Edvin hoppar upp på plankorna.' }
      ]
    },
    {
      // Edvin och Hedda börjar på varsin sida av en mur och hjälper varandra genom den:
      // spakar och uppgifter på ena sidan öppnar galler och driver hissar på den andra, och
      // nyckelkortet skickas med rörpost. Edvin måste studsa mellan väggar för att komma upp.
      name: 'Skilda åt',
      hint: 'Ni är på varsin sida av muren. Det ena hjälper det andra – följ kablarna genom väggen.',
      map: build(36, 40, L => {
        L.ground(37);
        L.fill(18, 0, 18, 36, 'S');                 // muren i mitten
        // ---- Edvins sida (vänster) ----
        L.set(4, 36, 'E');
        L.set(8, 36, '1');                          // spak -> Heddas galler b
        L.floor(29, 1, 17); L.ladder(2, 29, 36);
        L.fill(13, 22, 13, 26, 'S');                // studsschakt: vägg med dörröppning nertill
        L.fill(16, 22, 17, 28, 'S');
        L.floor(21, 1, 17); L.fill(14, 21, 15, 21, '=');   // schaktets öppning: planka man hoppar upp igenom
        L.set(5, 20, '4');                          // terminal: kalibrera -> Heddas galler c
        L.floor(13, 1, 17); L.fill(9, 13, 11, 13, '.');    // hisshål (hiss E)
        L.ladder(3, 13, 20);
        L.set(8, 12, '5');                          // kortläsare
        L.door(6, 6, 9, 12, 'a');                   // galler a = 5
        L.set(15, 12, '7');                         // spak -> Heddas hiss
        L.floor(5, 1, 17); L.ladder(3, 5, 12);
        L.set(6, 4, '9');                           // terminal: fyll på
        L.door(11, 0, 1, 4, 'd');                   // galler d = AND(8,9)
        L.set(15, 4, 'O');
        // ---- Heddas sida (höger) ----
        L.set(24, 36, 'H');
        L.door(31, 30, 33, 36, 'b');                // galler b = 1
        L.floor(29, 19, 34); L.ladder(33, 29, 36);
        L.set(26, 28, '3');                         // batteriuttag -> Edvins hiss
        L.door(23, 22, 25, 28, 'c');                // galler c = 4
        L.floor(21, 19, 34); L.ladder(20, 21, 28);
        L.set(19, 20, '6');                         // rörpost till Edvins golv 2
        L.door(28, 14, 17, 20, 'C');                // sprucken vägg
        L.floor(13, 19, 34); L.fill(23, 13, 25, 13, '.');  // hisshål (hiss H)
        L.ladder(33, 13, 20);
        L.set(29, 12, '2');                         // terminal: koppla kablarna
        L.door(31, 6, 9, 12, 'i');                  // galler i = 2
        L.floor(5, 19, 34); L.ladder(33, 5, 12);
        L.set(27, 4, '8');                          // spak -> Edvins galler d
        L.fill(21, 0, 21, 2, 'S'); L.fill(21, 3, 21, 4, 'X');   // något verkar konstigt med den här väggen …
        L.fill(19, 0, 20, 2, 'S');
      }),
      triggers: {
        '1': { type: 'lever' },
        '2': { type: 'task', task: 'wires' },
        '3': { type: 'socket', accepts: ['battery'] },
        '4': { type: 'task', task: 'calibrate' },
        '5': { type: 'reader', accepts: ['keycard'] },
        '6': { type: 'tube', to: [17, 20] },
        '7': { type: 'lever' },
        '8': { type: 'lever' },
        '9': { type: 'task', task: 'fill' }
      },
      logic: { a: '5', b: '1', c: '4', d: 'AND(8,9)', i: '2' },
      lifts: [
        { id: 'E', x: 9, w: 3, bottom: 20, top: 13, logic: '3' },
        { id: 'H', x: 23, w: 3, bottom: 20, top: 13, logic: '7' }
      ],
      logicAt: { d: [9, 2] },
      items: [['battery', 21, 28], ['keycard', 31, 20], ['birkin', 19, 4]],
      tips: [
        { x: 6, y: 36, text: 'Spaken här öppnar något på Heddas sida. Följ kabeln!' },
        { x: 14, y: 28, text: 'Edvin kan studsa mellan två väggar: hoppa mot väggen och hoppa igen.' },
        { x: 19, y: 20, text: 'Rörpost: välj en sak och tryck E för att skicka den genom muren.' }
      ]
    },
    {
      // Fem våningar. Mark: NOT och AND – lådan på plattan stänger gallret bakom den som åker hissen.
      // Golv 1: Edvin öppnar för Heddas stege, Hedda strömsätter hiss B = AND(batteri, Edvins spak).
      // Golv 2: XOR-dörr – en på plattan, en vid spaken, och sedan byta. Golv 3: plankparkour för Edvin,
      // Hedda gör uppgiften och åker hiss D = AND(uppgift, Edvins spak). Överst: Hedda slår upp väggen.
      name: 'Tornet',
      hint: 'Fem våningar upp. Läs grindarna – de står utskrivna vid kablarna.',
      map: build(40, 44, L => {
        L.ground(41);
        L.set(3, 40, 'E'); L.set(5, 40, 'H');
        L.set(9, 40, 'B');                          // låda
        L.set(14, 40, 'm');                         // platta
        L.door(17, 34, 37, 40, 'a');                // galler a = NOT(m)
        L.set(26, 40, 'n');                         // terminal: koppla kablarna
        L.floor(33, 1, 38); L.fill(20, 33, 22, 33, '.');   // golv 1 med hisshål A
        L.ladder(2, 33, 40);
        L.door(5, 26, 29, 32, 'b');                 // galler b = o (Heddas väg från stegen)
        L.set(8, 32, 'o');                          // spak
        L.set(30, 32, 'p');                         // batteriuttag
        L.fill(34, 26, 34, 30, 'S'); L.fill(37, 26, 38, 32, 'S');   // studsschakt 35–36
        L.floor(25, 1, 38); L.fill(25, 25, 27, 25, '.'); L.fill(35, 25, 36, 25, '=');
        L.set(31, 24, 'q');                         // spak (hiss B)
        L.door(15, 18, 21, 24, 'c');                // galler c = XOR(r,s)
        L.set(17, 24, 'r');                         // platta (höger om dörren)
        L.set(10, 24, 's');                         // spak (vänster om dörren)
        L.floor(17, 1, 38);                         // golv 3
        L.ladder(3, 17, 24);
        L.set(6, 16, 't');                          // terminal: fyll på
        L.fill(24, 14, 26, 14, '='); L.fill(20, 11, 22, 11, '=');   // plankor (bara Edvin)
        L.floor(9, 1, 38); L.fill(10, 9, 12, 9, '.'); L.fill(19, 9, 26, 9, '=');   // golv 4: hisshål D + plankgolv ovanför parkouren
        L.set(26, 8, 'v');                          // spak (hiss D)
        L.door(8, 0, 5, 8, 'C');                    // sprucken vägg
        L.set(4, 8, 'O');
      }),
      triggers: {
        m: { type: 'plate' },
        n: { type: 'task', task: 'wires' },
        o: { type: 'lever' },
        p: { type: 'socket', accepts: ['battery'] },
        q: { type: 'lever' },
        r: { type: 'plate' },
        s: { type: 'lever' },
        t: { type: 'task', task: 'fill' },
        v: { type: 'lever' }
      },
      logic: { a: 'NOT(m)', b: 'o', c: 'XOR(r,s)' },
      lifts: [
        { id: 'A', x: 20, w: 3, bottom: 40, top: 33, logic: 'AND(m,n)' },
        { id: 'B', x: 25, w: 3, bottom: 32, top: 25, logic: 'AND(p,q)' },
        { id: 'D', x: 10, w: 3, bottom: 16, top: 9, logic: 'AND(t,v)' }
      ],
      logicAt: { a: [17, 35], A: [24, 36], c: [15, 19], B: [29, 28], D: [16, 12] },
      items: [['battery', 12, 32]],
      tips: []
    }
  ];

  window.LEVELS.forEach((lv, i) => {
    const all = lv.map.join('');
    ['E', 'H', 'O'].forEach(ch => {
      const n = all.split(ch).length - 1;
      if (n !== 1) throw new Error(`Bana ${i + 1} har ${n} st '${ch}'`);
    });
    lv.map.forEach((r, y) => { if (r.length !== lv.map[0].length) throw new Error(`Bana ${i + 1} rad ${y} har fel bredd`); });
  });
})();
