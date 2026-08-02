import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import ajvErrors from 'ajv-errors';
import { buildApp } from '../src/app';

// ─── Shared state ─────────────────────────────────────────────────────────────
let app:         FastifyInstance;
let accessToken: string;
let userId:      string;

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
  if (userId) await app.db.query('DELETE FROM users WHERE id = $1', [userId]);
  await app.close();
});

// ─── Auth suite ──────────────────────────────────────────────────────────────
describe('Auth endpoints', () => {

  // ── POST /signup ────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/signup', () => {

    it('creates a new user — all fields go into the users table', async () => {
      /**
       *  Frontend field   →  users column
       *  ─────────────────────────────────
       *  fullname         →  fullname
       *  email            →  email
       *  company          →  company
       *  businnessType    →  business_type
       *  password         →  password_hash  (bcrypt)
       *  agreed           →  (validated, not stored)
       */
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

      // stash for later tests
      accessToken = body.data.tokens.accessToken;
      userId      = body.data.user.id;
    });

    it('rejects duplicate email (409)', async () => {
      const res = await app.inject({
        method:  'POST',
        url:     '/api/v1/auth/signup',
        payload: {
          fullname:     'Duplicate',
          email:        testEmail,           // same email
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
          // fullname omitted
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
          businnessType:'Retail',    // not in enum — must be "Retail Stores"
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
      // Frontend sends its whole state — extra fields are ignored server-side
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
      expect(body.data.business_type).toBe('Retail Stores');
      expect(body.data.role).toBe('owner');
    });

    it('returns 401 without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
      expect(res.statusCode).toBe(401);
    });
  });
});
