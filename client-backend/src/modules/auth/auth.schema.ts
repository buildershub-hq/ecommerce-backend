import { FastifySchema } from 'fastify';

// Shared error envelope — no required constraint so validation errors serialise cleanly
const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
    
      type: 'object',
      properties: {
        code:    { type: 'string' },
        message: { type: 'string' },
        details: { nullable: true },
      },
    },
  },
};

// ─── user shape returned in every success response ───────────────────────────
const userResponseSchema = {
  type: 'object',
  properties: {
    id:            { type: 'string', format: 'uuid' },
    fullname:      { type: 'string' },
    email:         { type: 'string' },
    company:       { type: 'string' },
    business_type: { type: 'string' },
    role:          { type: 'string' },
  },
};

// ─── tokens shape ─────────────────────────────────────────────────────────────
const tokensResponseSchema = {
  type: 'object',
  properties: {
    accessToken:  { type: 'string' },
    refreshToken: { type: 'string' },
  },
};

// ─── POST /signup ─────────────────────────────────────────────────────────────
export const signupSchema: FastifySchema = {
  description: 'Sign up — all fields land in the users table',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['fullname', 'email', 'company', 'businnessType', 'password', 'agreed'],
    properties: {
      fullname: {
        type: 'string',
        minLength: 2,
        maxLength: 255,
        errorMessage: 'Full name must be between 2 and 255 characters',
      },
      email: {
        type: 'string',
        format: 'email',
        errorMessage: 'Must be a valid email address',
      },
      company: {
        type: 'string',
        minLength: 2,
        maxLength: 255,
        errorMessage: 'Company name must be between 2 and 255 characters',
      },
      businnessType: {
        type: 'string',
        enum: [
          'Importers & Exporters',
          'Distributors',
          'Wholesalers',
          'Retail Stores',
          'Supermarkets',
          'Pharmacies',
          'Manufacturing SME',
          'Construction Company',
          'Estate Developer',
          'Agricultural Business',
          'Logistics Company',
          'Other',
        ],
        errorMessage: { enum: 'Invalid business type. Please select a valid option.' },
      },
      password: {
        type: 'string',
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$',
        description: 'Min 8 chars, uppercase, lowercase, digit, special character',
        errorMessage: 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
      },
      agreed: {
        type: 'boolean',
        enum: [true],
        errorMessage: { enum: 'You must agree to the terms and conditions.' },
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            user:   userResponseSchema,
            tokens: tokensResponseSchema,
          },
        },
      },
    },
    400: errorResponseSchema,
    409: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /login ──────────────────────────────────────────────────────────────
// Accepts the full frontend auth-state object; only email + password are used.
export const loginSchema: FastifySchema = {
  description: 'Log in — only email and password are used, other fields are ignored',
  tags: ['auth'],
  
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      fullname:     { type: 'string' },
      email:        { type: 'string', format: 'email' },
      company:      { type: 'string' },
      businnessType:{ type: 'string' },
      password:     { type: 'string' },
      agreed:       { type: 'boolean' },
    },
  },

  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            user:   userResponseSchema,
            tokens: tokensResponseSchema,
          },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /refresh ────────────────────────────────────────────────────────────
export const refreshSchema: FastifySchema = {
  description: 'Rotate access and refresh tokens',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: { tokens: tokensResponseSchema },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /logout ─────────────────────────────────────────────────────────────
export const logoutSchema: FastifySchema = {
  description: 'Invalidate the current refresh token',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
    400: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── GET /me ──────────────────────────────────────────────────────────────────
export const meSchema: FastifySchema = {
  description: 'Return the authenticated user profile',
  tags: ['auth'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data:    userResponseSchema,
      },
    },
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /forgot-password ─────────────────────────────────────────────────
export const forgotPasswordSchema: FastifySchema = {
  description: 'Request a password reset token',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', errorMessage: 'Must be a valid email address' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            resetToken: { type: 'string' },
          },
        },
      },
    },
    400: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /reset-password ──────────────────────────────────────────────────
export const resetPasswordSchema: FastifySchema = {
  description: 'Reset password using a valid reset token',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['token', 'newPassword'],
    properties: {
      token: { type: 'string', minLength: 64, maxLength: 64, errorMessage: 'Invalid reset token format' },
      newPassword: {
        type: 'string',
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$',
        errorMessage: 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
    400: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /verify-email ────────────────────────────────────────────────────
export const verifyEmailSchema: FastifySchema = {
  description: 'Verify email address using a verification token',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', minLength: 64, maxLength: 64, errorMessage: 'Invalid verification token format' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
    400: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /mfa/enable ──────────────────────────────────────────────────────
export const mfaEnableSchema: FastifySchema = {
  description: 'Initiate MFA setup — generates TOTP secret and otpauth URI',
  tags: ['auth'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            secret: { type: 'string' },
            otpauthUri: { type: 'string' },
          },
        },
      },
    },
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};

// ─── POST /mfa/verify ──────────────────────────────────────────────────────
export const mfaVerifySchema: FastifySchema = {
  description: 'Verify TOTP code — confirms MFA setup or completes MFA login',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['code', 'mfaToken'],
    properties: {
      code: { type: 'string', minLength: 6, maxLength: 6, pattern: '^\\d{6}$', errorMessage: 'MFA code must be a 6-digit number' },
      mfaToken: { type: 'string', errorMessage: 'MFA token is required' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            mfaEnabled: { type: 'boolean' },
            tokens: tokensResponseSchema,
          },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};
