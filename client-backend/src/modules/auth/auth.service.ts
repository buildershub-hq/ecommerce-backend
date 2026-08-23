import { Pool } from 'pg';
import { AuthRepository } from './auth.repository';
import { AuthUtils } from './auth.utils';
import { JWTPayload, AuthResponseData, LoginResponseData } from './auth.types';

export class AuthService {
  private repo: AuthRepository;
  private db:   Pool;

  constructor(db: Pool) {
    this.db   = db;
    this.repo = new AuthRepository();
  }

  /** Timing-attack mitigation: wastes bcrypt CPU time when user not found */
  private async fakePasswordVerify(): Promise<void> {
    await AuthUtils.verifyPassword(
      'dummy_password',
      '$2b$12$L7R2R7W/aW6QdCpln7c3xO29L8n4y8fM98a.1234567890123456',
    );
  }

  // ── POST /signup ────────────────────────────────────────────────────────────
  /**
   * All five frontend fields land in a SINGLE row of the `users` table:
   *
   *   fullname      → users.fullname
   *   email         → users.email
   *   company       → users.company
   *   businnessType → users.business_type
   *   password      → users.password_hash  (bcrypt)
   *   agreed        → validated only, not persisted
   */
  async signup(
    data: {
      fullname:      string;
      email:         string;
      company:       string;
      businnessType: string;
      password:      string;
    },
    signToken: (payload: JWTPayload, options?: { expiresIn?: string }) => string,
  ): Promise<AuthResponseData> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Reject duplicate email globally
      const existing = await this.repo.findUserByEmail(client, data.email);
      if (existing) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      // 2. Hash password and insert the user row
      const passwordHash = await AuthUtils.hashPassword(data.password);
      const user = await this.repo.createUser(client, {
        fullname:      data.fullname,
        email:         data.email,
        company:       data.company,
        business_type: data.businnessType,
        password_hash: passwordHash,
        role:          'owner',
      });

      // 3. Issue tokens
      const accessToken = signToken({ id: user.id, role: user.role });

      const rawRefreshToken   = AuthUtils.generateRandomToken();
      const refreshTokenHash  = AuthUtils.hashToken(rawRefreshToken);
      const expiresAt         = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.repo.storeRefreshToken(client, {
        user_id:    user.id,
        token_hash: refreshTokenHash,
        expires_at: expiresAt,
      });

      // 4. Generate email verification token
      const rawVerifyToken = AuthUtils.generateRandomToken();
      const verifyTokenHash = AuthUtils.hashToken(rawVerifyToken);
      const verifyExpiresAt = new Date();
      verifyExpiresAt.setDate(verifyExpiresAt.getDate() + 1);

      await this.repo.storeEmailVerificationToken(client, {
        user_id:    user.id,
        token_hash: verifyTokenHash,
        expires_at: verifyExpiresAt,
      });

      // 5. Audit log
      await this.repo.createAuditLog(client, {
        actor_user_id: user.id,
        action:        'user.signup',
        entity_type:   'user',
        entity_id:     user.id,
        metadata:      { email: user.email, company: user.company },
      });

      await client.query('COMMIT');

