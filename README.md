# Edvin & Hedda – och hönan som rymde

Ett 2D-pixelart-pusselspel i webbläsaren. Byt mellan Edvin (snabb, hoppar högt och studsar mellan väggar) och Hedda (stark: knuffar lådor, slår sönder väggar och bär tunga saker) och samarbeta genom höga banor för att fånga hönan som rymt.

## Spela

Öppna `index.html` i webbläsaren. Ingen installation behövs.

| Tangent | Gör |
|---|---|
| Pilar / WASD | Gå, klättra i stegar (upp/ner) |
| Mellanslag | Hoppa (Edvin: hoppa mot en vägg och hoppa igen för att studsa) |
| TAB | Byt figur |
| E | Använd, ta upp, öppna terminal, slå |
| 1–4 | Välj sak i inventariet |
| F | Släpp vald sak |
| R | Börja om banan |
| C | Garderob: byt tröja, byxor och skor när som helst |

## Föremål, kretsar och terminaler

Edvin och Hedda har var sitt inventarie med 4 platser. Batteriet är tungt, så bara Hedda orkar bära det. Spakar, plattor, uttag, kortläsare och terminaler är kopplade med kablar till galler, broar och hissar. Ibland går kablarna via en logikgrind (AND, OR, XOR eller NOT), och grindens namn står på skylten. En gul kabel har ström. Vid terminalerna väntar små uppgifter: koppla kablar, kalibrera en mätare eller fyll på kylvätska. Med rörposten kan man skicka saker genom väggar.

## Banor

1. **Fabriken**: en hiss som drivs av batteri eller spak, en kabeluppgift, en AND-grind och plankparkour.
2. **Skilda åt**: Edvin och Hedda börjar på varsin sida av en mur och måste hjälpa varandra genom den med spakar, rörpost, hissar och uppgifter.
3. **Tornet**: fem våningar med NOT, AND och XOR, tre hissar, studsschakt och parkour.

(Det finns en hemlighet att hitta.)

## Kod

- `js/characters.js`: figurernas pixelgrafik (24×36) och garderobens kläder
- `js/sprites.js`: bygger figurer, höna, tiles och bakgrund till canvas
- `js/levels.js`: banorna
- `js/engine.js`: fysik, kamera, stegar, väggstudsar, rendering och ljud
- `js/puzzles.js`: inventarie, logikgrindar, kablar, hissar, rörpost, terminaler med minispel och en hemlighet
- `js/main.js`: tangentbord, skalning och spel-loop
