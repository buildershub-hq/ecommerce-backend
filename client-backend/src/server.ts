import Fastify from 'fastify';
import ajvErrors from 'ajv-errors';
import { env } from './config/env';
import { buildApp } from './app';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  },
  ajv: {
    customOptions: {
      allErrors: true,
    },
    plugins: [ajvErrors as any],
  },
});

const start = async () => {
  try {
    // Register plugins and routes
    await buildApp(fastify);

    const address = await fastify.listen({ 
      port: env.PORT,
      host: '0.0.0.0'
    });
    fastify.log.info(`Server is now listening on ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();