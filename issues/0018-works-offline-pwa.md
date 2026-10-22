---
id: 18
title: Works offline (PWA)
status: open
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
