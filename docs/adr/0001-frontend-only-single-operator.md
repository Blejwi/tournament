# Frontend-only app for a single operator, stored in the browser

The app is a static single-page app with no backend. One operator on one laptop is the only source of truth. Each tournament lives in the browser's local storage, with JSON export/import and periodic backup reminders as the safety net.

We chose this because tournaments run in halls with unreliable Wi-Fi, and in practice one person at the desk enters every result. A server would add hosting and sign-in for no benefit at that scale.

## Considered Options

- **Backend with sync**, so that several referees could enter scores and players could look up results on their phones. Rejected for v1 because of the extra infrastructure and offline problems. It's the main thing to revisit if multi-device use is ever needed.

## Consequences

- Losing browser data loses the event unless the operator has exported it, hence the backup reminder.
- A projector or TV view has to be a second window on the same machine.
- Keep the storage behind a small interface, so that adding sync later only replaces that adapter.
