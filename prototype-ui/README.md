# UI prototype (throwaway)

**Question:** what should the live operator screen look like?

**Verdict (2026-10-22):** **Variant A — Infinite canvas** wins. The user judged it clearest for operators.
- Pan/zoom canvas per competition (competition tabs), all stages laid out left → right with bracket connector lines.
- Left panel: tables (status, live timer, idle time; collapsed badges for late/idle). Right panel: waiting list (merged / per competition, busy at the bottom). Bottom drawer: stats + change log.
- Match card click → popover (assign table, keyboard score entry, walkover, start time, take off table, enable play-off).

Variants B (control room) and C (flow board + timeline) were rejected; ideas worth stealing later: B's keyboard command bar, C's per-table timeline for spotting idle gaps.

Run: `powershell -ExecutionPolicy Bypass -File prototype-ui/serve.ps1` → http://localhost:5174/?variant=A

Prototype code — do not promote to production; rewrite properly in the real app.
