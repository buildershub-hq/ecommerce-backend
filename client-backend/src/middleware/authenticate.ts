import { FastifyRequest, FastifyReply } from 'fastify';

// Extend @fastify/jwt so request.user is typed throughout the app
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id:   string;
      role: string;
    };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
      
    const payload = await request.jwtVerify() as { id: string; role: string };
    request.user  = { id: payload.id, role: payload.role };
  } catch {
    reply.status(401).send({
      error: {
        code:    'UNAUTHORIZED',
        message: 'Invalid or expired access token.',
        details: null,
      },
    });
  }
}
