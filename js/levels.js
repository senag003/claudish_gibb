// levels.js – banor byggda med kod. 16 rader hög, varierande bredd. Tile = 16 px.
// Marken ligger på rad 13 (rad 13–15 fasta). Figurer står med fötterna på rad 13.
//
// Tecken i griden:
//   #  mark   S  sten   C  sprucken vägg (Hedda)   X  hemlig vägg (ser ut som sten, Hedda)   ^  spikar
//   B  tung låda (Hedda knuffar)   O  hönan   E/H  start för Edvin/Hedda
//   1–9  utlösare (typ i triggers): lever, plate, button, socket (uttag), reader (kortläsare)
//   a–d  galler (öppna när logiken är sann)   e–h  broplankor (fasta när logiken är sann)
//
// logic: uttryck per dörr – "3", "AND(1,2)", "OR(1,3)", "XOR(5,6)", "NOT(3)", "CODE(0xB,1,2,3,4)" (bitar MSB först)
// items: [typ, x, y] – wrench, battery (tungt, bara Hedda), fuse, keycard, birkin
//
// Förmågor (kontrolleras i utveckling/solve.html):
//   Edvin hoppar 3,5 tiles högt och över gropar upp till ~6 breda. Hedda hoppar 1,7 tiles, ~3 tiles långt.
//   Edvin på Heddas huvud: 5,4 tiles. Edvin på Hedda på en låda: 6,4 tiles. Ingen klarar en 7 bred grop.

