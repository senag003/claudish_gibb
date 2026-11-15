// characters.js – pixelgrids för Edvin och Hedda (24 bred x 36 hög).
// '.' = genomskinlig. Vända åt höger. Huvud rad 0–13, torso rad 14–25, ben rad 26–35.
// Ritordning per frame: ben, hår-bak, torso, huvud.

window.CHARACTER_ART = (function () {
  'use strict';

  const SKIN = { S: '#f3c9a3', s: '#d39f7a', m: '#b8655a', n: '#e3ae8a' };

  const EDVIN_PAL = Object.assign({}, SKIN, {
    H: '#dcc07a', h: '#a98a4e', k: '#f2e6b4',     // askblont hår
    E: '#2b4a7a', b: '#b8964f',                   // ögon, bryn
    J: '#28355a', j: '#1b2440', K: '#3e5287',     // mörkblå skjortjacka
    T: '#f4f0e8', t: '#d3cdc2', C: '#9aa4b4',     // vit t-shirt, silverkedja
    D: '#4b6594', d: '#36497a',                   // jeans
    G: '#6d7f90', L: '#b6ef3a', w: '#eeeeee',     // grå skor med lime
    x: '#1b1b1b'                                  // sportklocka
  });

  const HEDDA_PAL = Object.assign({}, SKIN, {
    H: '#a67d55', h: '#7d5c3c', k: '#c9a477',     // ljusbrunt hår
    E: '#3d6a85', b: '#8a6a48', m: '#c06a70', p: '#eaa79a',
    T: '#262631', t: '#15151d', K: '#3b3b4a',     // svart t-shirt
    D: '#2e2e3c', d: '#1e1e28',                   // svarta byxor
    G: '#f0a3c2', L: '#c96a92', w: '#f7c6da',     // rosa crocs
    Q: '#f2d25a',                                 // örhängen
    l: '#ffe2c6'                                  // högdager på armmuskler
  });

  // ================= EDVIN =================
  const E_HEAD = [
    '..........kkkk..........',
    '........HHkkkkHk........',
    '.......HHHHHkkHHH.......',
    '......hHHHHHHHHHHh......',
    '......hHhSSSSSHHHh......',
    '......hSSSSSSSSSSh......',
    '......hSbbSSSSbbSh......',
    '......sSSESSSSESSs......',
    '......sSSESSSSESSs......',
    '.......SSSSSsSSSS.......',
    '.......SSSSSSSSSS.......',
    '.......SSSmSSmSSS.......',
    '.......sSSSmmSSSs.......',
    '........ssSSSSss........'
  ];

  const E_IDLE = [
    '..........sSSs..........',
    '......JJJJTTTTJJJJ......',
    '.....JJJJJCTTCJJJJJ.....',
    '.....JKJJJTCCTJJJjJ.....',
    '.....JKJJJTTTTJJJjJ.....',
    '.....JKJJJTTTTJJJjJ.....',
    '.....JK.JJTTTTJJ.jJ.....',
    '.....JK.JJTTTTJJ.jJ.....',
    '.....JK.JJTtTTJJ.jJ.....',
    '.....JK.JJTtTTJJ.jJ.....',
    '.....SS.JJTTTTJJ.sS.....',
    '.....Ss.jjjjjjjj.sS.....'
  ];

  const E_RUN_A = [
    '..........sSSs..........',
    '......JJJJTTTTJJJJ......',
    '.....JJJJJCTTCJJJJJ.....',
    '....JJKJJJTCCTJJJjJJ....',
    '...JJ.KJJJTTTTJJJ.jJJ...',
    '..JJ..KJJJTTTTJJJ..JJJ..',
    '.SS...JJJJTTTTJJJ...SSS.',
    '......JJJJTTTTJJJ.......',
    '......JJJJTtTTJJJ.......',
    '......JJJJTtTTJJJ.......',
    '.......JJJTTTTJJ........',
    '........jjjjjjjj........'
  ];

  const E_RUN_B = [
    '..........sSSs..........',
    '......JJJJTTTTJJJJ......',
    '.....JJJJJCTTCJJJJJ.....',
    '...SJJKJJJTCCTJJJjJ.....',
    '...SJ.KJJJTTTTJJJjJ.....',
    '......KJJJTTTTJJJ.jJ....',
    '......JJJJTTTTJJJ..jJ...',
    '......JJJJTtTTJJJ...jJ..',
    '......JJJJTtTTJJJ...SS..',
    '.......JJJTTTTJJ....Ss..',
    '.......JJJTTTTJJ........',
    '........jjjjjjjj........'
  ];

  const E_JUMP = [
    '....SS....sSSs....SS....',
    '....JJ.JJJTTTTJJJ.JJ....',
    '.....JJJJJCTTCJJJJJ.....',
    '......JKJJTCCTJJjJ......',
    '......JKJJTTTTJJjJ......',
    '......JKJJTTTTJJjJ......',
    '......JKJJTTTTJJjJ......',
    '.......KJJTtTTJJj.......',
    '.......JJJTtTTJJj.......',
    '.......JJJTTTTJJj.......',
    '.......JJJTTTTJJj.......',
    '........jjjjjjjj........'
  ];

  const E_PUSH = [
    '..........sSSs..........',
    '......JJJJTTTTJJJJ......',
    '.....JJJJJCTTCJJJJJ.....',
    '.....JKJJJTCCTJJJjJJ....',
    '.....JKJJJTTTTJJJJJJJSS.',
    '.....JKJJJTTTTJJjjjjjSS.',
    '.....JK.JJTTTTJJ........',
    '.....JK.JJTTTTJJ........',
    '.....Ss.JJTtTTJJ........',
    '.....Ss.JJTtTTJJ........',
    '........JJTTTTJJ........',
    '........jjjjjjjj........'
  ];

  // Kollar sportklockan: höger underarm upp framför bröstet (emote när han står still)
  const E_WATCH = [
    '..........sSSs..........',
    '......JJJJTTTTJJJJ......',
    '.....JJJJJCTTCJJJJJ.....',
    '.....JKJJJTCCTJJJjJ.....',
    '.....JKJJJTTTTJJJjJ.....',
    '.....JKJJJTSSjjjjjJ.....',
    '.....JKJJJTxSjjjjjJ.....',
    '.....JK.JJTTTTJJ.jJ.....',
    '.....JK.JJTtTTJJ........',
    '.....JK.JJTtTTJJ........',
    '.....SS.JJTTTTJJ........',
    '.....Ss.jjjjjjjj........'
  ];

  // ================= HEDDA =================
  const H_HEAD = [
    '.........HHHHHH.........',
    '.......HHkkhhkkHH.......',
    '......HHHkHhhHkHHH......',
    '.....HHHHHHhhHHHHHH.....',
    '.....HHHHSSSSSSHHHH.....',
    '.....HHHSSSSSSSSHHH.....',
    '.....HHSbbSSSSbbSHH.....',
    '.....HHSSESSSSESSHH.....',
    '.....HHSSESSSSESSHH.....',
    '.....HQSSSSSsSSSSQH.....',
    '.....HHpSSSSSSSSpHH.....',
    '.....HHSSSmSSmSSSHH.....',
    '.....HHsSSSmmSSSsHH.....',
    '.....HH.ssSSSSss.HH.....'
  ];

  const H_HAIR_BACK = [
    '.....HHH........HHH.....',
    '.....HHh........hHH.....',
    '.....HHh........hHH.....',
    '.....HHh........hHH.....',
    '......Hh........hH......',
    '......Hh........hH......',
    '......Hh........hH......',
    '......hh........hh......',
    '.......h........h.......',
    '........................',
    '........................',
    '........................'
  ];

  // Hårslingor som hänger ner framför axlarna (ritas efter torson)
  const H_HAIR_FRONT = [
    '.....HHh........hHH.....',
    '......Hh........hH......',
    '......Hh........hH......',
    '......Hh........hH......',
    '......Hh........hH......',
    '......hh........hh......'
  ];

  // Kortärmad svart t-shirt, bara, vältränade armar (biceps 4 px bred)
  // Biceps: 4 px breda, ljus högdager (l) på utsidan, skugga (s) på insidan, rundning vid armbågen (n)
  // Överarm 5 px: kontur (s), 2 px högdager (l) på utsidan, biceps buktar ut under ärmen
  const H_IDLE = [
    '..........sSSs..........',
    '......TTTTTTTTTTTT......',
    '.....TTTTTTTTTTTTTT.....',
    '...TTTTTKTTTTTTtTTTTT...',
    '..sTTTT.KTTTTTTt.TTTTs..',
    '..sllSs.TKTTTTTt.sSlls..',
    '..sllSs.TTTTTTTt.sSlls..',
    '...slSs.TTTTTTTt.sSls...',
    '...nSSs..TTTTTt..sSSn...',
    '...lSSs..TTTTTt..sSSl...',
    '...SSSs..TTTTTt..sSSS...',
    '...sSSs.tttttttt.sSSs...'
  ];

  // Spänner musklerna: armbågarna ut, runda biceps (visas när Hedda står still en stund)
  const H_FLEX = [
    '.SS.......sSSs.......SS.',
    '.lS....TTTTTTTTTT....Sl.',
    '.lS.ll.TTTTTTTTTT.ll.Sl.',
    '.lSllllTTKTTTTtTTllllSl.',
    '.sSSSSSTTKTTTTtTTSSSSSs.',
    '..sssssTTKTTTTtTTsssss..',
    '........TTTTTTTt........',
    '........TTTTTTTt........',
    '.........TTTTTt.........',
    '.........TTTTTt.........',
    '.........TTTTTt.........',
    '........tttttttt........'
  ];

  // Slag: rak arm med knytnäve långt fram
  const H_PUNCH = [
    '..........sSSs..........',
    '......TTTTTTTTTTTT......',
    '.....TTTTTTTTTTTTTTTT...',
    '....TTTTKTTTTTTtTTTTlSSS',
    '....TTT.KTTTTTTtTTsSSSSS',
    '...lSSs.KTTTTTTt.....sSs',
    '...lSSs.TTTTTTTt........',
    '....lSs.TTTTTTTt........',
    '....nSs..TTTTTt.........',
    '....lSs..TTTTTt.........',
    '....SSS..TTTTTt.........',
    '........tttttttt........'
  ];

  const H_RUN_A = [
    '..........sSSs..........',
    '......TTTTTTTTTTTT......',
    '.....TTTTTTTTTTTTTT.....',
    '....TTTTKTTTTTTtTTTT....',
    '...TTT..KTTTTTTt.TTTs...',
    '..sSs...KTTTTTTt..sSSS..',
    '.sSs....TTTTTTTt...sSSS.',
    '.SS.....TTTTTTTt....SSS.',
    '.........TTTTTt.........',
    '.........TTTTTt.........',
    '.........TTTTTt.........',
    '........tttttttt........'
  ];

  const H_RUN_B = [
    '..........sSSs..........',
    '......TTTTTTTTTTTT......',
    '.....TTTTTTTTTTTTTT.....',
    '..sSTTTTKTTTTTTtTTTT....',
    '..SSs...KTTTTTTt.TTT....',
    '........KTTTTTTt..sSs...',
    '........TTTTTTTt...sSs..',
    '........TTTTTTTt...sSS..',
    '.........TTTTTt.....SS..',
    '.........TTTTTt.........',
    '.........TTTTTt.........',
    '........tttttttt........'
  ];

  const H_JUMP = [
    '...sS.....sSSs.....Ss...',
    '...SS.TTTTTTTTTTTT.SS...',
    '...sSTTTTTTTTTTTTTTSs...',
    '....TTTTKTTTTTTtTTTT....',
    '.....TT.KTTTTTTt.TT.....',
    '........KTTTTTTt........',
    '........TTTTTTTt........',
    '........TTTTTTTt........',
    '.........TTTTTt.........',
    '.........TTTTTt.........',
    '.........TTTTTt.........',
    '........tttttttt........'
  ];

  const H_PUSH = [
    '..........sSSs..........',
    '......TTTTTTTTTTTT......',
    '.....TTTTTTTTTTTTTT.....',
    '....TTTTKTTTTTTtTTTTT...',
    '....TTT.KTTTTTTtTTTsSs..',
    '...sSSs.KTTTTTTt.sSSSSSs',
    '...sSSs.TTTTTTTt..sSSSSS',
    '....SSs.TTTTTTTt........',
    '....sSs..TTTTTt.........',
    '....SSS..TTTTTt.........',
    '.........TTTTTt.........',
    '........tttttttt........'
  ];

  // ================= BEN (delas) =================
  const LEGS = {
    idle: [
      '........DDDddDDD........',
      '........DDDddDDD........',
      '........DDd..dDD........',
      '........DDd..dDD........',
      '........DDd..dDD........',
      '........DDd..dDD........',
      '........dDd..dDd........',
      '........GGGG..GGGG......',
      '........GLGG..GGLG......',
      '........wwww..wwww......'
    ],
    contact: [
      '........DDDddDDD........',
      '.......DDDd..dDDD.......',
      '......DDDd....dDDD......',
      '.....DDDd......dDDD.....',
      '....DDDd........dDDD....',
      '...DDDd..........dDDD...',
      '...dDd............dDDd..',
      '.GGGG..............GGGG.',
      '.GLGG..............GGLG.',
      '.wwww..............wwww.'
    ],
    down: [
      '........DDDddDDD........',
      '........DDDd.dDDD.......',
      '.......DDDd...dDDD......',
      '......DDDd....dDDD......',
      '.....DDDd.....dDDd......',
      '....DDDd......dDDd......',
      '...GGGd.......dDDd......',
      '..GGLG........GGGGG.....',
      '..wwww........GGGLG.....',
      '..............wwwww.....'
    ],
    pass: [
      '........DDDddDDD........',
      '........DDDDdDDDD.......',
      '.......DDDd..dDDDDD.....',
      '.......DDDd....dDDDD....',
      '.......DDDd.....ddDD....',
      '.......DDDd.....GGGG....',
      '......DDDd......GGLG....',
      '......dDDd......wwww....',
      '.....GGGG...............',
      '.....wGLG...............'
    ],
    jump: [
      '........DDDddDDD........',
      '.......DDDDddDDDD.......',
      '......DDDd....dDDDD.....',
      '.....DDDd......dDDDD....',
      '.....dDDd.......GGGGG...',
      '.....GGGG.......GGGLG...',
      '.....GLGG.......wwwww...',
      '.....wwww...............',
      '........................',
      '........................'
    ],
    fall: [
      '........DDDddDDD........',
      '........DDDd.dDDD.......',
      '.......DDDd...dDDD......',
      '.......DDDd...dDDD......',
      '......DDDd.....dDDD.....',
      '......DDDd.....dDDD.....',
      '......dDDd.....dDDd.....',
      '.....GGGGG....GGGGG.....',
      '.....GLGGG....GGGLG.....',
      '.....wwwww....wwwww.....'
    ],
    squat: [
      '.......DDDDddDDDD.......',
      '......DDDDd..dDDDD......',
      '.....DDDd......dDDD.....',
      '.....DDDd......dDDD.....',
      '......DDDd....dDDD......',
      '......DDDd....dDDD......',
      '......dDDd....dDDd......',
      '.....GGGGG...GGGGG......',
      '.....GLGGG...GGGLG......',
      '.....wwwww...wwwww......'
    ],
    push1: [
      '..........DDDddDDD......',
      '.........DDDd.dDDDD.....',
      '........DDDd...dDDD.....',
      '.......DDDd....dDDD.....',
      '......DDDd.....dDDD.....',
      '.....DDDd......dDDD.....',
      '....DDDd.......dDDd.....',
      '..GGGGd........GGGGG....',
      '..GLGG.........GGGLG....',
      '..wwww.........wwwww....'
    ],
    push2: [
      '..........DDDddDDD......',
      '.........DDDd..dDDD.....',
      '........DDDd....dDDD....',
      '.......DDDd......dDDD...',
      '......DDDd.......dDDd...',
      '.....DDDd........dDDd...',
      '...DDDd..........dDDd...',
      '.GGGGd...........GGGGG..',
      '.GLGG............GGGLG..',
      '.wwww............wwwww..'
    ]
  };

  // ================= GARDEROB =================
  // Varje val byter färger i paletten. Tröjor är per figur, byxor och skor delas.
  const OUTFITS = {
    edvin: {
      tops: [
        { name: 'Mörkblå jacka', pal: {} },
        { name: 'Svart jacka', pal: { J: '#26262e', j: '#17171d', K: '#3c3c48' } },
        { name: 'Grön jacka', pal: { J: '#3d5a3a', j: '#2a4128', K: '#57794f' } },
        { name: 'Vinröd jacka', pal: { J: '#6b2a35', j: '#4a1b24', K: '#8c3f4a' } },
        { name: 'Beige jacka', pal: { J: '#b59e7a', j: '#8e7a5b', K: '#cdb995' } },
        { name: 'Grå jacka, svart tröja', pal: { J: '#6c7280', j: '#4f5562', K: '#8a909d', T: '#2a2a33', t: '#1b1b22' } }
      ],
      defaults: { top: 0, pants: 0, shoes: 0 }
    },
    hedda: {
      tops: [
        { name: 'Svart t-shirt', pal: {} },
        { name: 'Vit t-shirt', pal: { T: '#f1ede6', t: '#cfc8bc', K: '#ffffff' } },
        { name: 'Rosa t-shirt', pal: { T: '#e98bb0', t: '#c46a8e', K: '#f5b3cc' } },
        { name: 'Grön t-shirt', pal: { T: '#5d9a5a', t: '#437a42', K: '#7fbb79' } },
        { name: 'Blå t-shirt', pal: { T: '#4a6fb0', t: '#34538a', K: '#6b8fcc' } },
        { name: 'Röd t-shirt', pal: { T: '#c0403d', t: '#93302d', K: '#de6a66' } }
      ],
      defaults: { top: 0, pants: 1, shoes: 1 }
    },
    pants: [
      { name: 'Blå jeans', pal: { D: '#4b6594', d: '#36497a' } },
      { name: 'Svarta byxor', pal: { D: '#2e2e3c', d: '#1e1e28' } },
      { name: 'Beige chinos', pal: { D: '#b8a27c', d: '#94805d' } },
      { name: 'Gröna byxor', pal: { D: '#4f6b45', d: '#3a5133' } },
      { name: 'Ljusa jeans', pal: { D: '#8fa6c9', d: '#6f87ad' } }
    ],
    shoes: [
      { name: 'Löparskor', pal: { G: '#6d7f90', L: '#b6ef3a', w: '#eeeeee' } },
      { name: 'Rosa crocs', pal: { G: '#f0a3c2', L: '#c96a92', w: '#f7c6da' } },
      { name: 'Vita sneakers', pal: { G: '#f2f2f2', L: '#c8c8c8', w: '#ffffff' } },
      { name: 'Svarta kängor', pal: { G: '#2a2a30', L: '#4a4a55', w: '#5a4636' } },
      { name: 'Gula crocs', pal: { G: '#f2d25a', L: '#c9a63a', w: '#f7e49a' } },
      { name: 'Röda skor', pal: { G: '#c0403d', L: '#f6f1e8', w: '#eeeeee' } }
    ]
  };

  return {
    W: 24, H: 36,
    outfits: OUTFITS,
    legs: LEGS,
    edvin: {
      pal: EDVIN_PAL, head: E_HEAD, hairBack: null,
      torso: { idle: E_IDLE, runA: E_RUN_A, runB: E_RUN_B, jump: E_JUMP, push: E_PUSH, watch: E_WATCH }
    },
    hedda: {
      pal: HEDDA_PAL, head: H_HEAD, hairBack: H_HAIR_BACK, hairFront: H_HAIR_FRONT,
      torso: { idle: H_IDLE, runA: H_RUN_A, runB: H_RUN_B, jump: H_JUMP, push: H_PUSH, flex: H_FLEX, punch: H_PUNCH }
    }
  };
})();
