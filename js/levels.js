// levels.js – banor byggda med kod. 16 rader hög, varierande bredd. Tile = 16 px.
// Marken ligger på rad 13 (rad 13–15 fasta). Figurer står med fötterna på rad 13.
//
// Tecken i griden:
//   #  mark     S  sten     C  sprucken vägg (Hedda slår sönder)     ^  spikar
//   B  tung låda (Hedda knuffar)    O  hönan    E/H  start för Edvin/Hedda
//   1–4  utlösare (typ i triggers)  a–d  galler (öppna när villkor uppfyllt)
//   e–h  broplankor (fasta när villkor uppfyllt)
//
// Förmågor (kontrolleras i tools/solve.html):
//   Edvin hoppar 3,5 tiles högt och över gropar 4 breda. Hedda hoppar 1,7 tiles och klarar inte 4 breda gropar.
//   Edvin på Heddas huvud: 5,4 tiles. Edvin på Hedda som står på en låda: 6,4 tiles.
//   Vem som helst kan stå på en platta. Bara Hedda knuffar lådor och slår sönder väggar.

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
      // spikgrop med bro (bredd 4)
      pit(x0, x1, bridge) { api.fill(x0, 13, x1, 13, bridge || '.'); api.fill(x0, 14, x1, 14, '^'); }
    };
    fn(api);
    return g.map(r => r.join(''));
  }

  window.LEVELS = [
    {
      // Lär ut: Edvin hoppar högt, Hedda slår sönder, någon måste stanna kvar på en platta.
      name: 'Hönan har rymt',
      hint: 'TAB byter figur. Edvin hoppar högt, Hedda är stark. E = använd.',
      map: build(40, L => {
        L.base();
        L.set(7, 12, 'E'); L.set(9, 12, 'H');
        L.ledge(1, 4, 3);                  // 3 hög – bara Edvin
        L.set(2, 9, '1');                  // spak
        L.wallWith(15, 'a', 9);            // galler 1 (spaken)
        L.wallWith(21, 'C', 8);            // sprucken vägg
        L.set(25, 12, '2');                // platta
        L.wallWith(28, 'b', 9);            // galler 2 (bara medan plattan är nere)
        L.ledge(33, 38, 2);                // 2 hög – bara Edvin
        L.set(35, 10, 'O');
      }),
      triggers: { '1': { type: 'lever' }, '2': { type: 'plate' } },
      conds: { a: [['1']], b: [['2']] },
      tips: [
        { x: 5, text: 'Bara Edvin hoppar så högt. Dra i spaken med E.' },
        { x: 18, text: 'Sprickan? Byt till Hedda (TAB) och slå sönder den med E.' }
      ]
    },
    {
      // Två plattor men bara en låda. Ordningen spelar roll.
      name: 'Två plattor, en låda',
      hint: 'Gallret öppnas bara när BÅDA plattorna är nedtryckta.',
      map: build(48, L => {
        L.base();
        L.set(2, 12, 'E'); L.set(4, 12, 'H');
        L.set(7, 12, 'B');
        L.set(11, 12, '1');
        L.set(13, 12, '2');
        L.wallWith(16, 'a', 9);            // kräver 1+2, eller spak 3
        L.set(19, 12, '3');                // spak på andra sidan
        L.pit(23, 26, 'e');                // 4 bred spikgrop, bro e
        L.set(30, 12, '4');                // spak för bron
        L.wallWith(34, 'C', 8);
        L.ledge(39, 46, 3);                // 3 hög – bara Edvin
        L.set(43, 9, 'O');
      }),
      triggers: { '1': { type: 'plate' }, '2': { type: 'plate' }, '3': { type: 'lever' }, '4': { type: 'lever' } },
      conds: { a: [['1', '2'], ['3']], e: [['4']] },
      tips: []
    },
    {
      // Stapla, tidsknapp, och vem håller plattan medan lådan ska över gropen?
      name: 'På varandras axlar',
      hint: 'Edvin kan stå på Heddas huvud. Den du inte styr står kvar.',
      map: build(50, L => {
        L.base();
        L.set(8, 12, 'E'); L.set(10, 12, 'H');
        L.ledge(1, 5, 5);                  // 5 hög – Edvin måste stå på Hedda
        L.set(3, 7, '1');                  // tidsknapp
        L.wallWith(18, 'a', 9);            // öppnas av knappen en kort stund
        L.set(20, 12, '2');                // platta som håller bron uppe
        L.set(22, 12, 'B');                // låda
        L.pit(26, 29, 'e');
        L.ledge(41, 48, 6, 'S');           // 6 hög – låda + Hedda + Edvin
        L.fill(41, 7, 48, 7, '#');
        L.set(45, 6, 'O');
      }),
      triggers: { '1': { type: 'button', time: 7 }, '2': { type: 'plate' } },
      conds: { a: [['1']], e: [['2']] },
      tips: [
        { x: 7, text: 'Hur kommer man upp dit? Edvin kan stå på Hedda.' }
      ]
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
