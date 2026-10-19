# Asset Management System — Work Plan

Oct 12, 2026 · @Babek Cafarov

## Goal and scope

Replace Snipe-IT with a simple, compact internal system tailored to the company's needs. The system must provide sign-in with a Microsoft account, automatic device synchronization from Intune, and keep the existing QR labels working.

**In the MVP:**

- SSO with Microsoft Entra ID and roles based on Entra groups
- Assets: create, edit, list, search, filter
- Checkout / checkin and full history for every asset
- Intune synchronization (automatic and manually triggered)
- Migration from Snipe-IT and support for legacy QR codes
- New QR generation, label printing and camera scanning
- CSV export

**Not in the MVP (later):** licenses, accessories, consumables, components, audit scheduling, maintenance records, mobile app (React Native).

## Technology stack

The whole project is written in TypeScript as a single Next.js application: frontend and API in one place, everything on Azure.

| Area           | Choice                                            | Reason                                                            |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript                 | Existing React knowledge applies directly, no separate API server |
| UI             | Tailwind CSS + shadcn/ui                          | Fast, clean, fully controlled components                          |
| Tables         | TanStack Table                                    | Sorting, filtering, pagination out of the box                     |
| Forms          | React Hook Form + Zod                             | Same schema validates both the form and the API                   |
| Database       | PostgreSQL                                        | Ideal for relational data, managed service available on Azure     |
| ORM            | Prisma                                            | Typed queries, migrations                                         |
| Auth           | Auth.js + Microsoft Entra ID provider             | SSO and group-based roles                                         |
| Intune         | Microsoft Graph API (client credentials)          | Background sync without a signed-in user                          |
| QR             | `qrcode` (generate), `html5-qrcode` (scan)        | Lightweight and runs in the browser                               |
| Repo and CI/CD | GitHub + GitHub Actions                           | Simple setup, direct deploy to Azure                              |
| Hosting        | Azure App Service + Azure Database for PostgreSQL | Same ecosystem as Entra                                           |
| Secrets        | Azure Key Vault                                   | Client secrets are not stored in code                             |
| Local env      | Docker (PostgreSQL)                               | Same environment for the whole team                               |

## Architecture and key decisions

All logic runs in one Next.js application; the only external pieces are Entra ID, Graph, PostgreSQL, Key Vault and, for migration, Snipe-IT.

[embedded content: System architecture · 1 application, 5 external services]

The sync job and the migration script write their results directly to PostgreSQL.

- **SSO:** Auth.js + Entra ID provider. Roles are read from the `groups` claim in the token; a user is created automatically on first login.
- **Roles:** ADMIN manages everything, including lookup tables and sync; EDITOR creates and edits assets and does checkout/checkin; VIEWER can only view.
- **Intune sync:** Graph with client credentials. Matching by normalized serial; a device removed from Intune is flagged `missingInIntune`, not deleted.
- **Field ownership:** device name, OS and last sync date belong to Intune and are read-only in the UI; company, location, cost and notes are managed manually.
- **Legacy QR:** the `/hardware/[id]` route finds the asset by `legacySnipeId` and redirects to the new page; the old domain is kept or redirected.
- **New QR:** `/a/[assetTag]` — a system-independent, immutable format.

## Database model

The database has 9 tables; at the center are `Asset` and `AssetEvent`, which stores its history.

