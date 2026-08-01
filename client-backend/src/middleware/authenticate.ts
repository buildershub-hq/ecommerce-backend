import { FastifyRequest, FastifyReply } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      tenant_id: string;
      role: string;
    };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify() as { id: string; tenant_id: string; role: string };
    request.user = {
      id: payload.id,
      tenant_id: payload.tenant_id,
      role: payload.role,
    };
  } catch (err) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token.',
        details: null,
      },
    });
  }
}

