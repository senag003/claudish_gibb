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

## Föremål och kretsar

E plockar upp, släpper och använder saker. Varje figur bär en sak åt gången. Batteriet är tungt, så bara Hedda orkar bära det. Spakar, plattor, säkringsdosor och kortläsare är kopplade med kablar via logikgrindar (AND, OR, XOR, NOT) till galler och broar. En gul kabel har ström.

## Banor

1. **Verkstaden**: laga en trasig spak, en AND-grind, och ett batteri som både driver en bro och håller en NOT-grind stängd.
2. **Binärlåset**: fyra spakar är bitar, och grinden öppnas när de visar rätt hexadecimala tal.
3. **Strömavbrott**: en säkring och två säkringsdosor. Ordningen spelar roll, och sist kommer en XOR.

(Det finns en hemlighet att hitta.)

## Kod

- `js/characters.js`: figurernas pixelgrafik (24×36) och garderobens kläder
- `js/sprites.js`: bygger figurer, höna, tiles och bakgrund till canvas
- `js/levels.js`: banorna
- `js/engine.js`: fysik, pussel, rendering och ljud
- `js/puzzles.js`: föremål, logikgrindar, kablar, säkringsdosor, kortläsare och en hemlighet
- `js/main.js`: tangentbord, skalning och spel-loop
