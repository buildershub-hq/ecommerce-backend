import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    global: true,
    max: 100, // default limit per IP
    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => {
      return {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          details: {
            limit: context.max,
            timeWindow: context.after,
          },
        },
      };
    },
  });
};

export default fp(rateLimitPlugin);
