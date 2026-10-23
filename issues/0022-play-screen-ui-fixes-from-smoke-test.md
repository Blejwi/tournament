---
id: 22
title: Play screen UI fixes from the browser smoke test
status: open
labels: [ready-for-agent]
created: 2026-10-24
---

# 0022: Play screen UI fixes from the browser smoke test

## Parent

#0001

## What to build

Fix three problems found when the merged `integration/v1` was tried in a browser on 2026-10-24. The test used a seeded tournament: Men's Open as 4 groups → single elimination, U15 as a 16-player double elimination, and 8 tables, with a laptop-width window.

1. **Match popover is clipped by the side panels.** On the canvas, the match popover opens under the waiting-list panel, so the "Call to a free table" buttons and the score field are partly hidden (some table buttons can't be seen at all). The popover must render above every panel and stay fully inside the viewport, e.g. in a portal with collision-aware positioning.
2. **"Editing the draw" banner on a competition already in play.** With groups → bracket, once the groups are confirmed and being played, the canvas still shows the "Editing the draw / Re-draw / Confirm draw" banner at the top, because the bracket is drawn but not yet confirmed. It reads as if the groups were still editable. Tie the banner visibly to the stage it applies to (the bracket section), or show it only once that stage can be confirmed (all groups complete). It must never sit over a stage that's in play.
3. **"Fit" doesn't fit.** The Fit button and the F key keep the zoom at 60% or more, so a 16-player double elimination, or groups plus a bracket, doesn't fit on a laptop screen. Fit must show the whole competition, with readable zoom left to the operator's +/- controls.

## Acceptance criteria

- [ ] The match popover is fully visible and clickable next to every panel layout: tables panel open or collapsed, waiting list open, final places panel open, at 1280×800 and 1440×900.
- [ ] The draw-editing banner never covers a stage that's in play, and it's clear which stage it edits.
- [ ] Fit shows the whole canvas content for a 16-entry double elimination and for 4 groups → 8-entry bracket.
- [ ] Checked in the browser, with screenshots in the report.

## Blocked by

None (can start immediately)
