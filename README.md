# Studieplatform

Een persoonlijk flashcard-studieplatform, geïnspireerd op Quizlet en Anki. Alles draait lokaal op je eigen computer met een SQLite-database: geen account, geen API-key, geen cloud.

**Stap 1 (deze versie):** decks en vakken, kaarten maken/bewerken/verwijderen, bulk plakken, JSON-import/export, drie studiemodi (Flashcards, Leren, Herhalen met SM-2 spaced repetition), een dashboard met echte cijfers, en een CLI waarmee Claude Code de inhoud direct beheert.

## Starten

Je hebt [Node.js](https://nodejs.org) 20 of nieuwer nodig (de LTS-versie is prima).

```bash
npm install      # eenmalig: installeert alles en genereert de database-client
npm run dev      # maakt/updatet de database en start de app
```

Open daarna **http://localhost:3000**.

De database is het bestand `prisma/dev.db`. Een back-up maken = dat bestand kopiëren.

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | App starten (ontwikkelmodus) |
| `npm run build` en `npm start` | Snellere productieversie bouwen en starten |
| `npm test` | Tests draaien |
| `npm run agent -- help` | De agent-CLI (zie hieronder) |

## Studiemodi

- **Flashcards**: `Spatie` draait om, `←`/`→` navigeren, `1` = nog niet, `2` = ken ik. Schudden en omgekeerde modus (antwoord eerst) zitten rechtsboven.
- **Leren**: elke kaart eerst als meerkeuzevraag, daarna moet je het antwoord typen. Hoofdletters, accenten, spaties en kleine typfouten worden genegeerd, `cm⁻¹` telt gelijk aan `cm-1`. Getallen moeten exact kloppen. Wat je fout hebt komt snel terug, wat je goed hebt steeds later. Met "Ik had het goed" corrigeer je een te strenge beoordeling.
- **Herhalen (spaced repetition)**: SM-2 met de knoppen Opnieuw / Moeilijk / Goed / Makkelijk (toetsen `1`–`4`). Onder elke knop staat wanneer je de kaart terugziet. Een kaart telt pas als *beheerst* bij een interval van 21 dagen of meer, dus niet na één keer goed.

Bij **Instellingen** stel je in hoeveel nieuwe kaarten per dag in de herhaalmodus komen. Voor een tentamen binnenkort kun je dit verhogen.

## Kaarten toevoegen

- **Eén voor één** op de deckpagina of via *Maken*. Met `Ctrl+Enter` sla je op en ga je door naar de volgende.
- **Plakken**: één kaart per regel, `vraag - antwoord`, `vraag;antwoord` of tab-gescheiden (direct uit Excel of een Word-tabel).
- **JSON importeren**: zie [`agent/IMPORT_FORMAT.md`](agent/IMPORT_FORMAT.md).
- **Cloze**: zet het weg te laten woord tussen dubbele accolades: `De C=O-strekking ligt rond {{1700}} cm⁻¹`.
- Meerdere goede antwoorden scheid je met `;` of `|`, bijvoorbeeld `keton; aldehyde`.

## Claude Code laten meewerken

Claude Code kan decks en kaarten direct in de database beheren via de agent-CLI, zonder dat je iets in de interface hoeft te doen:

```bash
npm run agent -- overview
npm run agent -- import pad/naar/deck.json
npm run agent -- weak --limit 10
```

Volledige referentie: [`agent/README.md`](agent/README.md). Instructies voor Claude Code staan in [`CLAUDE.md`](CLAUDE.md).

## Projectstructuur

```
prisma/schema.prisma     databaseschema (vakken, decks, kaarten, sessies, reviews)
src/lib/                 gedeelde logica: SM-2 (srs.ts), antwoordcontrole (answer.ts), Zod-schema's
src/server/              servicelaag: de enige plek die de database aanspreekt
src/app/                 Next.js-pagina's en server actions (UI)
src/components/          UI-componenten en studiemodi
agent/                   CLI en documentatie voor Claude Code
tests/                   Vitest-tests
```

## Stap 2 (gepland)

Testmodus, Matching-modus, uitgebreide grafieken, CSV-import/export, automatische back-ups, afbeeldingen uploaden en verdere afwerking.
