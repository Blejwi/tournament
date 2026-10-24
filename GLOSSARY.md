# Tournament manager

The language of running a one-day table tennis tournament: competitions on shared tables, their draws, and the matches the operator calls and scores.

## Language

### Event structure

**Tournament**:
One event (usually one day, one venue) that owns the tables, the players and the competitions played there.
_Avoid_: Event, cup

**Competition**:
A single title being contested within a tournament, such as "Men's Open" or "U15 Boys", with its own entries, format and final places.
_Avoid_: Category, event, division

**Stage**:
One phase of a competition with a single format (groups, single elimination, double elimination); the stages of a competition run in a chain, each fed by the one before.
_Avoid_: Phase, round

**Operator**:
The one person at the laptop who runs the tournament: sets up draws, calls matches to tables and enters scores.
_Avoid_: Manager, referee, admin, user

**Player**:
A person taking part in a tournament. They are registered through the competition they play in, and the same player can be entered in another competition without being registered again.
_Avoid_: Participant, competitor, contestant

**Entry**:
A player's place in one competition; an entry is a single player.
_Avoid_: Registration, participant

**Table**:
A physical playing table in the venue, identified by its number and an optional name.
_Avoid_: Field, court, pitch

### Draws

**Draw**:
The placement of a stage's entries into groups or bracket positions, produced at random from the seeds and then adjusted by hand before it is confirmed.
_Avoid_: Schedule, pairing, lottery

**Seed**:
An entry's explicit ranking number, which fixes where it is placed in the draw; entries without a seed are placed at random.
_Avoid_: Rank, position

**Seed positions**:
The fixed order in which seed numbers sit in a bracket, top to bottom (for 16: 1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2), so that seeds 1 and 2 can only meet in the final.
_Avoid_: Seeding chart

**BYE**:
An empty bracket position; the player drawn against it advances without playing. BYEs always take the highest seed numbers.
_Avoid_: Free pass, walkover

**Snake**:
Spreading entries across groups in the order A, B, C, D, then D, C, B, A, and so on, so that strong entries are distributed evenly.
_Avoid_: Serpentine

**Confirmed**:
The state of a stage whose draw is locked; from then on its matches can be played.
_Avoid_: Published, started, locked

### Groups

**Group**:
A small set of entries in a groups stage who all play each other once (round robin).
_Avoid_: Pool, league

**Standings**:
The order of entries in a group, by group points and then by tiebreak.
_Avoid_: Table, ranking, leaderboard

**Group points**:
What a match is worth in standings: 1 for a win, 0 for a loss or a walkover.
_Avoid_: Score, match points

**Tiebreak**:
Separating entries level on group points, using only the matches between the tied entries (points, then game ratio, then point ratio), with the operator deciding as the last resort.
_Avoid_: Head-to-head

**Advancer**:
An entry that goes on from a group to the next stage; in v1 these are the group winner and the runner-up.
_Avoid_: Qualifier

**Origin label**:
The short tag that records where an advancer came from, such as "1A" (winner of group A) or "2C" (runner-up of group C). It stays next to the player's name.
_Avoid_: Source, seed

**Carry-over**:
Reusing the result of a phase-1 group match when the same two entries meet again in a later groups stage, instead of playing it again.
_Avoid_: Transfer, inherited result

### Brackets

**Bracket**:
A knockout stage drawn as a tree of matches; always 8, 16, 32 or 64 positions, except a 4-entry knockout that follows groups.
_Avoid_: Draw, ladder, tree, knockout

**Winners bracket**:
The upper part of a double elimination bracket: entries that have not lost yet.
_Avoid_: Upper bracket, main bracket

**Losers bracket**:
The lower part of a double elimination bracket: entries with exactly one loss. A second loss eliminates them.
_Avoid_: Lower bracket, repechage, consolation

**Drop-in**:
An entry that has just lost in the winners bracket and enters the losers bracket. Drop-ins are crossed into the opposite half to avoid early rematches.
_Avoid_: Drop-down, transfer

**WB final**:
The last match of the winners bracket; its winner is the champion.
_Avoid_: Grand final, final

