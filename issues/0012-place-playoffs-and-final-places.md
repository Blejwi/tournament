---
id: 12
title: Place play-offs and final places
status: in-progress
labels: [ready-for-agent]
created: 2026-10-22
---

# 0012: Place play-offs and final places

## Parent

#0001

## What to build

Optional **place play-offs** that split a shared **place range** into single places, for both double elimination and single elimination:

- **Ranges:** in double elimination, 5–6, 7–8, 9–12, 13–16 and further ranges in bigger draws. In single elimination, e.g. quarter-final losers play for 5–8.
- **Switching on:** the **operator** can turn each play-off on or off at any time.
- **When playable:** a play-off match becomes playable as soon as both its players are known.
- **Pairing:** by neighbouring matches. In 9–12 for 16 entries, the loser of the 1st LR2 match plays the loser of the 2nd, and the 3rd plays the 4th. The winners then play for 9/10 and the losers for 11/12.
- **Unplayed play-offs** leave the places shared.
- **Waiting list:** play-off matches sort after main-draw matches.
- **Final places:** a view per competition.

## Acceptance criteria

- [ ] Play-off structure and pairing are tested for each range in 16-entry double elimination and in 8-entry single elimination.
- [ ] Turning a play-off on makes its matches appear: pending or ready as their players become known. Turning it off shows them as disabled. Turning it back on keeps any finished results.
- [ ] Final places: every place in a played range is decided; a range left unplayed stays shared.
- [ ] In the waiting list, play-off matches come after main-draw matches.
- [ ] On the canvas, play-off mini-brackets have enable toggles, and disabled ones are faint.

## Blocked by

- #0010
