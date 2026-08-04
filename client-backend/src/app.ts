import { FastifyInstance } from 'fastify';
import postgresPlugin from './plugins/postgres';
import jwtPlugin from './plugins/jwt';
import corsPlugin from './plugins/cors';
import rateLimitPlugin from './plugins/rate-limit';
import swaggerPlugin from './plugins/swagger';
import router from './routes';

export async function buildApp(fastify: FastifyInstance): Promise<FastifyInstance> {
  // 1. Register security & utility plugins
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(postgresPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(swaggerPlugin);

  // 2. Register API routing
  await fastify.register(router);
 
 

  // 3. Global error handling matching standard error response envelope
  fastify.setErrorHandler((error: any, request, reply) => {
    // Handle validation errors from Fastify schemas

      console.log("code", "statusCode");
    if (error.validation) {
      return reply.status(400).send({
     
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed.',
          details: error.validation.map((err: any) => ({
            field: err.instancePath || err.params?.missingProperty,
            message: err.message,
          })),
        },
      });
    }

    // Handle standard Fastify / custom errors
    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_SERVER_ERROR';
    const message = statusCode === 500 ? 'An unexpected internal error occurred.' : error.message;

  
    
    return reply.status(statusCode).send({
      error: {
        code,
        message,
        details: null,
      },
    });
  });

  return fastify;
}

export default buildApp;
