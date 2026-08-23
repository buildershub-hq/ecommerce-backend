# AGENTS.md — ecommerce-backend

## Project layout

All application code lives inside `client-backend/`. There is no root-level package.json — run all commands from that directory.

```
ecommerce-backend/
  client-backend/          ← the only package; all commands run here
    src/
      server.ts            ← entrypoint (boots Fastify, calls buildApp)
      app.ts               ← plugin registration order + global error handler
      config/              ← env.ts, database.ts, jwt.ts
      plugins/             ← fastify plugins (postgres, jwt, cors, rate-limit, swagger)
      routes/index.ts      ← central router; registers module routes with /api/v1 prefix
      middleware/           ← authenticate.ts (JWT), authorize.ts (RBAC permission check)
      modules/<feature>/   ← feature-based modules (see below)
      sql/                 ← reusable raw SQL files (auth.sql, users.sql)
    migrations/            ← numbered SQL migration files (run manually)
    tests/                 ← vitest integration tests
    openapi.yaml           ← full OpenAPI 3.0 spec (source of truth for API shape)
```

## Commands (run from `client-backend/`)

| Task | Command |
|------|---------|
| Dev server (hot reload) | `npm run dev` |
| Build (tsc) | `npm run build` |
| Start production | `npm run start` |
| All tests | `npm run test` |
| Single integration test file | `npm run test:integration` |
| Run one test by name | `npx vitest -t "test name substring"` |

There is no lint, format, or typecheck script — `npm run build` (tsc) is the only static check.

## Architecture

**Framework**: Fastify 5 + TypeScript (strict mode, ES2022, NodeNext modules).

**Database**: PostgreSQL via `node-postgres` (pg). No ORM — all queries are raw SQL with parameterized `$1, $2, ...` placeholders. The pool is decorated onto `fastify.db` via a plugin.

**Module pattern** — each business domain under `src/modules/<name>/` owns:
- `<name>.routes.ts` — registers endpoints, applies schemas and middleware
- `<name>.controller.ts` — thin; receives request, calls service, returns response
- `<name>.service.ts` — business logic, transactions (uses `db.connect()` for manual BEGIN/COMMIT/ROLLBACK)
- `<name>.repository.ts` — raw SQL queries, receives `Pool | PoolClient`
- `<name>.schema.ts` — Fastify JSON Schema with ajv-errors custom messages
- `<name>.types.ts` — TypeScript interfaces matching DB rows and API shapes
- `<name>.utils.ts` — static helpers (hashing, token generation)

Currently only `auth` is implemented. Module directories `users`, `inventory`, `orders`, `procurement`, `warehouse`, `ai` exist but are empty.

**Route registration**: New module routes must be added in `src/routes/index.ts` with the `/api/v1/<module>` prefix.

## Database conventions

- Primary keys: UUID (`uuid_generate_v4()`)
- Timestamps: `TIMESTAMPTZ` with `DEFAULT NOW()`
- Money: `NUMERIC(14,2)`
- Naming: `snake_case` columns
- Soft deletes: `deleted_at` column (nullable)
- Audit: `created_at`, `updated_at` on every table
- Multi-tenancy: `tenant_id` column on tenant-scoped tables (planned, not yet enforced)

## Migrations

Migrations are plain `.sql` files in `migrations/` with numeric prefixes. There is no migration runner — apply them manually with `psql`. Migration `002` references a `tenants` table that does not exist in `001`; if running from scratch, you may need to create that table first or skip `002`.

## Environment

Loaded from `client-backend/.env` via dotenv. Key variables:

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | 5000 | |
| `NODE_ENV` | development | Controls log level and pool size |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ecommerce_db` | |
| `JWT_SECRET` | hardcoded dev fallback | Must be set in production |
| `JWT_EXPIRES_IN` | 15m | |
| `REFRESH_EXPIRES_IN_DAYS` | 30 | Integer, not a duration string |
| `BCRYPT_ROUNDS` | 12 | |
| `CORS_ORIGIN` | `*` | Comma-separated list or `*` |

## Testing

- **Framework**: Vitest 4
- **Pattern**: Integration tests use Fastify's `app.inject()` — no real HTTP server started
- **Prerequisite**: A running PostgreSQL instance at `DATABASE_URL`. Tests write to and delete from the real database.
- **Cleanup**: Tests delete their own test user in `afterAll` via `DELETE FROM users WHERE id = $1`
- **Test data**: Random email suffix to avoid collisions (`test-<random>@example.com`)

## Validation and error responses

Every endpoint uses Fastify JSON Schema validation. Custom error messages via `ajv-errors`.

**Error envelope** (always):
```json
{ "error": { "code": "STRING_CODE", "message": "Human text", "details": null } }
```

**Success envelope**:
```json
{ "success": true, "data": { ... } }
```

## Auth specifics

- JWT payload contains `{ id, role }` — the `authenticate` middleware extends `@fastify/jwt` types accordingly
- Refresh tokens are stored as SHA-256 hashes in the `refresh_tokens` table; the raw token is only returned to the client once
- Refresh token rotation: old token is deleted on use, new one issued
- `authorize(requiredPermission)` middleware queries `user_roles → role_permissions → permissions` for RBAC
- Signup/login endpoints have per-IP rate limits (5/min) configured at the route level

## Known quirks

- The signup body field is `businnessType` (double 'n') — this matches the frontend contract and the OpenAPI spec. The DB column is `business_type` (correct spelling). Do not "fix" the API field name.
- Login accepts the full frontend auth-state object (fullname, company, businnessType, agreed) but only uses `email` and `password`. Extra fields are silently ignored.
- `src/plugins/postgres.ts` augments `FastifyInstance` with a `db: Pool` property via `declare module 'fastify'`.
- The `authenticate` middleware augments `@fastify/jwt` with a `FastifyJWT.user` type.
- Swagger UI is served at `/docs` (not `/swagger`).

## Adding a new module

1. Create `src/modules/<name>/` with the 7 standard files (routes, controller, service, repository, schema, types, utils)
2. Register routes in `src/routes/index.ts`: `await fastify.register(<name>Routes, { prefix: '/api/v1/<name>' });`
3. Write migration SQL in `migrations/` and apply manually
4. Add tests in `tests/`
5. Update `openapi.yaml` with the new endpoints
