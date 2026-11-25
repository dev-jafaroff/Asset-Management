# Asset Management — context for Claude

## Project

Internal IT asset management system (replacement for Snipe-IT).
Plan and phases: docs/PLAN.md

## Stack

Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, TanStack Table,
React Hook Form + Zod, PostgreSQL + Prisma, Better Auth (Entra ID), Microsoft Graph.

## Commands

- npm run dev — local server
- docker compose up -d — local PostgreSQL
- npx prisma migrate dev — migration
- npm run lint
- npm run format — Prettier

## Structure

- app/ — pages and route handlers
- app/api/ — API
- lib/ — prisma, auth, graph client
- lib/sync/ — Intune sync logic
- scripts/ — Snipe-IT migration
- components/ — UI components

## Rules

- TypeScript strict; never use `any`.
- Validation with Zod; schemas live in lib/schemas.
- Always check roles in Server Actions and route handlers.
- Assets are never deleted; they become ARCHIVED.
- Every change is written to AssetEvent.
- Secrets only in .env / Key Vault.
- Everything in English: UI text, code, comments, docs.

## Key decisions

- Repo: GitHub (dev-jafaroff/Asset-Management), not Azure DevOps; main is protected, merge via PR
- CI/CD: GitHub Actions → Azure App Service
- Legacy QR format: <scan a label and fill in>
- Legacy QR route: /hardware/[id] → lookup by legacySnipeId
- New QR: /a/[assetTag]
- Intune matching: by serialNumber
- Intune-owned fields: name, osVersion, lastIntuneSync (read-only in UI)
- Roles: Entra app roles (ADMIN / EDITOR / VIEWER) on one multi-tenant app; only tenants in AUTH_ALLOWED_TENANT_IDS (EIG, Waverity) sign in
- Asset types: PC, MONITOR, PRINTER, ACCESS_POINT, CAMERA, OTHER (labeled, tag prefixes PC- / MN- / PR- / AP- / CAM- / OT-), PHONE, VM (no label)
- OTHER holds one-off devices (e.g. the server room card reader), assigned to a location; the model category says what each is
- Each type has an assignTo target in lib/assets/asset-types.ts (user / company / location); never branch on type names for assignment
- Phone number is a column on PHONE assets; SIMs are not separate items
- VMs are assigned to a company, never to a user
- Printers, access points and cameras are assigned to a location only; IP / MAC / hostname live in UniFi, not here
- Accessories are tracked by quantity (Accessory + AccessoryAssignment), no labels
- Licenses are not assets: separate model, later, read from Graph
- Users: members of the employees group (USER_SYNC_GROUPS) synced from Entra via Graph (lib/users/user-sync.ts); /users/[id] shows everything assigned
- Scheduled jobs: POST /api/cron/* with CRON_SECRET (lib/sync/sync-run.ts), host-agnostic
- Auth: lib/auth/ (Better Auth, stateless cookie session); proxy.ts guards every route; getCurrentUser() in lib/current-user.ts reads the session and syncs the User row

@AGENTS.md
