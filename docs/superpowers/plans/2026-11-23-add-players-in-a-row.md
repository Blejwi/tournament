# Add New Players One After Another Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In add mode, the "Add player" dialog stays open after each successful add, clears its fields, refocuses First name, names the competition in its title and confirms each add.

**Architecture:** A UI-only change to `PlayerDialog` plus i18n keys. The engine is untouched (one `registerPlayer` per add). Edit mode keeps its current behaviour.

**Tech Stack:** React, i18next, shadcn/ui Dialog, Vite.

**Spec:** `issues/0031-add-players-in-a-row.md`

## Global Constraints

- No hard-coded UI text: every string goes in `src/i18n/en.ts` and then `src/i18n/pl.ts`.
- Plurals use i18next suffixes: `_one`/`_other` in EN, `_one`/`_few`/`_many` in PL.
- Keep `npm test`, `npm run build` and `npm run lint` green.
- The project has no UI tests; tests live only in `src/engine/__tests__/`. Verify in the browser.

## Review Focus

1. A failed add (empty last name): the typed values stay, the error shows, and the confirmation line and count don't change.
2. A successful add after a failed one: the error clears.
3. Edit mode: the title is "Edit player", the button says "Cancel", and Save closes the dialog.
4. Pressing Enter in any field (including Rating or Birth year) submits and returns focus to First name.
5. The Entries list behind the dialog shows each new player as soon as they're added.

---

### Task 1: Keep the add dialog open, with the competition in the title

**Files:**
- Modify: `src/ui/components/PlayerDialog.tsx`
- Modify: `src/ui/screens/CompetitionScreen.tsx:138` (pass the competition view)
- Modify: `src/i18n/en.ts`, `src/i18n/pl.ts` (`players` section)

**Interfaces:**
- `PlayerDialog({ competition, player, onClose }: { competition: CompetitionView; player: PlayerView | null; onClose: () => void })`. `competition` changes from an id to the `CompetitionView`. Use `competition.id` in `registerPlayer` and `competition.name` in the title.

- [ ] **Step 1: Add i18n keys**

EN (`players`):
```ts
addTo: 'Add player to {{competition}}',
added_one: '✓ {{name}} added ({{count}} added so far)',
added_other: '✓ {{name}} added ({{count}} added so far)',
```
PL:
```ts
addTo: 'Dodaj zawodnika do: {{competition}}',
added_one: '✓ Dodano: {{name}} (łącznie {{count}})',
added_few: '✓ Dodano: {{name}} (łącznie {{count}})',
added_many: '✓ Dodano: {{name}} (łącznie {{count}})',
```
"Done": reuse `common.done` if it exists; otherwise add `common.done` ('Done' / 'Gotowe').

- [ ] **Step 2: Change `PlayerDialog`**

- Title: `player ? t('players.edit') : t('players.addTo', { competition: competition.name })`.
- Add state `added: { name: string; count: number } | null`.
- On a successful add: reset all five fields to `''`, clear `error`, set `added` (name via `playerName`-style "First Last" from the submitted, trimmed values), and focus First name (a `ref` passed through `FormField`, which already spreads its props onto `Input`).
- On failure: keep the fields and `added` as they are, and set `error`.
- Show `added` above the fields as `<p role="status" className="text-sm text-muted-foreground">`.
- Secondary button: `common.done` in add mode, `common.cancel` in edit mode.
- Edit mode: no change.

- [ ] **Step 3: Pass the competition view** in `CompetitionScreen.tsx:138`: `competition={competition}`.

- [ ] **Step 4: Checks**

Run `npm run lint`, `npm test` and `npm run build`. All must pass.

- [ ] **Step 5: Browser check** (`npm run dev`)

Open a competition and click "Add player". Check that the title names the competition. Add three players using only the keyboard (type, Tab, Enter): after each one, focus is back on First name, the count reads 1, 2, 3, and the entries list grows. Try an empty last name: the error shows and the fields are kept. Edit a player: the title is "Edit player" and Save closes the dialog. Switch to PL and check the title and confirmation line.

- [ ] **Step 6: Commit and close the ticket**

Set `status: done` in `issues/0031-add-players-in-a-row.md`, add `## Resolution`, and move the row to Done on `issues/BOARD.md`.
```bash
git add src/ui/components/PlayerDialog.tsx src/ui/screens/CompetitionScreen.tsx src/i18n/en.ts src/i18n/pl.ts issues/0031-add-players-in-a-row.md issues/BOARD.md docs/superpowers/plans/2026-11-23-add-players-in-a-row.md
git commit -m "Keep the add-player dialog open for the next player (#0031)"
```
