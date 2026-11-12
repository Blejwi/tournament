---
id: 25
title: Play screen usable on a phone
status: done
labels: [ready-for-agent]
created: 2026-11-12
---

# 0025: Play screen usable on a phone

## Parent

#0001

## What to build

The operator can run the tournament from a phone (portrait, ~375px wide) instead of the laptop. Still one operator on one device (ADR 0001); this is layout only, no sync.

Today the play screen puts the tables panel (288px), the waiting list (320px) and the final places panel (256px) beside the canvas, so on a phone the canvas is pushed off-screen and the page scrolls sideways. The canvas only zooms with the wheel, buttons or keys.

Below the `md` breakpoint (768px):

1. **Panels become sheets.** The canvas takes the full width. A bar at the bottom opens Tables, the waiting list and Final places, each as a sheet over the canvas with a close button. Picking a match in a sheet closes it and shows the match on the canvas.
2. **Match popover becomes a bottom sheet** across the full width, so the score field and table buttons are reachable.
3. **Pinch to zoom** on the canvas (two fingers zoom around their midpoint and pan), on every screen size.
4. **Compact header:** the tournament header, competition tabs and stats bar fit without sideways page scroll (tabs scroll on their own, secondary stats are hidden, the open stats drawer stacks its columns).

Laptop layout stays as it is.

## Acceptance criteria

- [x] At 375×812 no screen of a tournament scrolls the page sideways.
- [x] On the play screen at 375×812 the canvas fills the width; tables, waiting list and final places open as sheets and close again.
- [x] Picking a match from the waiting list or a table on a phone closes the sheet and opens the match as a bottom sheet with the score field visible.
- [ ] Two-finger pinch zooms the canvas. (Implemented; not yet tried on a real touchscreen, the browser preview cannot emulate two fingers.)
- [x] At 1280×800 the play screen looks as before.
- [x] `npm test`, `npm run lint`, `npm run build` pass. (`npm run lint` also reports 3 errors from the untracked `.vite/deps` cache, not from `src`.)

## Blocked by

None (can start immediately)

## Resolution

Done in a3213b0. `useIsPhone()` / `useIsTouch()` (`src/ui/useMediaQuery.ts`) drive the phone layout. Below `md` the play screen hides the side panels and shows `PanelBar` at the bottom; the tables, waiting list and final places panels take an `onClose` prop that renders them as a full-width sheet over the canvas. Picking a match closes the sheet. The match popover is a bottom sheet on a phone, and `Canvas` takes `popoverRoom: 'below'` so revealing a card keeps it in the top part. `Canvas` pinch-zooms with two touch pointers around their midpoint; touch screens get their own hints (`play.touchHint`, `drawEdit.canvasTouchHint`), hidden after the first touch. The header, competition tabs, stats bar and competition screen fit 375px without sideways scroll. Checked in the browser at 375×812 (sheets, popover, every tournament screen) and 1280×800 (unchanged). Pinch is not yet tried on a real touchscreen. "Fit" on a phone still stops at 60% zoom; that is #0022.
