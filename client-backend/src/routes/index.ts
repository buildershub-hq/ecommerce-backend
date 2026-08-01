import { FastifyInstance } from 'fastify';
import authRoutes from '../modules/auth/auth.routes';

export async function router(fastify: FastifyInstance) {
  // Register version 1 API routing
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
}

export default router;
