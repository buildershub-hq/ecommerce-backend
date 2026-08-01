import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Business Operations Platform - Client Backend API',
        description: 'Secure, multi-tenant client backend endpoints',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:5000',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Enter your Bearer token in the format: Bearer <token>',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });
};

export default fp(swaggerPlugin);
