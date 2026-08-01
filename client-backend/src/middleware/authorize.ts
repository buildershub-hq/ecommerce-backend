import { FastifyRequest, FastifyReply } from 'fastify';

export function authorize(requiredPermission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
          details: null,
        },
      });
    }

    const { id: userId } = request.user;
    
    try {
      const db = request.server.db;
      
      // Enforce permission checks by joining user_roles, role_permissions and permissions
      const query = `
        SELECT 1 
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1 AND p.key = $2
      `;
      
      const res = await db.query(query, [userId, requiredPermission]);
      
      if (res.rowCount === 0) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action.',
            details: null,
          },
        });
      }
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error verifying authorizations.',
          details: null,
        },
      });
    }
  };
}
