---
id: 27
title: Print / save as PDF: final results, groups and brackets
status: open
labels: [ready-for-agent]
created: 2026-11-20
---

# 0027: Print / save as PDF: final results, groups and brackets

## Parent

#0001

## Problem Statement

When a tournament ends, the operator needs a record of it on paper or as a PDF: the final places of every competition, the group standings with every result, and the brackets. That record goes on the noticeboard, goes to the club or federation, and settles questions afterwards. Today the only way to get anything out of the app is the tournament file, which is for backups and re-importing, not for people. Screenshots of the canvas are partial, blurry and don't fit a page.

## Solution

Once every competition in the tournament is finished, the operator can open a printout of the whole tournament and print it or save it as a PDF with the browser's own print dialog. It is laid out for A4: each competition starts on a new page, with its final places, then its groups (cross table of results and standings), then its brackets. Large brackets continue on as many pages as they need. Before the tournament is finished the printout isn't offered.

## User Stories

1. As an operator, I want a "Print / PDF" button once the tournament is finished, so that I can produce the results record in one step.
2. As an operator, I want the button to be unavailable while any competition is still being played, and to say why, so that I never print provisional results by mistake.
3. As an operator, I want the printout to cover every competition of the tournament in one document, so that I print or save it once.
4. As an operator, I want each competition to start on a new page, so that I can hand out or pin up one competition's pages on their own.
5. As an operator, I want to save the printout as a PDF through the browser's print dialog, so that I can email it without extra software.
6. As an operator, I want to print it directly to a printer from the same dialog, so that I can pin it up at the venue.
7. As an operator, I want the printout to work offline, so that I can produce it in a hall without Wi-Fi.
8. As an operator, I want text in the PDF to be sharp and selectable, so that it reads well and can be searched or copied.
9. As an operator, I want the printout in the app's current language (EN or PL), so that it suits the event.
10. As a reader, I want a header on every competition with the tournament name, date and venue, and the competition name, so that each page set is self-explanatory.
11. As a reader, I want the competition's final places first, so that the most asked-for information is on top.
12. As a reader, I want shared places shown as a range (e.g. 5–6, 9–12), so that I understand who shares a place.
13. As a reader, I want each placed player's name and club, so that I can tell players with similar names apart.
14. As a reader, I want withdrawn players marked in the final places, so that their place is understood.
15. As a reader, I want each group's cross table with every result, so that I can check any match in the group.
16. As a reader, I want results in the cross table read from the row player's point of view, so that I can read a player's row at a glance.
17. As a reader, I want walkovers, retirements and disqualifications marked in the cross table as on screen, so that special results are clear.
18. As a reader, I want carried-over results marked in a second groups stage, so that I know they weren't played again.
19. As a reader, I want each group's final standings (place, name, matches won/lost, group points, games), so that I see who advanced and why.
20. As a reader, I want ties settled by the tiebreak rules or by the operator shown as such, so that the order is not questioned.
21. As a reader, I want every bracket with all its results, so that I can follow each player's path.
22. As a reader, I want origin labels such as "1A" next to the players who came from groups, so that I can see where they came from.
23. As a reader, I want a double elimination's winners bracket, losers bracket, 2nd final and place play-offs each shown clearly, so that I can follow the whole competition.
24. As a reader, I want brackets laid out on landscape pages and the results on portrait pages, so that each fits the paper well.
25. As a reader, I want a bracket too big for one page continued on further pages at a readable size, so that I never need a magnifying glass.
26. As a reader, I want a bracket split across pages to say which part each page shows (e.g. "Top half", "Bottom half", "Final"), so that I can put the pages together.
27. As a reader, I want nothing on the printout that only makes sense on screen (buttons, hints, timers, status badges such as "ready" or "overdue"), so that it looks like a clean results sheet.
28. As a reader, I want page numbers, so that I can keep a multi-page printout in order.
29. As an operator, I want a groups-only competition to print without an empty bracket section, so that the printout has no blank parts.
30. As an operator, I want a competition that has no entries or no stages left out, so that the printout has no empty pages.

## Implementation Decisions