(function () {
  'use strict';

  function build(cols, fn) {
    const g = [];
    for (let y = 0; y < 16; y++) g.push(new Array(cols).fill('.'));
    const api = {
      set(x, y, ch) { g[y][x] = ch; },
      fill(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; },
      base() {
        api.fill(0, 13, cols - 1, 15, '#');
        api.fill(0, 0, 0, 12, 'S');
        api.fill(cols - 1, 0, cols - 1, 12, 'S');
      },
      wallWith(x, ch, fromRow) { api.fill(x, 0, x, fromRow - 1, 'S'); api.fill(x, fromRow, x, 12, ch); },
      ledge(x0, x1, k, ch) { api.fill(x0, 13 - k, x1, 12, ch || '#'); },
      pit(x0, x1, bridge) { api.fill(x0, 13, x1, 13, bridge || '.'); api.fill(x0, 14, x1, 14, '^'); }
    };
    fn(api);
    return g.map(r => r.join(''));
  }

  window.LEVELS = [
    {
      // Verktyg och de första grindarna. AND: lådan på plattan + lagad spak.
      // NOT: grind B är stängd så länge batteriet sitter i – men bron behöver batteriet.
      name: 'Verkstaden',
      hint: 'E plockar upp, släpper och använder saker. Läs kablarna: gul = ström.',
      map: build(50, L => {
        L.base();
        L.set(7, 12, 'E'); L.set(9, 12, 'H');
        L.ledge(1, 4, 3);                  // 3 hög – bara Edvin
        L.set(11, 12, 'B');                // låda
        L.set(13, 12, '2');                // trasig spak
        L.set(16, 12, '1');                // platta
        L.wallWith(19, 'a', 9);            // A = AND(1,2)
        L.set(25, 12, '3');                // batteriuttag
        L.pit(27, 33, 'e');                // 7 bred grop – ingen hoppar över
        L.wallWith(37, 'b', 9);            // B = NOT(3)
        L.ledge(42, 48, 2);                // 2 hög – bara Edvin
        L.set(45, 10, 'O');
      }),
      triggers: {
        '1': { type: 'plate' },
        '2': { type: 'lever', broken: true },
        '3': { type: 'socket', accepts: ['battery'] }
      },
      logic: { a: 'AND(1,2)', e: '3', b: 'NOT(3)' },
      logicAt: { a: [19, 4], b: [37, 4] },
      items: [['wrench', 2, 9], ['battery', 22, 12]],
      tips: [
        { x: 4, text: 'Skiftnyckeln ligger högt upp. E plockar upp.' },
        { x: 13, text: 'Spaken är trasig. Bär dit skiftnyckeln och tryck E.' },
        { x: 22, text: 'Batteriet är tungt – bara Hedda orkar bära det.' }
      ]
    },
    {
      // Binärlås: fyra spakar = bitarna 8 4 2 1. Grinden kräver 0xB = 1011.
      // Spakarna sitter där bara Edvin, bara Edvin-på-Hedda och bara Hedda kommer åt.
      name: 'Binärlåset',
      hint: 'Grinden öppnas när spakarna bildar rätt tal. Talet står i hex.',
      map: build(48, L => {
        L.base();
        L.set(9, 12, 'E'); L.set(11, 12, 'H');
        L.ledge(1, 4, 3, 'S');             // stenavsats 3 hög
        L.fill(2, 11, 3, 12, '.');         // hålrum inne i avsatsen …
        L.fill(4, 11, 4, 12, 'X');         // … bakom en hemlig vägg
        L.set(2, 9, '2');                  // bit 4 (står på från början)
        L.set(14, 12, '1');                // bit 8
        L.fill(18, 8, 21, 8, 'S');         // svävande platta 5 upp
        L.set(19, 7, '3');                 // bit 2
        L.wallWith(24, 'C', 8);            // sprucken vägg
        L.set(26, 12, '4');                // bit 1
        L.wallWith(29, 'a', 9);            // A = CODE(0xB)
        L.set(40, 12, 'O');
      }),
      triggers: {
        '1': { type: 'lever' },
        '2': { type: 'lever', on: true },
        '3': { type: 'lever' },
        '4': { type: 'lever' }
      },
      logic: { a: 'CODE(0xB,1,2,3,4)' },
      logicAt: { a: [29, 4] },
      codeLabel: '0xB',
      labels: [[14, 12, '8'], [2, 9, '4'], [19, 7, '2'], [26, 12, '1']],
      items: [['birkin', 2, 12]],
      tips: []
    },
    {
      // En säkring, två uttag. Bron = OR(säkring 1, platta 3) så något tungt måste hålla bron
      // när säkringen flyttas. Nyckelkortet ligger 6 upp: låda + Hedda + Edvin. Sist: XOR.
      name: 'Strömavbrott',
      hint: 'En säkring, två säkringsdosor. Tänk på i vilken ordning.',
      map: build(56, L => {
        L.base();
        L.set(3, 12, 'E'); L.set(5, 12, 'H');
        L.set(10, 12, 'B');                // låda
        L.set(13, 12, '1');                // säkringsdosa 1
        L.pit(15, 21, 'e');                // 7 bred grop, bro = OR(1,3)
        L.set(24, 12, '3');                // platta
        L.set(27, 12, '2');                // säkringsdosa 2
        L.fill(31, 7, 34, 7, 'S');         // svävande avsats 6 upp
        L.set(40, 12, '4');                // kortläsare
        L.wallWith(42, 'a', 9);            // A = AND(2,4)
        L.set(45, 12, '6');                // spak (på från början)
        L.fill(46, 12, 48, 12, '5');       // bred platta framför grind B
        L.wallWith(49, 'b', 9);            // B = XOR(5,6)
        L.wallWith(51, 'C', 8);            // sprucken vägg – Hedda måste också igenom
        L.set(53, 12, 'O');
      }),
      triggers: {
        '1': { type: 'socket', accepts: ['fuse'] },
        '2': { type: 'socket', accepts: ['fuse'] },
        '3': { type: 'plate' },
        '4': { type: 'reader', accepts: ['keycard'] },
        '5': { type: 'plate' },
        '6': { type: 'lever', on: true }
      },
      logic: { e: 'OR(1,3)', a: 'AND(2,4)', b: 'XOR(5,6)' },
      logicAt: { e: [18, 9], a: [42, 4], b: [49, 4] },
      items: [['fuse', 8, 12], ['keycard', 33, 6]],
      tips: []
    }
  ];

  window.LEVELS.forEach((lv, i) => {
    if (lv.map.length !== 16) throw new Error(`Bana ${i + 1}: ${lv.map.length} rader`);
    const all = lv.map.join('');
    ['E', 'H', 'O'].forEach(ch => {
      const n = all.split(ch).length - 1;
      if (n !== 1) throw new Error(`Bana ${i + 1} har ${n} st '${ch}'`);
    });
  });
})();
