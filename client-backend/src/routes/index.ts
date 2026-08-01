import { FastifyInstance } from 'fastify';
import authRoutes from '../modules/auth/auth.routes';

export async function router(fastify: FastifyInstance) {
  // Register version 1 API routing
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });

  // Index route
  fastify.get('/', async (request, reply) => {
    try {
      await fastify.db.query('SELECT 1');
      return {
        status: 'UP',
        message: 'Server is up and database is connected.',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        status: 'DOWN',
        message: 'Server is up but database connection failed.',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

export default router;
