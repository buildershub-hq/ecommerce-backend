import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { pool } from '../config/database';
import { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

const postgresPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('db', pool);

  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Closing database pool...');
    await pool.end();
  });
};

export default fp(postgresPlugin);
