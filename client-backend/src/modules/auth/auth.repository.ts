import { Pool, PoolClient } from 'pg';
import { Tenant, User } from './auth.types';

export class AuthRepository {
  // 1. Find tenant by slug
  async findTenantBySlug(client: Pool | PoolClient, slug: string): Promise<Tenant | null> {
    const query = `
      SELECT id, name, slug, industry, status, plan_id, created_at, updated_at
      FROM tenants
      WHERE slug = $1
    `;
    const res = await client.query(query, [slug]);
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  // 2. Create tenant
  async createTenant(
    client: Pool | PoolClient,
    data: { name: string; slug: string; industry?: string }
  ): Promise<Tenant> {
    const query = `
      INSERT INTO tenants (name, slug, industry, status)
      VALUES ($1, $2, $3, 'trial')
      RETURNING id, name, slug, industry, status, plan_id, created_at, updated_at
    `;
    const res = await client.query(query, [data.name, data.slug, data.industry || null]);
    return res.rows[0];
  }

  // 3. Find user by email within tenant scope
  async findUserByEmail(
    client: Pool | PoolClient,
    tenantId: string,
    email: string
  ): Promise<User | null> {
    const query = `
      SELECT id, tenant_id, email, password_hash, status, created_at, updated_at
      FROM users
      WHERE tenant_id = $1 AND email = $2
    `;
    const res = await client.query(query, [tenantId, email.toLowerCase()]);
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  // 4. Create user
  async createUser(
    client: Pool | PoolClient,
    data: { tenant_id: string; email: string; password_hash: string; status?: string }
  ): Promise<User> {
    const query = `
      INSERT INTO users (tenant_id, email, password_hash, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, tenant_id, email, password_hash, status, created_at, updated_at
    `;
    const res = await client.query(query, [
      data.tenant_id,
      data.email.toLowerCase(),
      data.password_hash,
      data.status || 'active',
    ]);
    return res.rows[0];
  }

  // 5. Find user by ID along with their role and tenant info
  async findUserById(
    client: Pool | PoolClient,
    userId: string
  ): Promise<{ id: string; email: string; status: string; tenant_id: string; role: string } | null> {
    const query = `
      SELECT u.id, u.email, u.status, u.tenant_id, r.name as role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1
    `;
    const res = await client.query(query, [userId]);
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  // 6. Create a role for a tenant
  async createRole(
    client: Pool | PoolClient,
    data: { tenant_id: string; name: string }
  ): Promise<{ id: string; name: string }> {
    const query = `
      INSERT INTO roles (tenant_id, name)
      VALUES ($1, $2)
      RETURNING id, name
    `;
    const res = await client.query(query, [data.tenant_id, data.name]);
    return res.rows[0];
  }

  // 7. Find role by name for a tenant
  async findRoleByName(
    client: Pool | PoolClient,
    tenantId: string,
    name: string
  ): Promise<{ id: string; name: string } | null> {
    const query = `
      SELECT id, name
      FROM roles
      WHERE tenant_id = $1 AND name = $2
    `;
    const res = await client.query(query, [tenantId, name]);
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  // 8. Assign role to a user
  async assignRoleToUser(
    client: Pool | PoolClient,
    data: { user_id: string; role_id: string }
  ): Promise<void> {
    const query = `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `;
    await client.query(query, [data.user_id, data.role_id]);
  }

  // 9. Store refresh token hash
  async storeRefreshToken(
    client: Pool | PoolClient,
    data: { user_id: string; token_hash: string; expires_at: Date }
  ): Promise<void> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    await client.query(query, [data.user_id, data.token_hash, data.expires_at]);
  }

  // 10. Find refresh token details
  async findRefreshToken(
    client: Pool | PoolClient,
    tokenHash: string
  ): Promise<{ id: string; user_id: string; token_hash: string; expires_at: Date } | null> {
    const query = `
      SELECT id, user_id, token_hash, expires_at
      FROM refresh_tokens
      WHERE token_hash = $1
    `;
    const res = await client.query(query, [tokenHash]);
    return res.rowCount && res.rowCount > 0 ? res.rows[0] : null;
  }

  // 11. Delete a refresh token
  async deleteRefreshToken(client: Pool | PoolClient, tokenHash: string): Promise<void> {
    const query = `
      DELETE FROM refresh_tokens
      WHERE token_hash = $1
    `;
    await client.query(query, [tokenHash]);
  }

  // 12. Delete all refresh tokens for a user (security breach mitigation)
  async deleteAllUserRefreshTokens(client: Pool | PoolClient, userId: string): Promise<void> {
    const query = `
      DELETE FROM refresh_tokens
      WHERE user_id = $1
    `;
    await client.query(query, [userId]);
  }

  // 13. Create audit log
  async createAuditLog(
    client: Pool | PoolClient,
    data: {
      tenant_id: string | null;
      actor_user_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string;
      metadata: Record<string, any>;
    }
  ): Promise<void> {
    const query = `
      INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await client.query(query, [
      data.tenant_id,
      data.actor_user_id,
      data.action,
      data.entity_type,
      data.entity_id,
      JSON.stringify(data.metadata),
    ]);
  }

  // Helper to ensure tenant ID is set in the session (useful for row-level security)
  async setSessionTenantId(client: PoolClient, tenantId: string): Promise<void> {
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
  }
}
