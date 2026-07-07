# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm workspace with two main packages:

- `client/`: React 19 + Vite frontend. Source lives in `client/src`.
- `server/`: Express + MySQL API. Source lives in `server/src`.
- `PROJECT_PLAN.md`: phased product plan and implementation notes.
- `README.md`: local setup and environment instructions.

Frontend code is organized by responsibility:

- `client/src/features/<module>/`: feature screens such as calls, users, roles, reports, settings, and notifications.
- `client/src/components/`: shared app components.
- `client/src/components/ui/`: shadcn/Radix UI primitives.
- `client/src/hooks/` and `client/src/lib/`: reusable hooks, helpers, and context.

Backend route handlers live in `server/src/routes/`. Shared backend utilities such as auth, audit logging, schema, setup, and database access live directly under `server/src/`.

## Build, Test, and Development Commands

Run commands from the repository root unless noted.

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run client and server in parallel.
- `pnpm dev:client`: start the Vite client.
- `pnpm dev:server`: start the API with `tsx watch`.
- `pnpm --filter server setup`: create/update database tables and seed initial data.
- `pnpm --filter client build`: type-check and build the frontend.
- `pnpm --filter server build`: compile the backend TypeScript.
- `pnpm --filter client lint`: run oxlint for the frontend.

## Coding Style & Naming Conventions

Use TypeScript throughout. Prefer small feature modules over growing `App.tsx` or route files. Keep React components in `PascalCase`, hooks as `useSomething`, helpers in `camelCase`, and files in kebab-case where the existing code does so.

For frontend styling, prefer Tailwind CSS utilities and existing shadcn components before adding custom CSS. Keep custom CSS limited to global tokens or behavior that Tailwind cannot express cleanly.

## Testing Guidelines

There is no dedicated test framework configured yet. Before submitting changes, run at least:

```bash
pnpm --filter client build
pnpm --filter client lint
pnpm --filter server build
```

For database or API changes, also run `pnpm --filter server setup` against a local development database and manually verify affected flows.

## Commit & Pull Request Guidelines

Recent commit history uses concise Turkish summaries with detailed bodies for larger work. Follow that pattern: start with a clear subject, then list meaningful frontend, backend, database, and verification details when relevant.

Pull requests should include a short description, affected modules, setup or migration notes, screenshots for UI changes, and the commands used for verification.

## Security & Configuration Tips

Do not commit real secrets. Configure backend values in `server/.env` using `server/.env.example` as the template. Configure the frontend API target in `client/.env` with `VITE_API_URL`, using a LAN IP instead of `localhost` when testing from another device.
