# Tournament manager

A frontend-only tournament manager for one operator at one laptop, built for table tennis first. It supports groups, single elimination and double elimination (chained, e.g. groups → bracket), place play-offs, table assignment with overdue and idle alerts, and live score entry. Data stays in the browser, with JSON export/import, and the app works offline as a PWA. UI in English and Polish.

**Live:** https://blejwi.github.io/tournament/

- Spec and tickets: [`issues/`](issues/) (board: [`issues/BOARD.md`](issues/BOARD.md))
- Domain vocabulary: [`GLOSSARY.md`](GLOSSARY.md); decisions: [`docs/adr/`](docs/adr/)
- Deployment and offline behaviour: [`docs/deployment.md`](docs/deployment.md)

```bash
npm install
npm run dev
```

`npm test`, `npm run build` and `npm run lint` must stay green. Every push to `main` deploys to GitHub Pages.
