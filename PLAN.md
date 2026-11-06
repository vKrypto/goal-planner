# Target Planner — implementation plan

**Tagline:** Plan your target, we will push you to achieve it.

## 1. Product direction

Build a small, mobile-first React PWA for tracking personal targets and planned purchases. Users should be able to capture an item quickly, see what is approaching, and mark progress without navigating through a complex dashboard.

The first version requires no account, backend, or cloud database. Data stays in the current browser. Installation and offline access are part of the intended experience.

## 2. First-version scope

### Date-based targets

- Required: title and target date.
- Optional: description, notes, one photo, and reminder preference.
- Actions: create, view, edit, complete, reopen, and delete.
- Show days remaining, due today, or overdue using the user's local calendar date.
- Completed targets remain available in a separate filter.

### Planned purchases

- Required: name and either an estimated unit price or a minimum/maximum price range.
- Optional: product link, notes, one photo, and intended purchase date.
- Quantity defaults to 1 and must be a positive integer.
- Actions: create, view, edit, mark purchased, reopen, and delete.
- Show estimated total as unit price × quantity, or a total range when a range is supplied.
- Use one user-selected currency for the app; do not combine multiple currencies in totals.

### Shared behavior

- Search by title/name and filter by active or completed status.
- Sort by upcoming date, newest, or purchase price where applicable; undated purchases appear after dated items in date sorting.
- Show useful empty states with a direct add action.
- Confirm deletion or provide an undo action.
- Export and import a versioned JSON backup, including photos.
- Explain that clearing browser data removes plans and that data does not automatically sync across browsers or devices.

## 3. Interface

Use two primary tabs: **Targets** and **Purchases**. Each has a compact list of cards and a prominent **Add** action. Avoid charts, sidebars, and a separate dashboard in the first version.

Each target card shows title, target date, countdown, and completion control. Each purchase card shows name, estimated total, quantity, and optional purchase date. Photos are small thumbnails rather than the focus of the list.

The add/edit form opens as a mobile sheet or full-screen panel, and as a dialog on larger screens. Show required fields first; group notes, photo, link, and reminder under optional details. Selecting the current tab preselects the item type.

Keep settings small: currency, backup/restore, storage information, and install guidance. Use accessible labels, visible keyboard focus, sufficient contrast, and touch-friendly controls. Status must be understandable without color.

## 4. Technical approach

Proposed stack: React, TypeScript, Vite, and a PWA service-worker integration. Use plain CSS with a small set of design tokens. Keep state in React with a dedicated persistence layer; a global state library is unnecessary initially.

Suggested source structure:

```text
src/
  app/          app shell, tabs, settings
  components/   shared inputs, cards, dialogs, empty states
  features/
    targets/    target list, form, detail view
    purchases/  purchase list, form, detail view
  storage/      repository, schema migrations, import/export
  utils/        calendar dates, money, validation, images
  styles/       tokens and responsive styles
```

Persist a versioned JSON document in localStorage. Route all reads and writes through a repository so storage can be migrated later without rewriting the interface. Handle invalid data, quota failures, and unavailable storage with a visible recovery message; never silently replace a failed load with empty data and overwrite it.

Photos need a strict size policy because localStorage has limited capacity. Resize and compress uploads before saving, allow one photo per item, reject files exceeding the final size cap, and show a storage warning before capacity is exhausted. If realistic photo usage cannot fit this constraint, propose IndexedDB as a follow-up storage change.

Cache the application shell for offline use. External product pages still require connectivity. Provide an update notice when a new app version is ready, without interrupting an unsaved form.

## 5. Data model

Common fields: `id`, `type`, `status`, `notes`, optional compressed `photo`, `createdAt`, and `updatedAt`.

Target fields: `title`, optional `description`, `targetDate`, optional reminder configuration, and optional `completedAt`.

Purchase fields: `name`, optional `link`, `pricingMode` (`exact` or `range`), the corresponding unit price or minimum/maximum, `quantity`, optional `purchaseDate`, and optional `purchasedAt`.

Store calendar dates as `YYYY-MM-DD`, separate from timestamps. Store money as integer minor units using the selected currency's precision. Validate nonnegative amounts and `minimum <= maximum`. Accept only HTTP/HTTPS product links and render notes as text.

The persisted root includes `schemaVersion`, settings, and items. Import must validate the entire document before changing existing data; preview the item count and explicitly confirm replacement. Preserve the current data if import fails.

## 6. Reminders and motivation

The first version provides in-app reminders: overdue, due today, and approaching targets, with a default approaching window of seven days. A reminder is cleared when an item is completed.

Do not promise scheduled notifications while the PWA is closed. Treat browser notifications as a separate enhancement requiring a supported delivery approach and a browser/device compatibility check. Ask for notification permission only after a user explicitly enables that feature.

Start motivation with clear countdowns and supportive completion feedback. Defer streaks, badges, AI coaching, recurring targets, and complex progress tracking.

## 7. Build sequence and acceptance checks

1. **Foundation:** create the React/TypeScript app, responsive shell, shared form controls, data types, and storage repository. Acceptance: the shell works on mobile and desktop; saved sample data survives a reload; storage errors are visible.
2. **Targets:** implement create/edit/detail/delete, completion/reopening, local-date countdowns, and sorting. Acceptance: complete a target's full lifecycle, including today, overdue, and month/year boundaries.
3. **Purchases:** implement exact/range pricing, quantity, safe links, optional dates, and purchased status. Acceptance: quantity and range totals are correct; invalid prices and links are rejected.
4. **Organization and backup:** add search, filters, optional compressed photos, currency settings, export, and validated import. Acceptance: backup/restore preserves all fields and photos; malformed imports and full storage preserve existing data.
5. **PWA and polish:** add manifest/icons, offline caching, install guidance, update handling, in-app reminders, and accessibility refinements. Acceptance: the installed app opens offline after its first successful load and retains plans after restart.

Use focused automated tests for date arithmetic, money calculations, schema validation/migrations, and import failure handling. Add an end-to-end smoke test covering creation, reload persistence, editing, completion, and backup restoration. Manually verify keyboard use, small screens, offline behavior, and installation on intended target browsers before release.

## 8. Decisions assumed for this plan

- “Range” means an alternative minimum/maximum unit price, not a budget or product category.
- Targets require a date; purchases may be undated.
- Each item supports one optional photo.
- Plans stay on one browser/device, with manual backup and restore.
- Reminders initially mean in-app reminders, without guaranteed background delivery.

## 9. Deferred work

Cloud sync, authentication, shared plans, price scraping, payment or checkout, recurring reminders, multiple currencies, subtasks, and calendar integration are outside the first version.