**2nd final**:
The match between the WB final loser and the losers-bracket winner; it decides 2nd and 3rd place.
_Avoid_: Grand final, bracket reset

**Place range**:
A set of final places shared by entries knocked out at the same point, such as 5–6 or 13–16.
_Avoid_: Tied place, bucket

**Place play-off**:
An optional round that splits a place range in two: its winners share the top half and its losers the bottom half (single places once two entries are left). Each half can have a place play-off of its own; the operator turns each one on or off per range.
_Avoid_: Classification, consolation bracket, plate

**Slot**:
One of the two sides of a match. It is filled by a player, an origin label, a BYE, or the winner or loser of an earlier match.
_Avoid_: Seat, side, position

### Matches & play

**Match**:
One contest between two entries, played to a set number of games.
_Avoid_: Game, fixture, bout

**Game**:
One part of a match, played to 11 points with a 2-point lead.
_Avoid_: Set

**Games to win**:
How many games decide a match in a competition: 2, 3 or 4.
_Avoid_: Best of, sets

**Waiting list**:
The prioritised list of matches that could be called to a table now.
_Avoid_: Queue, schedule, order of play

**Ready**:
A match whose two players are both known and not currently playing elsewhere.
_Avoid_: Available, playable

**Busy**:
A match whose players are known but at least one of them is playing on another table.
_Avoid_: Blocked, conflict

**Pending**:
A match where at least one slot is still waiting for an earlier result.
_Avoid_: Scheduled, waiting

**Call**:
Assigning a ready match to a free table; the match clock starts at that moment.
_Avoid_: Start, dispatch

**Overdue**:
A match still in play after its expected duration: amber past 100% of the expected duration, red past 150%. It usually means the players forgot to report the score.
_Avoid_: Late, stuck

**Idle**:
An active table with no match on it; how long it has been idle is shown.
_Avoid_: Empty, unused

**Expected duration**:
How long a match is expected to take, set for each "games to win" value.
_Avoid_: Time limit, estimate

### Results

**Result**:
The recorded outcome of a match: game scores, games only, or a special result.
_Avoid_: Score

**Walkover**:
A match won without playing because the opponent did not play.
_Avoid_: Forfeit, default

**Retirement**:
A match ended part-way through because a player stopped; the games played so far are kept.
_Avoid_: Abandonment

**Withdrawal**:
A player leaving a competition part-way through; their remaining matches become walkovers.
_Avoid_: Dropout, scratch

**Correction**:
Changing a result after it was recorded. If later matches already used the wrong player, they are reset.
_Avoid_: Edit, undo, amendment

## Relationships

- A **Tournament** has many **Tables**, **Players** and **Competitions**; all its competitions share its tables.
- A **Player** has at most one **Entry** in each **Competition**.
- A **Competition** has an ordered chain of **Stages**. A later stage is filled by the **Advancers** of the stage before it.
- A **Stage** is either **Groups** or a **Bracket**. A bracket stage can have **Place play-offs**.
- A **Match** has two **Slots** and at most one **Result**. While it is being played, it sits on one **Table**.
- A **Match**'s **Slots** fill as earlier matches finish. A **Correction** re-fills them.

## Example dialogue

> **Dev:** "When the U15 WB final finishes, does the winner play again?"
> **Operator:** "No, the WB final winner is champion. The loser goes into the **2nd final** against the losers-bracket winner, and that decides 2nd and 3rd."
> **Dev:** "And the four players knocked out in the first losers round?"
> **Operator:** "They share the **place range** 13–16, unless I turn on the 13–16 **place play-off**."
> **Dev:** "If I fix a typo in a result after the next match was already **called**?"
> **Operator:** "That's a **correction**. It resets whatever already used the wrong player, so it has to warn me first."

## Flagged ambiguities

- "Set" was used for **Game**. Table tennis matches are made of games; "set" is avoided.
- "Grand final" was used for both the **WB final** and the **2nd final**. In this format there is no grand final: the WB final winner is champion.
- "Manager" and "operator" were both used for the person running the event. **Operator** is the term.
- "Phase" and "stage" were both used. **Stage** is the term; "phase 1/phase 2" only appears informally when describing groups → groups.
- "Field" was used for **Table**, from other sports. The app only says **Table**.
