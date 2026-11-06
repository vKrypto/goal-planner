# Target Planner

A mobile-first React + TypeScript PWA for personal targets and intentional purchases. No account or backend; plans stay in localStorage on the current browser/device.


<iframe src="https://vkrypto.github.io/goal-planner/" />
## Run

```sh
npm install
npm run dev
```

## Verify and build

```sh
npm test
npm run build
npm run preview
# In another terminal (requires Google Chrome):
npm run test:smoke
```

Deploy the generated `dist/` directory on a static host with HTTPS. The build generates a versioned offline shell cache. PWA/offline behavior is available in the production preview or HTTPS deployment, not the development server. PNG installation icons and the manifest are included. New app versions wait for an explicit update action.

## Features

- Targets with dates, descriptions, notes, compressed photos, and in-app reminders.
- Purchases with exact or range unit prices, quantity totals, product links, and optional dates.
- Edit, complete/reopen, confirm-delete, search, status filters, and date/price sorting.
- INR, USD, EUR, GBP or JPY; currency locks while purchases exist to protect stored amounts.
- Versioned JSON backup/restore with validation and explicit replacement confirmation.
- Responsive layout, keyboard-accessible dialogs, offline app shell, installation guidance.

Reminders appear when the app is open; closed-app notifications are not supported. Photos are resized and capped; the app reserves a conservative 3.5 MB localStorage budget. Browser storage can still be cleared or evicted, so export backups regularly. Data does not sync between devices. Corrupt/unavailable storage or changes from another tab pause saving to prevent accidental overwrites. Notes render as plain text and product links allow HTTP(S) only. No external fonts, analytics, or network services are required.

## Structure

- `src/main.tsx`: app shell, forms, item views, settings and PWA lifecycle.
- `src/model.ts`: types, repository, validation, calendar dates, money, image compression.
- `src/styles.css`: responsive design and accessible states.
- `public/`: installation assets and service-worker source.
- `scripts/finalize-pwa.mjs`: content-versioned shell precache generation.
- `tests/`: domain and browser smoke tests.

The smoke test uses an installed Google Chrome by default. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another Chromium executable, or `TARGET_PLANNER_URL` to test a different preview URL.

See `PLAN.md` for product decisions and intended scope.

## GitHub Pages

The `Build and deploy GitHub Pages` workflow tests and builds pull requests. Pushes to `main` (or a manual workflow run on `main`) also publish `dist/` through GitHub Pages. Set the repository's **Settings → Pages → Source** to **GitHub Actions**.

The app uses relative asset URLs, so the manifest, service worker, icons, and built assets work under `/goal-planner/` without a domain-specific build.

Expected site URL: https://vkrypto.github.io/goal-planner/

## Parent repository

This app is an independent repository at `https://github.com/vKrypto/goal-planner.git`, registered under the parent repository's `planner/` path as a submodule. Clone the parent with `git clone --recurse-submodules`, or initialize an existing clone with `git submodule update --init planner`.

After changing this app, commit and push here first, then commit the updated `planner` submodule reference in the parent repository.
