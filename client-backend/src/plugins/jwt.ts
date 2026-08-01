import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import jwtConfig from '../config/jwt';

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: jwtConfig.secret,
    sign: jwtConfig.sign,
  });
};

export default fp(jwtPlugin);
