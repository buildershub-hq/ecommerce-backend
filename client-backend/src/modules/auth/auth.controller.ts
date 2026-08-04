import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { JWTPayload } from './auth.types';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  // ── POST /signup ────────────────────────────────────────────────────────────
  async signup(request: FastifyRequest, reply: FastifyReply) {
    try {
      const signToken = (payload: JWTPayload) => request.server.jwt.sign(payload);
      const result = await this.authService.signup(request.body as any, signToken);
      return reply.status(201).send({ success: true, data: result });
    } catch (err: any) {
      request.log.error(err);

      if (err.message === 'EMAIL_ALREADY_EXISTS' || err.code === '23505') {
        return reply.status(409).send({
          error: {
            code:    'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists.',
            details: null,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code:    'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while creating your account.',
          details: null,
        },
      });
    }
  }

  // ── POST /login ─────────────────────────────────────────────────────────────
  async login(request: FastifyRequest, reply: FastifyReply) {
         console.log(
           "inside login",
         );
    try {
      const signToken = (payload: JWTPayload) => request.server.jwt.sign(payload);
      const result = await this.authService.login(request.body as any, signToken);
      
      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
  
      request.log.error(err);

      if (err.message === 'INVALID_CREDENTIALS') {
        return reply.status(401).send({
          error: {
            code:    'INVALID_CREDENTIALS',
            message: 'Email or password is incorrect.',
            details: null,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code:    'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during login.',
          details: null,
        },
      });
    }
  }

  // ── POST /refresh ───────────────────────────────────────────────────────────
  async refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
      const signToken = (payload: JWTPayload) => request.server.jwt.sign(payload);
      const body = request.body as any;
      const result = await this.authService.refresh(body.refreshToken, signToken);
      return reply.status(200).send({ success: true, data: { tokens: result } });
    } catch (err: any) {
      request.log.error(err);

      if (
        err.message === 'INVALID_REFRESH_TOKEN'  ||
        err.message === 'EXPIRED_REFRESH_TOKEN'  ||
        err.message === 'USER_NOT_FOUND_OR_DISABLED'
      ) {
        return reply.status(401).send({
          error: {
            code:    'INVALID_REFRESH_TOKEN',
            message: 'The provided refresh token is invalid or expired.',
            details: null,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code:    'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during token refresh.',
          details: null,
        },
      });
    }
  }

  // ── POST /logout ─────────────────────────────────────────────────────────────
  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      await this.authService.logout(body.refreshToken);
      return reply.status(200).send({ success: true });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          code:    'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during logout.',
          details: null,
        },
      });
    }
  }

  // ── GET /me ──────────────────────────────────────────────────────────────────
  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
       
      if (!request.user) {
        return reply.status(401).send({
          error: {
            code:    'UNAUTHORIZED',
            message: 'Authentication required.',
            details: null,
          },
        });
      }

      const result = await this.authService.me(request.user.id);
      return reply.status(200).send({ success: true, data: result });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          code:    'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while fetching your profile.',
          details: null,
        },
      });
    }
  }
}