- **Print route.** A tournament-level printout route (e.g. `/tournaments/:id/print`), outside the operator layout, rendering every competition in tab order. The operator reaches it from a "Print / PDF" button on the play screen (and the competitions screen). The page has a "Print" button that calls the browser's print dialog; there is no PDF library (images of brackets would be blurry, and it would add a large dependency and a second layout).
- **Gate: tournament finished.** A new engine query, e.g. `getTournamentProgress(state)`, says per competition whether it is finished (its final places are complete, the same rule as `getFinalPlaces(...).complete`) and whether the whole tournament is finished (every competition with entries is). The button is disabled with a hint naming the competitions still in play; the print route shows the same message instead of the printout when opened early. This is the one new engine piece; everything else reuses existing queries (`getFinalPlaces`, `getStage`, `getCompetitions` and the tournament header).
- **Page layout, by print CSS.** A4. Each competition starts a new page. Final places and groups print portrait; brackets print landscape, using named `@page` rules (with a portrait fallback where the browser ignores them). Page numbers from the print margin boxes where supported. Screen-only parts are hidden with a print media rule.
- **Reused components, print mode.** The groups section reuses the group detail's cross table and the standings, and the brackets reuse the bracket board with the play-off layout the operator chose, all non-interactive. Pull the cross table out of the group detail so both can use it. Print mode drops statuses, timers, clickable states and hover-only text; it keeps result badges for special results and origin labels.
- **Big brackets.** A bracket section is scaled to the page width when that keeps text at a readable minimum (about 8 pt). When it doesn't (in practice 32+ entries, or a large losers bracket), it's split into halves (top half, bottom half, then the rounds from the semi-finals on), each on its own landscape page with a caption saying which part it is. Double elimination prints winners bracket, losers bracket, 2nd final and place play-offs as separate sections.
- **Language and vocabulary.** All print text in EN and PL, using the glossary (final places, place range, group, standings, cross table, bracket, winners bracket, losers bracket, 2nd final, place play-off, origin label, walkover, retirement, withdrawal).
- **No state change.** Nothing is stored and the tournament file doesn't change, so no migration.

## Testing Decisions

- A good test checks external behaviour through the engine interface (ADR 0004): set up with commands, then assert on what the query returns. Components, print CSS and layout are not unit-tested.
- **Tested:** the new progress query, through `execute` + the query, in a new engine test file:
  - a tournament with no competitions, or with competitions not yet drawn, is not finished;
  - a competition becomes finished when its last result decides every place (single elimination, double elimination with the 2nd final, groups only, groups → bracket with place play-offs on);
  - one competition still in play keeps the tournament unfinished and is listed as such;
  - a correction that resets later matches makes a finished competition unfinished again;
  - a competition with no entries doesn't block the tournament.
- **Prior art:** `finalPlaces.test.ts` and `playOffs.test.ts` (competitions played to the end), `multipleCompetitions.test.ts`, `corrections.test.ts`, and the scenario helpers in `__tests__/scenarios.ts` and `groupsToBracketScenarios.ts`.
- **Browser check:** a finished tournament with a groups → single elimination competition (with place play-offs), a 16-entry double elimination and a 32-entry single elimination. Print preview and "Save as PDF" in Chrome/Edge, A4: competitions start on new pages, brackets are landscape and readable, the 32-entry bracket splits into captioned pages, nothing screen-only shows. Attach the PDF or screenshots to the report. Also check the button is disabled with its hint on an unfinished tournament.
- `npm test`, `npm run build` and `npm run lint` stay green.

## Out of Scope

- Printing during the event (an in-progress bracket for the wall, provisional results). The user asked for the printout only after the tournament.
- Printing a single competition on its own (the browser's page range can do that).
- A generated PDF file without the print dialog, or a PDF library.
- Paper sizes other than A4, or layout settings.
- Logos, sponsors or custom headers.
- Exporting to spreadsheets (CSV/XLSX).

## Further Notes

- "Finished" is per competition from its final places, so it reuses the rule the places panel already shows. If an event ends with a competition abandoned, the operator records the remaining results (e.g. walkovers) to finish it; there is no override in this ticket.
- Named `@page` landscape pages and page-number margin boxes are supported in Chromium-based browsers, which is what the operator uses; elsewhere the printout still prints, portrait, without page numbers.

## Blocked by

None (can start immediately)
