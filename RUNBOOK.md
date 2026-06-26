# StudioOS Runbook

## Known Gotchas

### Tailwind v4 — No custom class names from config
Custom color classes like `bg-ink-800` do not work in Tailwind v4.
Use CSS variables from `frontend/src/styles/tokens.css` instead.
Correct usage: `bg-[var(--color-bg-secondary)]` or inline `style` prop.
Never add hardcoded hex values to component files.

### Port Assignments
- Local PostgreSQL (Docker): 5433
- Go backend: 8080
- Vite dev server: 5173

### Vite Cache Clear
If the frontend shows stale output or broken HMR:
rm -rf frontend/node_modules/.vite

cd frontend && npx vite --force

### Go PATH Check
If `go` command not found:
which go || export PATH=$PATH:/usr/local/go/bin

### TypeScript Config Note
`tsconfig.node.json` produces a TS6310 warning on `tsc --noEmit`.
This is a pre-existing misconfiguration and does not block Vite builds.
Use `npm run build` as the authoritative compile gate, not `tsc --noEmit`.

### Environment Files
- `backend/.env` — local backend config (never commit)
- `frontend/.env` — local frontend config (never commit)
- Both files are in .gitignore
- Production config lives in Railway environment variables only

### Running Migrations
cd backend && bash scripts/migrate.sh
Migrations are versioned SQL files in `backend/db/migrations/`.
Never run raw ALTER TABLE on production without a corresponding migration file.

### Seeding Local Database
cd backend && $env:SEED_EMAIL='admin@example.com'; $env:SEED_NAME='Super Admin'; $env:SEED_PASSWORD='Password123!'; go run ./cmd/seed/main.go

### Dual Audit Protocol
Run `@Reviewer` twice on any of the following:
- RLS policy changes
- Auth middleware changes
- DB migrations
- AI prompt construction code

### Agent Sequence
- `@Backend_Engine` — Go service layer, HTTP handlers, DB migrations
- `@Frontend-Weaver` — React components, TypeScript, CSS
- `@Integration-Specialist` — Slack, Google Sheets, external APIs
- `@Reviewer` — Audit and verification only, no code changes

### Payroll
Payroll UI is permanently cancelled. See ADR-008.
Money moves through Razorpay Payroll or Zoho Payroll.
Do not implement payment processing in StudioOS under any circumstances.
