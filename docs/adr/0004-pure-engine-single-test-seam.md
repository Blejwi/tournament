# All tournament rules live in a pure engine, tested only through its interface

Every tournament rule lives in one pure TypeScript engine with a command/query interface: draws, standings and tiebreaks, advancement, the waiting list, overdue detection, corrections and import/export. The engine has no React, no storage and no clock. Randomness comes in as a seed on draw commands, and time comes in as an argument (`at`/`now`).

Tests use only this interface: set up with commands, then check query results. UI components and the storage adapter stay thin and aren't unit-tested.

We chose this because the rules are intricate and drawn from paper sheets (seed positions, group separation, double elimination drop-ins, ITTF tiebreaks), so they must be verifiable in isolation. Passing in time and randomness makes draws and overdue checks reproducible without mocks. A single test seam also lets the internals (stage handlers per format) be refactored freely.
