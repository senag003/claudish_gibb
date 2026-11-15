# Edvin & Hedda – och hönan som rymde

Ett 2D-pixelart-pusselspel i webbläsaren. Byt mellan Edvin (snabb, hoppar högt) och Hedda (stark: knuffar lådor och slår sönder väggar) och samarbeta för att fånga hönan som rymt.

## Spela

Öppna `index.html` i webbläsaren. Ingen installation behövs.

| Tangent | Gör |
|---|---|
| Pilar / WASD | Gå |
| Mellanslag | Hoppa |
| TAB | Byt figur |
| E | Använd spak/knapp. Hedda slår (sönder spruckna väggar) |
| R | Börja om banan |
| C | Garderob: byt tröja, byxor och skor, när som helst |

## Banor

1. **Hönan har rymt**: spak, sprucken vägg och en tryckplatta som någon måste stå kvar på.
2. **Två plattor, en låda**: två plattor men bara en låda, sedan en spikgrop med bro.
3. **På varandras axlar**: Edvin står på Heddas huvud, en tidsknapp, och till sist ett torn av låda, Hedda och Edvin.

## Kod

- `js/characters.js`: figurernas pixelgrafik (24×36) och garderobens kläder
- `js/sprites.js`: bygger figurer, höna, tiles och bakgrund till canvas
- `js/levels.js`: banorna
- `js/engine.js`: fysik, pussel, rendering och ljud
- `js/main.js`: tangentbord, skalning och spel-loop

## Utvecklingsverktyg

- `tools/solve.html`: en lösningsbot spelar igenom alla banor med riktig fysik och kör fusk-tester (saker som inte ska gå)
- `tools/preview.html`: granskningsark med alla animationer, tiles och spelskärmar
- `tools/shoot.ps1`: tar skärmdumpar av sidorna ovan med headless Edge (Windows)
