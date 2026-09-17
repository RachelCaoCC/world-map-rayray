# Global Social Media Dashboard

Interactive analytics dashboard (React + TypeScript + Vite) showing per-country
social media follower data on a world map, with country dashboards and a
full-screen presentation "follower counter" mode.

## Prerequisites

- Node.js >= 18 (Vite 8 requires a modern Node)
- npm (or pnpm/yarn matching `package-lock.json`)

## Getting started

1. Install dependencies: `npm install`
2. Run dev server: `npm run dev` (Vite, default `http://localhost:5173`)
3. Production build: `npm run build` (`tsc -b && vite build`)
4. Preview build: `npm run preview`
5. Lint: `npm run lint` (oxlint)

## Overview

- **Home** (`/`) — world map with country markers, sidebar country list, and aggregated global stats.
- **Country Dashboard** (`/country/:id`) — summary cards, per-platform cards, trend graphs, and a comparison table.
- **Presentation Mode** (`/country/:id/present`) — full-screen auto-cycling follower counter (mechanical odometer, auto + manual rotation).
- **Connections** (`/admin/platforms`) — admin screen for linking social accounts per country.

Hovering/selecting a country opens a detail card. Taiwan is shown as part of China on the map (no separate entity).

## Notes

- Map geometry is fetched from the jsDelivr CDN (`world-atlas`) at runtime → requires internet.
- Flag icons come from the `flag-icons` npm package (no CDN).
- All data is mocked (`src/data/mockData.ts`); no backend or environment variables are required.
- State is managed with Zustand (`src/store/useStore.ts`); live updates are simulated via polling.
