---
id: 15
title: Corrections
status: done
labels: [ready-for-agent]
created: 2026-10-22
---

# 0015: Corrections

## Parent

#0001

## What to build

A **correction** changes a recorded result:

- **Automatic case:** if no match after it has started, the advancing player is swapped automatically, because slots point to their source (ADR 0003).
- **Forced case:** if later matches already started or finished with a now-wrong player, the engine lists them first. After the operator confirms, the correction is forced and those matches are reset.
- **Timing:** a correction keeps the match's original timing.

The operator can also edit a match's start time ("started N min ago") and take a match off its table.

## Acceptance criteria

- [ ] A correction with no started match after it re-resolves the following slots and needs no force.
- [ ] A correction with a started or finished match after it is rejected without force. The reset preview lists exactly the affected matches, and force resets them. The same holds in groups → bracket, where a correction can change group standings.
- [ ] Original start and finish times are kept.
- [ ] Editing the start time and taking a match off its table work; the table frees.
- [ ] The UI shows a confirmation dialog listing the matches that will be reset.

## Blocked by

- #0007

## Resolution

Done on `integration/v1` in d84cd67 (engine: `correctResult` with a downstream reset preview and force, plus `setMatchStart`), 9574b95 (UI: correcting a result with a dialog that lists the matches to reset, and editing the start time) and 093a039 (the `resultCorrected` change-log entry). Original timings are kept. `setMatchStart` is not logged. The UI flow was verified through tests, not checked again in the browser.
