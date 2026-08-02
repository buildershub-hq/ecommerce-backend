-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── users ────────────────────────────────────────────────────────────────────
-- All signup fields land here in a single row.
--
--  fullname      ← frontend: fullname
--  email         ← frontend: email          (globally unique)
--  company       ← frontend: company
--  business_type ← frontend: businnessType
--  password_hash ← frontend: password       (bcrypt-hashed, never raw)
--  agreed        is validated server-side only; not stored (legal timestamp
--                can be added later as agreed_at TIMESTAMPTZ if required)
--  role          assigned automatically as 'owner' on signup
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    fullname      VARCHAR(255)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    company       VARCHAR(255)  NOT NULL,
    business_type VARCHAR(100)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(50)   NOT NULL DEFAULT 'owner',
    status        VARCHAR(20)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'invited', 'disabled')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── refresh_tokens ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255)  NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ   NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id  UUID          REFERENCES users(id) ON DELETE SET NULL,
    action         VARCHAR(100)  NOT NULL,
    entity_type    VARCHAR(100)  NOT NULL,
    entity_id      UUID          NOT NULL,
    metadata       JSONB         NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