| Table         | Purpose                             | Key fields                                                                                                                                                                                                                        |
| ------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Asset`       | Each physical device                | assetTag (unique), serial (unique), name, notes, purchaseCost, purchaseDate, source (MANUAL / INTUNE / SNIPEIT), intuneId, legacySnipeId, lastIntuneSync, missingInIntune, statusId, modelId, companyId, locationId, assignedToId |
| `AssetModel`  | Model (HP ProBook 450 G7, etc.)     | name, manufacturer, categoryId                                                                                                                                                                                                    |
| `Category`    | Category (Personal Computers, etc.) | name                                                                                                                                                                                                                              |
| `Company`     | Company (DRL, eiLink, EIG)          | name                                                                                                                                                                                                                              |
| `Location`    | Office / room                       | name                                                                                                                                                                                                                              |
| `StatusLabel` | Status                              | name, type (DEPLOYABLE / PENDING / UNDEPLOYABLE / ARCHIVED), color                                                                                                                                                                |
| `User`        | Employees                           | entraObjectId, email, displayName, department, role (ADMIN / EDITOR / VIEWER)                                                                                                                                                     |
| `AssetEvent`  | History (immutable log)             | assetId, type (CREATED / UPDATED / CHECKOUT / CHECKIN / SYNC / IMPORTED), actorId, targetUserId, changes (JSON), createdAt                                                                                                        |
| `SyncRun`     | Intune sync results                 | startedAt, finishedAt, created, updated, missing, errors (JSON)                                                                                                                                                                   |

Core rules:

- An asset is never physically deleted; it moves to ARCHIVED status.
- Every change is written to `AssetEvent`; history is append-only, never edited.
- Users are created automatically on first login or from Graph; there is no manual user management.
- Asset tag format continues the existing convention: `PC-00001`, the next number is assigned automatically.

## Phases

The project is split into 7 phases; each task is one Claude Code session and one commit. Move to the next phase only when the acceptance criterion is met.

### Phase 0 — Setup

- [ ] Scan one QR label and record its format
- [ ] Create the repo on GitHub, set up branch rules (`main` protected, merge via PR)
- [ ] Next.js + TypeScript + Tailwind + shadcn/ui project
- [ ] Local PostgreSQL via `docker-compose.yml`
- [ ] Install Prisma, first empty migration
- [ ] ESLint, Prettier, `.env.example`
- [ ] Add `CLAUDE.md` and `docs/PLAN.md` to the repo

**Acceptance criterion:** `npm run dev` works, the database connects.

### Phase 1 — Database and sign-in

- [ ] Full Prisma schema and migration
- [ ] Seed: statuses, categories, companies
- [ ] App Registration in Entra ID (redirect URI, client secret)
- [ ] Auth.js + Entra ID provider, login page
- [ ] Role assignment from Entra groups (ADMIN / EDITOR / VIEWER)
- [ ] Auth middleware for all pages and APIs
- [ ] Main layout: compact sidebar, header, search

**Acceptance criterion:** sign-in with a Microsoft account works, the role is assigned correctly from the group.

### Phase 2 — Snipe-IT migration

- [ ] Create an API token in Snipe-IT
- [ ] Migrate lookup tables (model, category, company, status, location)
- [ ] Migrate assets, keeping `legacySnipeId`
- [ ] Migrate checkin/checkout history into `AssetEvent`
- [ ] Legacy QR route: `/hardware/[id]` → new asset page
- [ ] Run the script against a test database, verify the count (316 assets)

**Acceptance criterion:** all assets are migrated; scanning 5 random labels opens the correct page.

### Phase 3 — Core features

- [ ] Asset list: table, search, filters (status, company, category), pagination
- [ ] Asset detail page and history timeline
- [ ] Create and edit form (Intune fields read-only)
- [ ] Checkout / checkin dialogs
- [ ] Dashboard: counts by status
- [ ] Lookup table management page (admin)
- [ ] CSV export

**Acceptance criterion:** everything done daily in Snipe-IT can be done in the new system.

### Phase 4 — Intune synchronization

- [ ] `DeviceManagementManagedDevices.Read.All` (Application) permission on the App Registration, admin consent
- [ ] Graph client (client credentials, pagination)
- [ ] Sync logic: match by serial, create, update, flag `missingInIntune`
- [ ] Field ownership: technical fields from Intune, business fields manual
- [ ] Show the Intune user as an assignment suggestion
- [ ] Hourly cron job and a "Sync now" button
- [ ] Sync log page (`SyncRun`)

**Acceptance criterion:** running sync twice in a row creates no duplicates and manual changes are not lost.

### Phase 5 — QR

- [ ] QR for new assets (`/a/[assetTag]` URL)
- [ ] Label printing page: PDF for selected assets
- [ ] Camera scan page (both legacy and new format)
- [ ] Quick checkin / checkout after scanning

**Acceptance criterion:** both legacy and new labels can be scanned with a phone and checked out.

### Phase 6 — Deploy

- [ ] Azure Database for PostgreSQL and App Service
- [ ] Connect Key Vault via the App Service Managed Identity
- [ ] GitHub Actions: lint, build, migration, deploy
- [ ] Add the production redirect URI to Entra
- [ ] Final migration, redirect the old domain to the new system
- [ ] Keep Snipe-IT read-only for a while, then shut it down

**Acceptance criterion:** the team uses only the new system for one week with no need to go back to Snipe-IT.

## Working with Claude

Context is written once in files; sessions are short and single-task — this is the key to saving tokens.

1. Use Claude Code for writing code; don't copy-paste files into chat.
2. Start a session like this: "Do the next task of Phase N in PLAN.md."
3. For a large task, ask for a plan in plan mode first, approve it, then have the code written.
4. When a task is done, test, commit, and tick the checkbox in PLAN.md.
5. Clear the context with `/clear` and move to the next task.
6. When a new architecture decision is made, add it to CLAUDE.md as a single line right away.
7. On errors, share only the error message and the related file name, not the whole log.

The project context for Claude Code lives in `CLAUDE.md` at the repo root; Claude Code reads it automatically in every session.

## Risks and open questions

The biggest risk is legacy QR labels no longer working; this is verified in Phase 0.

| Risk                                                          | Impact                      | Mitigation                                                                           |
| ------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| QR has a different format than expected                       | Labels must be reprinted    | Scan a label first; build the route accordingly                                      |
| Old domain is lost                                            | All labels return 404       | Keep the domain or set up a redirect                                                 |
| Serial numbers are written differently in Intune and Snipe-IT | Duplicate assets            | Normalize before comparing (uppercase, no spaces)                                    |
| Client secret expires                                         | Sync stops                  | Store in Key Vault, put the expiry date in the calendar; later move to a certificate |
| Project drags on                                              | Parallel work with Snipe-IT | Keep Snipe-IT active until the last phase                                            |

Questions that need answers before starting:

- [ ] What exactly is encoded in the legacy QR?
- [ ] Which domain will the new system use?
- [ ] Which Entra groups map to ADMIN, EDITOR and VIEWER?
- [ ] Will devices not in Intune (monitors, printers) be added to the system?
- [ ] Which label printer and label size?
