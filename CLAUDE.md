# Asset Management — context for Claude

## Project

Internal IT asset management system (replacement for Snipe-IT).
Plan and phases: docs/PLAN.md

## Stack

Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, TanStack Table,
React Hook Form + Zod, PostgreSQL + Prisma, Auth.js (Entra ID), Microsoft Graph.

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
- Roles: Entra groups → ADMIN / EDITOR / VIEWER

@AGENTS.md
