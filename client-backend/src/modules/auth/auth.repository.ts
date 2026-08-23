import { Pool, PoolClient } from 'pg';
import { User } from './auth.types';

export class AuthRepository {

  // ── users ──────────────────────────────────────────────────────────────────

  /** Find a user by email (case-insensitive) */
  async findUserByEmail(
    client: Pool | PoolClient,
    email: string,
  ): Promise<User | null> {
    const res = await client.query(
      `SELECT id, fullname, email, company, business_type,
              password_hash, role, status, created_at, updated_at,
              email_verified, mfa_secret, mfa_enabled, mfa_pending
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()],
    );
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  /** Find a user by primary key */
  async findUserById(
    client: Pool | PoolClient,
    userId: string,
  ): Promise<User | null> {
    const res = await client.query(
      `SELECT id, fullname, email, company, business_type,
              password_hash, role, status, created_at, updated_at,
              email_verified, mfa_secret, mfa_enabled, mfa_pending
       FROM users
       WHERE id = $1`,
      [userId],
    );
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  /** Insert a new user row and return it */
  async createUser(
    client: Pool | PoolClient,
    data: {
      fullname:      string;
      email:         string;
      company:       string;
      business_type: string;
      password_hash: string;
      role?:         string;
    },
  ): Promise<User> {
    const res = await client.query(
      `INSERT INTO users (fullname, email, company, business_type, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, fullname, email, company, business_type,
                 password_hash, role, status, created_at, updated_at`,
      [
        data.fullname,
        data.email.toLowerCase(),
        data.company,
        data.business_type,
        data.password_hash,
        data.role ?? 'owner',
      ],
    );
    return res.rows[0];
  }

  // ── refresh_tokens ─────────────────────────────────────────────────────────

  async storeRefreshToken(
    client: Pool | PoolClient,
    data: { user_id: string; token_hash: string; expires_at: Date },
  ): Promise<void> {
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [data.user_id, data.token_hash, data.expires_at],
    );
  }

  async findRefreshToken(
    client: Pool | PoolClient,
    tokenHash: string,
  ): Promise<{ id: string; user_id: string; token_hash: string; expires_at: Date } | null> {
    const res = await client.query(
      `SELECT id, user_id, token_hash, expires_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  async deleteRefreshToken(client: Pool | PoolClient, tokenHash: string): Promise<void> {
    await client.query(
      `DELETE FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  // ── audit_logs ─────────────────────────────────────────────────────────────

  async createAuditLog(
    client: Pool | PoolClient,
    data: {
      actor_user_id: string | null;
      action:        string;
      entity_type:   string;
      entity_id:     string;
      metadata:      Record<string, any>;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.actor_user_id,
        data.action,
        data.entity_type,
        data.entity_id,
        JSON.stringify(data.metadata),
      ],
    );
  }

  // ── password_reset_tokens ─────────────────────────────────────────────────

  async storePasswordResetToken(
    client: Pool | PoolClient,
    data: { user_id: string; token_hash: string; expires_at: Date },
  ): Promise<void> {
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [data.user_id, data.token_hash, data.expires_at],
    );
  }

  async findPasswordResetToken(
    client: Pool | PoolClient,
    tokenHash: string,
  ): Promise<{ id: string; user_id: string; token_hash: string; expires_at: Date } | null> {
    const res = await client.query(
      `SELECT id, user_id, token_hash, expires_at
       FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  async deletePasswordResetToken(client: Pool | PoolClient, tokenHash: string): Promise<void> {
    await client.query(
      `DELETE FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async deleteAllPasswordResetTokensForUser(client: Pool | PoolClient, userId: string): Promise<void> {
    await client.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1`,
      [userId],
    );
  }

  // ── email_verification_tokens ─────────────────────────────────────────────

  async storeEmailVerificationToken(
    client: Pool | PoolClient,
    data: { user_id: string; token_hash: string; expires_at: Date },
  ): Promise<void> {
    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [data.user_id, data.token_hash, data.expires_at],
    );
  }

  async findEmailVerificationToken(
    client: Pool | PoolClient,
    tokenHash: string,
  ): Promise<{ id: string; user_id: string; token_hash: string; expires_at: Date } | null> {
    const res = await client.query(
      `SELECT id, user_id, token_hash, expires_at
       FROM email_verification_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  async deleteEmailVerificationToken(client: Pool | PoolClient, tokenHash: string): Promise<void> {
    await client.query(
      `DELETE FROM email_verification_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  // ── users: MFA + email_verified updates ───────────────────────────────────

  async updateUserMfaSecret(
    client: Pool | PoolClient,
    userId: string,
    mfaSecret: string,
    mfaPending: boolean,
  ): Promise<void> {
    await client.query(
      `UPDATE users SET mfa_secret = $1, mfa_pending = $2, updated_at = NOW()
       WHERE id = $3`,
      [mfaSecret, mfaPending, userId],
    );
  }

  async enableUserMfa(client: Pool | PoolClient, userId: string): Promise<void> {
    await client.query(
      `UPDATE users SET mfa_enabled = true, mfa_pending = false, updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );
  }

  async markEmailVerified(client: Pool | PoolClient, userId: string): Promise<void> {
    await client.query(
      `UPDATE users SET email_verified = true, updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );
  }

  async updateUserPassword(
    client: Pool | PoolClient,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId],
    );
  }

  async deleteAllRefreshTokensForUser(client: Pool | PoolClient, userId: string): Promise<void> {
    await client.query(
      `DELETE FROM refresh_tokens WHERE user_id = $1`,
      [userId],
    );
  }
}
