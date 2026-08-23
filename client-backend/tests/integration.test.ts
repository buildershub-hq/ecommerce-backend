import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import ajvErrors from 'ajv-errors';
import * as otpauth from 'otpauth';
import { buildApp } from '../src/app';

// ─── Shared state ─────────────────────────────────────────────────────────────
let app:         FastifyInstance;
let accessToken: string;
let userId:      string;
let emailVerificationToken: string;

const suffix    = Math.floor(Math.random() * 100000);
const testEmail = `test-${suffix}@example.com`;

// ─── Boot / teardown ─────────────────────────────────────────────────────────
beforeAll(async () => {
  app = Fastify({
    ajv: {
      customOptions: { allErrors: true },
      plugins: [ajvErrors as any],
    },
  });
  await buildApp(app);
  await app.ready();
});

afterAll(async () => {
  if (userId) {
    await app.db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
    await app.db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await app.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await app.db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  await app.close();
});

// ─── Auth suite ──────────────────────────────────────────────────────────────
describe('Auth endpoints', () => {

  // ── POST /signup ────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/signup', () => {

    it('creates a new user — all fields go into the users table', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/signup',
        payload: {
          fullname:     'John Doe',
          email:        testEmail,
          company:      'My New Store',
          businnessType:'Retail Stores',
          password:     'Password123!',
          agreed:       true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();

      expect(body.data.user.fullname).toBe('John Doe');
      expect(body.data.user.email).toBe(testEmail);
      expect(body.data.user.company).toBe('My New Store');
      expect(body.data.user.business_type).toBe('Retail Stores');
      expect(body.data.user.role).toBe('owner');
      expect(body.data.tokens.accessToken).toBeTruthy();
      expect(body.data.tokens.refreshToken).toBeTruthy();
      expect(body.data.emailVerificationToken).toBeTruthy();

      // stash for later tests
      accessToken = body.data.tokens.accessToken;
      userId      = body.data.user.id;
      emailVerificationToken = body.data.emailVerificationToken;
    });

    it('rejects duplicate email (409)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/signup',
        payload: {
          fullname:     'Duplicate',
          email:        testEmail,
          company:      'Other Co',
          businnessType:'Distributors',
          password:     'Password123!',
          agreed:       true,
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it('rejects missing required field (400)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/signup',
        payload: {
          email:        `missing-${suffix}@example.com`,
          company:      'Co',
          businnessType:'Wholesalers',
          password:     'Password123!',
          agreed:       true,
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects agreed = false (400)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/signup',
        payload: {
          fullname:     'No Agree',
          email:        `noagree-${suffix}@example.com`,
          company:      'Co',
          businnessType:'Wholesalers',
          password:     'Password123!',
          agreed:       false,
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid businnessType (400)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/signup',
        payload: {
          fullname:     'Bad Type',
          email:        `badtype-${suffix}@example.com`,
          company:      'Co',
          businnessType:'Retail',
          password:     'Password123!',
          agreed:       true,
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /login ─────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {

    it('logs in with the full frontend auth-state object', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/login',
        payload: {
          fullname:     '',
          email:        testEmail,
          company:      '',
          businnessType:'',
          password:     'Password123!',
          agreed:       false,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.user.fullname).toBe('John Doe');
      expect(body.data.user.company).toBe('My New Store');
      expect(body.data.user.business_type).toBe('Retail Stores');
      expect(body.data.tokens.accessToken).toBeTruthy();
    });

    it('rejects wrong password (401)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/login',
        payload: { email: testEmail, password: 'WrongPass999!' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects unknown email (401)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/login',
        payload: { email: 'nobody@nowhere.com', password: 'Password123!' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /me ─────────────────────────────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {

    it('returns the full user profile from the users table', async () => {
      const res = await app.inject({
        method:  'GET',
        url:     '/api/v1/auth/me',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.fullname).toBe('John Doe');
      expect(body.data.email).toBe(testEmail);
      expect(body.data.company).toBe('My New Store');
      expect(body.data.user.business_type).toBe('Retail Stores');
      expect(body.data.role).toBe('owner');
    });

    it('returns 401 without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /verify-email ─────────────────────────────────────────────────────
  describe('POST /api/v1/auth/verify-email', () => {

    it('verifies email with valid token (200)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/verify-email',
        payload: { token: emailVerificationToken },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });

    it('rejects invalid token (400)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/verify-email',
        payload: { token: 'a'.repeat(64) },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /forgot-password ──────────────────────────────────────────────────
  describe('POST /api/v1/auth/forgot-password', () => {
    let resetToken: string;

    it('returns reset token for existing user (200)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/forgot-password',
        payload: { email: testEmail },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.resetToken).toBeTruthy();
      resetToken = body.data.resetToken;
    });

    it('returns success even for non-existent email (200)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/forgot-password',
        payload: { email: 'nonexistent@example.com' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.resetToken).toBeUndefined();
    });

    it('rejects invalid email format (400)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/forgot-password',
        payload: { email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });

    // ── POST /reset-password ──────────────────────────────────────────────────
    describe('POST /api/v1/auth/reset-password', () => {

      it('resets password with valid token (200)', async () => {
        const res = await app.inject({
          method:  'POST',
          url:     '/api/v1/auth/reset-password',
          payload: { token: resetToken, newPassword: 'NewPassword123!' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.success).toBe(true);
      });

      it('can login with new password', async () => {
        const res = await app.inject({
          method:  'POST',
          url:     '/api/v1/auth/login',
          payload: { email: testEmail, password: 'NewPassword123!' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.data.tokens.accessToken).toBeTruthy();
        // Update accessToken for subsequent tests
        accessToken = body.data.tokens.accessToken;
      });

      it('rejects reused token (400)', async () => {
        const res = await app.inject({
          method:  'POST',
          url:     '/api/v1/auth/reset-password',
          payload: { token: resetToken, newPassword: 'AnotherPass123!' },
        });
        expect(res.statusCode).toBe(400);
      });

      it('rejects invalid token (400)', async () => {
        const res = await app.inject({
          method:  'POST',
          url:     '/api/v1/auth/reset-password',
          payload: { token: 'b'.repeat(64), newPassword: 'AnotherPass123!' },
        });
        expect(res.statusCode).toBe(400);
      });

      it('rejects weak password (400)', async () => {
        const res = await app.inject({
          method:  'POST',
          url:     '/api/v1/auth/reset-password',
          payload: { token: 'c'.repeat(64), newPassword: 'weak' },
        });
        expect(res.statusCode).toBe(400);
      });
    });
  });

  // ── MFA flow (end-to-end) ──────────────────────────────────────────────────
  describe('MFA flow', () => {
    let mfaSecret: string;
    let mfaToken: string;

    it('POST /mfa/enable returns secret and otpauth URI (200)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/mfa/enable',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.secret).toBeTruthy();
      expect(body.data.otpauthUri).toBeTruthy();
      expect(body.data.otpauthUri).toContain('otpauth://');
      mfaSecret = body.data.secret;
    });

    it('POST /mfa/enable rejects unauthenticated request (401)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/mfa/enable',
      });
      expect(res.statusCode).toBe(401);
    });

    it('POST /mfa/verify confirms MFA setup with valid TOTP code (200)', async () => {
      // Generate a valid TOTP code from the secret
      const totp = new otpauth.TOTP({
        issuer: 'BusinessOpsPlatform',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: otpauth.Secret.fromBase32(mfaSecret),
      });
      const code = totp.generate();

      // First we need an mfaToken for setup context — use a JWT with no purpose
      const setupMfaToken = app.jwt.sign({ id: userId, role: 'owner' }, { expiresIn: '5m' });

      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/mfa/verify',
        payload: { code, mfaToken: setupMfaToken },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.mfaEnabled).toBe(true);
    });

    it('login returns mfaRequired when MFA is enabled', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/login',
        payload: { email: testEmail, password: 'NewPassword123!' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.mfaRequired).toBe(true);
      expect(body.data.mfaToken).toBeTruthy();
      mfaToken = body.data.mfaToken;
    });

    it('POST /mfa/verify issues tokens during login flow (200)', async () => {
      const totp = new otpauth.TOTP({
        issuer: 'BusinessOpsPlatform',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: otpauth.Secret.fromBase32(mfaSecret),
      });
      const code = totp.generate();

      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/mfa/verify',
        payload: { code, mfaToken },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.tokens.accessToken).toBeTruthy();
      expect(body.data.tokens.refreshToken).toBeTruthy();
      accessToken = body.data.tokens.accessToken;
    });

    it('POST /mfa/verify rejects invalid TOTP code (400)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/mfa/verify',
        payload: { code: '000000', mfaToken },
      });
      expect(res.statusCode).toBe(400);
    });

    it('POST /mfa/verify rejects invalid mfaToken (401)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/mfa/verify',
        payload: { code: '123456', mfaToken: 'invalid.token.here' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
