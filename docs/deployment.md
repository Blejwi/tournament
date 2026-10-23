# Deployment and offline support

The app is a static single-page app (ADR 0001). `npm run build` writes everything to `dist/`; upload that folder to any static host.

## Offline (PWA)

`vite-plugin-pwa` (configured in `vite.config.ts`) generates a Workbox service worker (`dist/sw.js`) and a web app manifest at build time.

- **App shell precache.** Every built JS, CSS, HTML, icon and the manifest is precached on the first visit. After that, the app loads and works with no network. Tournaments are in localStorage, so the app needs no network at all once loaded.
- **Client-side routes offline.** Navigations to any path (e.g. `/tournaments/<id>/tables`) are answered with the cached `index.html` (`navigateFallback`), and the router takes over from there.
- **Installable.** The manifest, the 192/512 px and maskable icons, the favicon and the apple-touch icon are generated from `public/icon.svg` (`pwaAssets`). To change the icon, edit that SVG.
- **Updates.** `registerType: 'prompt'`: a newly deployed version installs in the background and waits. `UpdatePrompt` (`src/ui/components/UpdatePrompt.tsx`) asks the operator to update; the new version only takes over (with a reload) when they accept, so the page never reloads mid-entry. Local data is not touched: tournaments live in localStorage, which a service-worker update does not clear, and the store autosaves after each command. While the app is open it checks for a new version every hour when online, as well as on every page load.
- **Old caches** from previous versions are removed when the new service worker activates (`cleanupOutdatedCaches`).

The service worker is only built for production. `npm run dev` has none; use `npm run build && npm run preview` to try offline behaviour (DevTools > Application > Service workers, then tick "Offline" or stop the preview server and reload).

Service workers need HTTPS (or `localhost`). Every static host below serves HTTPS.

### Hosting requirements

- Serve `sw.js` with `Cache-Control: no-cache` (or a short max-age) so browsers notice new versions quickly. Files in `assets/` have hashed names and can be cached for a long time.
- Sub-path hosting: build with `BASE_PATH=/<path>/ npm run build`. That sets Vite's `base`, and from it the router's `basename` and the PWA's scope and start URL. Without it, the app is built for the domain root. On Windows Git Bash, prefix the command with `MSYS_NO_PATHCONV=1` so that `/<path>/` isn't rewritten into a Windows path.

## GitHub Pages (the live deployment)

`.github/workflows/deploy-pages.yml` builds and publishes on every push to `main`, or when run manually from the Actions tab. It runs the tests, builds with `BASE_PATH=/<repo>/`, copies `index.html` to `404.html` for deep links, and deploys to `https://<owner>.github.io/<repo>/`.

One-time setup: in the repository's Settings > Pages, set Source to "GitHub Actions". Pages on a free account needs a public repository.

Tournament data is never part of a deployment: it lives in each browser's localStorage for that site's origin. Move tournaments between machines with Export/Import.

## SPA fallback (deep links and reload)

The router uses browser history URLs such as `/tournaments/<id>/players`. Once the service worker is installed it serves these offline. But on the very first visit, or in a browser without the service worker, the host must answer any unknown path with `index.html` (status 200), or a reload on a deep link gives a 404.

- **Netlify, Cloudflare Pages:** handled by `public/_redirects` (`/* /index.html 200`), which is copied into `dist/`. Real files are still served first.
- **Vercel:** add `vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
- **GitHub Pages:** has no rewrites. Copy `dist/index.html` to `dist/404.html` after building. The page then loads, but with a 404 status.
- **nginx:** `location / { try_files $uri $uri/ /index.html; }`.
- **Firebase Hosting:** `"rewrites": [{ "source": "**", "destination": "/index.html" }]` in `firebase.json`.
- `npm run preview` (Vite) already falls back to `index.html`.