      return {
        user: {
          id:            user.id,
          fullname:      user.fullname,
          email:         user.email,
          company:       user.company,
          business_type: user.business_type,
          role:          user.role,
        },
        tokens: { accessToken, refreshToken: rawRefreshToken },
        emailVerificationToken: rawVerifyToken,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── POST /login ─────────────────────────────────────────────────────────────
  /**
   * Only email + password are used from the frontend payload.
   * All other fields (fullname, company, businnessType, agreed) are ignored.
   */
  async login(
    data: { email: string; password: string },
    signToken: (payload: JWTPayload, options?: { expiresIn?: string }) => string,
  ): Promise<LoginResponseData> {
    const client = await this.db.connect();
    try {
      // 1. Look up user
      const user = await this.repo.findUserByEmail(client, data.email);
      if (!user || user.status === 'disabled') {
        await this.fakePasswordVerify();
        throw new Error('INVALID_CREDENTIALS');
      }

      // 2. Verify password
      const valid = await AuthUtils.verifyPassword(data.password, user.password_hash);
      if (!valid) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // 3. Check MFA — if enabled, return mfaToken instead of real tokens
      if (user.mfa_enabled) {
        const mfaToken = signToken(
          { id: user.id, role: user.role, purpose: 'mfa' },
          { expiresIn: '5m' },
        );
        await this.repo.createAuditLog(client, {
          actor_user_id: user.id,
          action:        'user.login.mfa_required',
          entity_type:   'user',
          entity_id:     user.id,
          metadata:      { email: user.email },
        });
        return { mfaRequired: true as const, mfaToken };
      }

      // 4. Issue tokens
      const accessToken = signToken({ id: user.id, role: user.role });

      const rawRefreshToken  = AuthUtils.generateRandomToken();
      const refreshTokenHash = AuthUtils.hashToken(rawRefreshToken);
      const expiresAt        = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.repo.storeRefreshToken(client, {
        user_id:    user.id,
        token_hash: refreshTokenHash,
        expires_at: expiresAt,
      });

      // 5. Audit log
      await this.repo.createAuditLog(client, {
        actor_user_id: user.id,
        action:        'user.login',
        entity_type:   'user',
        entity_id:     user.id,
        metadata:      { email: user.email },
      });

      return {
        user: {
          id:            user.id,
          fullname:      user.fullname,
          email:         user.email,
          company:       user.company,
          business_type: user.business_type,
          role:          user.role,
        },
        tokens: { accessToken, refreshToken: rawRefreshToken },
      };
    } finally {
      client.release();
    }
  }

  // ── POST /refresh ───────────────────────────────────────────────────────────
  async refresh(
    rawRefreshToken: string,
    signToken: (payload: JWTPayload) => string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const client = await this.db.connect();
    try {
      const tokenHash   = AuthUtils.hashToken(rawRefreshToken);
      const storedToken = await this.repo.findRefreshToken(client, tokenHash);
      if (!storedToken) throw new Error('INVALID_REFRESH_TOKEN');

      if (new Date() > storedToken.expires_at) {
        await this.repo.deleteRefreshToken(client, tokenHash);
        throw new Error('EXPIRED_REFRESH_TOKEN');
      }

      const user = await this.repo.findUserById(client, storedToken.user_id);
      if (!user || user.status === 'disabled') {
        await this.repo.deleteRefreshToken(client, tokenHash);
        throw new Error('USER_NOT_FOUND_OR_DISABLED');
      }

      // Rotate — delete old, issue new
      await this.repo.deleteRefreshToken(client, tokenHash);

      const newAccessToken      = signToken({ id: user.id, role: user.role });
      const newRawRefreshToken  = AuthUtils.generateRandomToken();
      const newRefreshTokenHash = AuthUtils.hashToken(newRawRefreshToken);
      const expiresAt           = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.repo.storeRefreshToken(client, {
        user_id:    user.id,
        token_hash: newRefreshTokenHash,
        expires_at: expiresAt,
      });

      return { accessToken: newAccessToken, refreshToken: newRawRefreshToken };
    } finally {
      client.release();
    }
  }

  // ── POST /logout ────────────────────────────────────────────────────────────
  async logout(rawRefreshToken: string): Promise<void> {
    const client = await this.db.connect();
    try {
      const tokenHash = AuthUtils.hashToken(rawRefreshToken);
      await this.repo.deleteRefreshToken(client, tokenHash);
    } finally {
      client.release();
    }
  }

  // ── GET /me ─────────────────────────────────────────────────────────────────
  async me(userId: string): Promise<AuthResponseData['user']> {
    const client = await this.db.connect();
    try {
      const user = await this.repo.findUserById(client, userId);
      if (!user) throw new Error('USER_NOT_FOUND');

      return {
        id:            user.id,
        fullname:      user.fullname,
        email:         user.email,
        company:       user.company,
        business_type: user.business_type,
        role:          user.role,
      };
    } finally {
      client.release();
    }
  }

  // ── POST /forgot-password ──────────────────────────────────────────────────
  async forgotPassword(email: string): Promise<{ resetToken?: string }> {
    const client = await this.db.connect();
    try {
      const user = await this.repo.findUserByEmail(client, email);

      // SECURITY: Always return success, even if email not found
      if (!user) return {};

      await this.repo.deleteAllPasswordResetTokensForUser(client, user.id);

      const rawToken = AuthUtils.generateRandomToken();
      const tokenHash = AuthUtils.hashToken(rawToken);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await this.repo.storePasswordResetToken(client, {
        user_id:    user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      await this.repo.createAuditLog(client, {
        actor_user_id: user.id,
        action:        'user.forgot_password',
        entity_type:   'user',
        entity_id:     user.id,
        metadata:      { email: user.email },
      });

      return { resetToken: rawToken };
    } finally {
      client.release();
    }
  }

  // ── POST /reset-password ───────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const tokenHash = AuthUtils.hashToken(token);
      const storedToken = await this.repo.findPasswordResetToken(client, tokenHash);

      if (!storedToken) throw new Error('INVALID_RESET_TOKEN');
      if (new Date() > storedToken.expires_at) {
        await this.repo.deletePasswordResetToken(client, tokenHash);
        throw new Error('EXPIRED_RESET_TOKEN');
      }

      const passwordHash = await AuthUtils.hashPassword(newPassword);
      await this.repo.updateUserPassword(client, storedToken.user_id, passwordHash);

      await this.repo.deletePasswordResetToken(client, tokenHash);

      // Invalidate all refresh tokens for this user
      await this.repo.deleteAllRefreshTokensForUser(client, storedToken.user_id);

      await this.repo.createAuditLog(client, {
        actor_user_id: storedToken.user_id,
        action:        'user.reset_password',
        entity_type:   'user',
        entity_id:     storedToken.user_id,
        metadata:      {},
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── POST /verify-email ─────────────────────────────────────────────────────
  async verifyEmail(token: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const tokenHash = AuthUtils.hashToken(token);
      const storedToken = await this.repo.findEmailVerificationToken(client, tokenHash);

      if (!storedToken) throw new Error('INVALID_VERIFICATION_TOKEN');
      if (new Date() > storedToken.expires_at) {
        await this.repo.deleteEmailVerificationToken(client, tokenHash);
        throw new Error('EXPIRED_VERIFICATION_TOKEN');
      }

      await this.repo.markEmailVerified(client, storedToken.user_id);
      await this.repo.deleteEmailVerificationToken(client, tokenHash);

      await this.repo.createAuditLog(client, {
        actor_user_id: storedToken.user_id,
        action:        'user.email_verified',
        entity_type:   'user',
        entity_id:     storedToken.user_id,
        metadata:      {},
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── POST /mfa/enable ──────────────────────────────────────────────────────
  async enableMfa(userId: string, userEmail: string): Promise<{ secret: string; otpauthUri: string }> {
    const client = await this.db.connect();
    try {
      const totp = AuthUtils.generateMfaSecret(userEmail);
      const secretBase32 = totp.secret.base32;

      await this.repo.updateUserMfaSecret(client, userId, secretBase32, true);

      await this.repo.createAuditLog(client, {
        actor_user_id: userId,
        action:        'user.mfa_enable_initiated',
        entity_type:   'user',
        entity_id:     userId,
        metadata:      {},
      });

      return {
        secret: secretBase32,
        otpauthUri: totp.toString(),
      };
    } finally {
      client.release();
    }
  }

  // ── POST /mfa/verify ──────────────────────────────────────────────────────
  async verifyMfa(
    code: string,
    mfaToken: string,
    verifyJwt: (token: string) => JWTPayload,
    signToken: (payload: JWTPayload, options?: { expiresIn?: string }) => string,
  ): Promise<
    | { context: 'setup'; mfaEnabled: true }
    | { context: 'login'; tokens: { accessToken: string; refreshToken: string } }
  > {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      let payload: JWTPayload;
      try {
        payload = verifyJwt(mfaToken);
      } catch {
        throw new Error('INVALID_MFA_TOKEN');
      }

      const user = await this.repo.findUserById(client, payload.id);
      if (!user || !user.mfa_secret) throw new Error('MFA_NOT_CONFIGURED');

      const valid = AuthUtils.verifyTotpCode(user.mfa_secret, code);
      if (!valid) throw new Error('INVALID_MFA_CODE');

      if (payload.purpose === 'mfa') {
        // Login context: issue tokens
        const accessToken = signToken({ id: user.id, role: user.role });

        const rawRefreshToken = AuthUtils.generateRandomToken();
        const refreshTokenHash = AuthUtils.hashToken(rawRefreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await this.repo.storeRefreshToken(client, {
          user_id:    user.id,
          token_hash: refreshTokenHash,
          expires_at: expiresAt,
        });

        await this.repo.createAuditLog(client, {
          actor_user_id: user.id,
          action:        'user.login.mfa_verified',
          entity_type:   'user',
          entity_id:     user.id,
          metadata:      { email: user.email },
        });

        await client.query('COMMIT');
        return { context: 'login' as const, tokens: { accessToken, refreshToken: rawRefreshToken } };
      } else {
        // Setup context: finalize MFA
        await this.repo.enableUserMfa(client, user.id);

        await this.repo.createAuditLog(client, {
          actor_user_id: user.id,
          action:        'user.mfa_enabled',
          entity_type:   'user',
          entity_id:     user.id,
          metadata:      {},
        });

        await client.query('COMMIT');
        return { context: 'setup' as const, mfaEnabled: true as const };
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
