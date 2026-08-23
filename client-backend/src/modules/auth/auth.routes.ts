import { FastifyInstance } from "fastify";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  meSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  mfaEnableSchema,
  mfaVerifySchema,
} from "./auth.schema";
import { authenticate } from "../../middleware/authenticate";

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.db);
  const authController = new AuthController(authService);

  // Sign up (Rate limit: 5 registrations per minute per IP)
  fastify.post(
    "/signup",
    {
      schema: signupSchema,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    (req, reply) => authController.signup(req, reply),
  );

  // Log in (Rate limit: 5 attempts per minute per IP to prevent brute-force)
  fastify.post(
    "/login",
    {
      schema: loginSchema,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    (req, reply) => {
      authController.login(req, reply);
 
    },
  );

  // Refresh Token
  fastify.post(
    "/refresh",
    {
      schema: refreshSchema,
    },
    (req, reply) => authController.refresh(req, reply),
  );

  // Log out
  fastify.post(
    "/logout",
    {
      schema: logoutSchema,
    },
    (req, reply) => authController.logout(req, reply),
  );

  // Current logged in user info (JWT Authenticated)
  fastify.get(
    "/me",
    {
      schema: meSchema,
      preHandler: [authenticate],
    },
    (req, reply) => authController.me(req, reply),
  );

  // Forgot Password (Rate limit: 5/min)
  fastify.post(
    "/forgot-password",
    {
      schema: forgotPasswordSchema,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    (req, reply) => authController.forgotPassword(req, reply),
  );

  // Reset Password (Rate limit: 5/min)
  fastify.post(
    "/reset-password",
    {
      schema: resetPasswordSchema,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    (req, reply) => authController.resetPassword(req, reply),
  );

  // Verify Email
  fastify.post(
    "/verify-email",
    { schema: verifyEmailSchema },
    (req, reply) => authController.verifyEmail(req, reply),
  );

  // MFA Enable (JWT authenticated)
  fastify.post(
    "/mfa/enable",
    {
      schema: mfaEnableSchema,
      preHandler: [authenticate],
    },
    (req, reply) => authController.mfaEnable(req, reply),
  );

  // MFA Verify (Rate limit: 5/min)
  fastify.post(
    "/mfa/verify",
    {
      schema: mfaVerifySchema,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    (req, reply) => authController.mfaVerify(req, reply),
  );
}

export default authRoutes;
