# Asset Management System — Work Plan

Oct 12, 2026 · @Babek Cafarov

## Goal and scope

Replace Snipe-IT with a simple, compact internal system tailored to the company's needs. The system must provide sign-in with a Microsoft account, automatic device synchronization from Intune, and keep the existing QR labels working.

**In the MVP:**

- SSO with Microsoft Entra ID and roles based on Entra groups
- Assets by type (PCs, monitors, printers, phones, virtual machines): create, edit, list, search, filter
- Accessories tracked by quantity (in stock / assigned)
- Users page: every employee and everything assigned to them (onboarding / offboarding)
- Checkout / checkin and full history for every asset
- Intune synchronization (automatic and manually triggered)
- Migration from Snipe-IT and support for legacy QR codes
- New QR generation, label printing and camera scanning
- CSV export

**Not in the MVP (later):** licenses (separate section, read from Graph), consumables, components, audit scheduling, maintenance records, mobile app (React Native).

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
- **Users:** all employees are synced from Entra ID via Graph, so items can be assigned before a person ever signs in; the app role only matters for people who sign in.

### Item types

| Type            | Label / QR   | Tracked as                   | Assigned to | Notes                                           |
| --------------- | ------------ | ---------------------------- | ----------- | ----------------------------------------------- |
| PC              | Yes (`PC-`)  | One record per device        | User        | Synced from Intune                              |
| Monitor         | Yes (`MON-`) | One record per device        | User        |                                                 |
| Printer         | Yes (`PRN-`) | One record per device        | User        |                                                 |
| Phone           | No           | One record per device        | User        | Phone number is a column; SIMs are not separate |
| Virtual machine | No           | One record per VM            | Company     | Many users share one VM                         |
| Accessory       | No           | Quantity (total / assigned)  | User        | Keyboard, mouse, headset, docking station, etc. |
| License (later) | No           | Separate model, not an asset | User        | Read from Graph (`subscribedSkus`)              |

## Database model

The database has 11 tables; at the center are `Asset` and `AssetEvent`, which stores its history.

| Table                 | Purpose                             | Key fields                                                                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Asset`               | Each device or VM                   | type (PC / MONITOR / PRINTER / PHONE / VM), assetTag (unique, labeled types only), serial (unique), phoneNumber, name, notes, purchaseCost, purchaseDate, source (MANUAL / INTUNE / SNIPEIT), intuneId, legacySnipeId, lastIntuneSync, missingInIntune, statusId, modelId, companyId, locationId, assignedToId |
| `AssetModel`          | Model (HP ProBook 450 G7, etc.)     | name, manufacturer, categoryId                                                                                                                                                                                                                                                                                 |
| `Category`            | Category (Personal Computers, etc.) | name                                                                                                                                                                                                                                                                                                           |
| `Company`             | Company (DRL, eiLink, EIG)          | name                                                                                                                                                                                                                                                                                                           |
| `Location`            | Office / room                       | name                                                                                                                                                                                                                                                                                                           |
| `StatusLabel`         | Status                              | name, type (DEPLOYABLE / PENDING / UNDEPLOYABLE / ARCHIVED), color                                                                                                                                                                                                                                             |
| `User`                | Employees                           | entraObjectId, email, displayName, department, role (ADMIN / EDITOR / VIEWER)                                                                                                                                                                                                                                  |
| `AssetEvent`          | History (immutable log)             | assetId, type (CREATED / UPDATED / CHECKOUT / CHECKIN / SYNC / IMPORTED), actorId, targetUserId, changes (JSON), createdAt                                                                                                                                                                                     |
| `SyncRun`             | Intune sync results                 | startedAt, finishedAt, created, updated, missing, errors (JSON)                                                                                                                                                                                                                                                |
| `Accessory`           | Accessory stock item                | name, categoryId, totalQuantity                                                                                                                                                                                                                                                                                |
| `AccessoryAssignment` | Accessories given to a user         | accessoryId, userId, quantity, assignedAt, returnedAt                                                                                                                                                                                                                                                          |

Core rules:

- An asset is never physically deleted; it moves to ARCHIVED status.
- Every change is written to `AssetEvent`; history is append-only, never edited.
- Users are created automatically on first login or from Graph; there is no manual user management.
- Asset tag format continues the existing convention: `PC-00001`, `MON-00001`, `PRN-00001`; the next number per prefix is assigned automatically. Phones and VMs have no tag.
- A VM is assigned to a company (`companyId`), never to a user.
- Accessories in stock = `totalQuantity` minus the sum of open assignments.

## Phases

The project is split into 7 phases; each task is one Claude Code session and one commit. Move to the next phase only when the acceptance criterion is met.

### Phase 0 — Setup

- [ ] Scan one QR label and record its format
- [ ] Create the repo on GitHub, set up branch rules (`main` protected, merge via PR)
- [x] Next.js + TypeScript + Tailwind + shadcn/ui project
- [x] Local PostgreSQL via `docker-compose.yml`
- [ ] Install Prisma, first empty migration (Prisma installed, migration not created yet)
- [x] ESLint, Prettier, `.env.example`
- [x] Add `CLAUDE.md` and `docs/PLAN.md` to the repo

**Acceptance criterion:** `npm run dev` works, the database connects.

**Status (2026-10-19):** `npm run dev` fails on the dev machine with `listen EACCES: permission denied 0.0.0.0:3000`.
Cause: Windows' TCP dynamic port range starts at 1024 (should be 49152), so WSL/Hyper-V (WinNAT)
reserves port blocks that include 3000 (`netsh interface ipv4 show excludedportrange protocol=tcp`
shows 2964–3063). Resetting the range with `netsh int ipv4 set dynamic tcp start=49152 num=16384`
(admin, after `wsl --shutdown` and `net stop winnat`) did not take effect — possibly a company
policy (Intune/GPO). Next steps: retry and capture the netsh output / check with IT, or use another
port meanwhile (`npm run dev -- -p 3100`; Entra redirect URI must match).

**Resolved (2026-10-21):** Running the same steps from an elevated (Run as administrator) terminal
worked — the earlier attempt failed with "System error 5 / Access is denied" because the shell was
not elevated. Port 3000 is free and `npm run dev` serves on http://localhost:3000.

### Phase 1 — Database and sign-in

- [x] Full Prisma schema and migration
- [ ] Seed: statuses (In stock = new, unopened; In storage = used and returned — both DEPLOYABLE; Pending; In repair; Archived), categories, companies
- [ ] App Registration in Entra ID (redirect URI, client secret)
- [ ] Auth.js + Entra ID provider, login page
- [ ] Role assignment from Entra groups (ADMIN / EDITOR / VIEWER)
- [ ] Auth middleware for all pages and APIs
- [x] Main layout: compact sidebar (Home, Users, Assets by type, Licenses, Scan, Admin), header, search

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

- [ ] Asset list: table, search, filters (type, status, company, category), pagination
- [ ] Asset detail page and history timeline
- [ ] Create and edit form per type (Intune fields read-only, phone number for phones, company for VMs)
- [ ] Checkout / checkin dialogs
- [ ] Accessories: stock list, assign / return by quantity
- [ ] Users list and user detail page: all assigned items, "check in all" for offboarding
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
- [ ] User sync from Entra ID (`User.Read.All` Application permission): name, email, department

**Acceptance criterion:** running sync twice in a row creates no duplicates and manual changes are not lost.

### Phase 5 — QR

- [ ] QR for new labeled assets — PCs, monitors, printers (`/a/[assetTag]` URL)
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
- [x] Will devices not in Intune (monitors, printers) be added to the system? Yes — see "Item types".
- [ ] Which label printer and label size?
