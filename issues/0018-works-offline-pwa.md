---
id: 18
title: Works offline (PWA)
status: done
labels: [ready-for-agent]
created: 2026-10-22
---

# 0018: Works offline (PWA)

## Parent

#0001

## What to build

The app becomes an installable PWA: once loaded, it keeps working with no network, because halls often have bad Wi-Fi.

## Acceptance criteria

- [ ] A service worker caches the app shell and assets, and the app reloads and works offline.
- [ ] It can be installed from the browser.
- [ ] A new deployed version is picked up without losing local data.

## Blocked by

- #0002

## Resolution

Done on `integration/v1` in ef8ce41: vite-plugin-pwa with a Workbox service worker, an SPA fallback, an update prompt that waits for the operator, and generated icons. Deployment notes are in docs/deployment.md. Offline loading, installability and updates without data loss were checked in headless Chrome, because the built-in browser pane can't register service workers.
