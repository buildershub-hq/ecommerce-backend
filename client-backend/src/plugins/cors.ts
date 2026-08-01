import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
};

export default fp(corsPlugin);
