import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { JWTPayload } from './auth.types';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  // 1. POST /signup
  async signup(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const signToken = (payload: JWTPayload) => request.server.jwt.sign(payload);
      const body = request.body as any;
      
      const result = await this.authService.signup(body, signToken);
      
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      request.log.error(err);
      
      if (err.message === 'TENANT_SLUG_TAKEN') {
        return reply.status(409).send({
          error: {
            code: 'TENANT_SLUG_TAKEN',
            message: 'A company with this URL slug already exists.',
            details: null,
          },
        });
      }

      // Check unique constraint violation from postgres (code 23505)
      if (err.code === '23505') {
        return reply.status(409).send({
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'A user with this email address already exists for this tenant.',
            details: null,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while creating your account.',
          details: null,
        },
      });
    }
  }

  // 2. POST /login
  async login(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const signToken = (payload: JWTPayload) => request.server.jwt.sign(payload);
      const body = request.body as any;
      
      const result = await this.authService.login(body, signToken);
      
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      request.log.error(err);
      
      if (err.message === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email or password is incorrect.',
            details: null,
          },
        });
      }

      if (err.message === 'TENANT_SUSPENDED') {
        return reply.status(403).send({
          error: {
            code: 'TENANT_SUSPENDED',
            message: 'This account has been suspended. Please contact support.',
            details: null,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during login.',
          details: null,
        },
      });
    }
  }

  // 3. POST /refresh
  async refresh(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const signToken = (payload: JWTPayload) => request.server.jwt.sign(payload);
      const body = request.body as any;
      
      const result = await this.authService.refresh(body.refreshToken, signToken);
      
      return reply.status(200).send({
        success: true,
        data: { tokens: result },
      });
    } catch (err: any) {
      request.log.error(err);
      
      if (
        err.message === 'INVALID_REFRESH_TOKEN' ||
        err.message === 'EXPIRED_REFRESH_TOKEN' ||
        err.message === 'USER_NOT_FOUND_OR_DISABLED'
      ) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'The provided refresh token is invalid or expired.',
            details: null,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during token refresh.',
          details: null,
        },
      });
    }
  }

  // 4. POST /logout
  async logout(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const body = request.body as any;
      await this.authService.logout(body.refreshToken);
      return reply.status(200).send({
        success: true,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during logout.',
          details: null,
        },
      });
    }
  }

  // 5. GET /me
  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            details: null,
          },
        });
      }

      const result = await this.authService.me(request.user.id);
      
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while fetching profile.',
          details: null,
        },
      });
    }
  }
}
