import { FastifySchema } from 'fastify';

// Error response structure matching readme.md
const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object', nullable: true },
      },
    },
  },
};

export const signupSchema: FastifySchema = {
  description: 'Sign up a new tenant and owner user',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['companyName', 'slug', 'email', 'password'],
    properties: {
      companyName: { 
        type: 'string', 
        minLength: 2, 
        maxLength: 255,
        errorMessage: 'Company name must be between 2 and 255 characters'
      },
      slug: { 
        type: 'string', 
        minLength: 3, 
        maxLength: 100,
        pattern: '^[a-z0-9-]+$',
        errorMessage: 'Slug must be alphanumeric with hyphens only'
      },
      industry: { type: 'string', maxLength: 100 },
      email: { 
        type: 'string', 
        format: 'email',
        errorMessage: 'Must be a valid email address'
      },
      password: { 
        type: 'string', 
        minLength: 8,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$',
        description: 'At least 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character'
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
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
            tenant: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                slug: { type: 'string' },
              },
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    400: errorResponseSchema,
    409: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export const loginSchema: FastifySchema = {
  description: 'Log in with email, password, and tenant slug',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['slug', 'email', 'password'],
    properties: {
      slug: { type: 'string', minLength: 3, pattern: '^[a-z0-9-]+$' },
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
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
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
            tenant: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                slug: { type: 'string' },
              },
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export const refreshSchema: FastifySchema = {
  description: 'Rotate access and refresh tokens using a valid refresh token',
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
          properties: {
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export const logoutSchema: FastifySchema = {
  description: 'Log out a user and invalidate their current refresh token',
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
      },
    },
    400: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export const meSchema: FastifySchema = {
  description: 'Get active user profile and tenant details',
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
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            role: { type: 'string' },
            tenant: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                slug: { type: 'string' },
              },
            },
          },
        },
      },
    },
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
};
