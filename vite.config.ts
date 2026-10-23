/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Sub-path the app is served from (docs/deployment.md). GitHub Pages serves a project repo at
  // /<repo>/, so the deploy workflow sets BASE_PATH; everywhere else the app sits at the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    // Offline support (docs/deployment.md): precaches the app shell and assets, and waits for the
    // operator to accept an update (UpdatePrompt) instead of reloading mid-tournament.
    VitePWA({
      registerType: 'prompt',
      // Icons, favicon and apple-touch links are generated from public/icon.svg at build time.
      pwaAssets: { image: 'public/icon.svg', preset: 'minimal-2023' },
      manifest: {
        name: 'Tournament manager',
        short_name: 'Tournaments',
        description: 'Run table tennis tournaments from one laptop, online or offline.',
        theme_color: '#18181b',
        background_color: '#ffffff',
        display: 'standalone',
      },
      workbox: {
        // The manifest and generated icons are added by the plugin itself.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Client-side routes (e.g. /tournaments/:id/tables) load index.html from the cache offline.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
