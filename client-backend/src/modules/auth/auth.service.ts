import { Pool, PoolClient } from 'pg';
import { AuthRepository } from './auth.repository';
import { AuthUtils } from './auth.utils';
import { JWTPayload, AuthResponseData } from './auth.types';

export class AuthService {
  private authRepository: AuthRepository;
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
    this.authRepository = new AuthRepository();
  }

  /**
   * Timing attack mitigation helper.
   * Compares a dummy hash to waste similar CPU time when user is not found.
   */
  private async fakePasswordVerify(): Promise<void> {
    await AuthUtils.verifyPassword(
      'dummy_password',
      '$2b$12$L7R2R7W/aW6QdCpln7c3xO29L8n4y8fM98a.1234567890123456'
    );
  }

  /**
   * Registers a new Tenant and its Owner user in a secure transaction.
   */
  async signup(
    data: { companyName: string; slug: string; industry?: string; email: string; password: string },
    signToken: (payload: JWTPayload) => string
  ): Promise<AuthResponseData> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Check if tenant slug is taken
      const existingTenant = await this.authRepository.findTenantBySlug(client, data.slug);
      if (existingTenant) {
        throw new Error('TENANT_SLUG_TAKEN');
      }

      // 2. Create tenant
      const tenant = await this.authRepository.createTenant(client, {
        name: data.companyName,
        slug: data.slug,
        industry: data.industry,
      });

      // 3. Set the tenant ID session variable (for RLS enforcement)
      await this.authRepository.setSessionTenantId(client, tenant.id);

      // 4. Create default roles (Owner, Manager, Staff)
      const ownerRole = await this.authRepository.createRole(client, {
        tenant_id: tenant.id,
        name: 'Owner',
      });
      await this.authRepository.createRole(client, {
        tenant_id: tenant.id,
        name: 'Manager',
      });
      await this.authRepository.createRole(client, {
        tenant_id: tenant.id,
        name: 'Staff',
      });

      // 5. Seed default permissions if they don't exist
      // Since it's raw SQL, we insert standard permissions and assign them to Owner role
      const permissionsToSeed = [
        { key: 'users.manage', desc: 'Manage tenant users' },
        { key: 'orders.create', desc: 'Create sales orders' },
        { key: 'orders.read', desc: 'Read sales orders' },
        { key: 'orders.update', desc: 'Update sales orders' },
        { key: 'orders.delete', desc: 'Delete sales orders' },
        { key: 'inventory.read', desc: 'View inventory levels' },
        { key: 'inventory.adjust', desc: 'Adjust stock levels' },
      ];

      for (const perm of permissionsToSeed) {
        // Use UPSERT for permissions to avoid duplicates since it's global
        const permRes = await client.query(
          `INSERT INTO permissions (key, description)
           VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description
           RETURNING id`,
          [perm.key, perm.desc]
        );
        const permId = permRes.rows[0].id;

        // Assign all permissions to Owner role
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [ownerRole.id, permId]
        );
      }

      // 6. Hash password & Create user
      const passwordHash = await AuthUtils.hashPassword(data.password);
      const user = await this.authRepository.createUser(client, {
        tenant_id: tenant.id,
        email: data.email,
        password_hash: passwordHash,
      });

      // 7. Assign Owner role to user
      await this.authRepository.assignRoleToUser(client, {
        user_id: user.id,
        role_id: ownerRole.id,
      });

      // 8. Generate JWT access token & secure refresh token
      const accessToken = signToken({
        id: user.id,
        tenant_id: tenant.id,
        role: 'Owner',
      });

      const rawRefreshToken = AuthUtils.generateRandomToken();
      const refreshTokenHash = AuthUtils.hashToken(rawRefreshToken);
      
      // Expire in 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.authRepository.storeRefreshToken(client, {
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: expiresAt,
      });

      // 9. Write audit log
      await this.authRepository.createAuditLog(client, {
        tenant_id: tenant.id,
        actor_user_id: user.id,
        action: 'tenant.signup',
        entity_type: 'tenant',
        entity_id: tenant.id,
        metadata: { email: user.email, companyName: tenant.name },
      });

      await client.query('COMMIT');

      return {
        user: { id: user.id, email: user.email, role: 'Owner' },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        tokens: { accessToken, refreshToken: rawRefreshToken },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Authenticates a user based on tenant slug, email, and password.
   */
  async login(
    data: { slug: string; email: string; password: string },
    signToken: (payload: JWTPayload) => string
  ): Promise<AuthResponseData> {
    const client = await this.db.connect();
    try {
      // 1. Resolve tenant
      const tenant = await this.authRepository.findTenantBySlug(client, data.slug);
      if (!tenant) {
        // Mitigation: run fake password comparison to prevent timing verification hacks
        await this.fakePasswordVerify();
        throw new Error('INVALID_CREDENTIALS');
      }

      if (tenant.status === 'suspended') {
        throw new Error('TENANT_SUSPENDED');
      }

      // 2. Resolve user
      const user = await this.authRepository.findUserByEmail(client, tenant.id, data.email);
      if (!user || user.status === 'disabled') {
        await this.fakePasswordVerify();
        throw new Error('INVALID_CREDENTIALS');
      }

      // 3. Verify password
      const isPasswordValid = await AuthUtils.verifyPassword(data.password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // 4. Resolve user role
      const userDetails = await this.authRepository.findUserById(client, user.id);
      const roleName = userDetails?.role || 'Staff'; // fallback to Staff

      // 5. Generate tokens
      const accessToken = signToken({
        id: user.id,
        tenant_id: tenant.id,
        role: roleName,
      });

      const rawRefreshToken = AuthUtils.generateRandomToken();
      const refreshTokenHash = AuthUtils.hashToken(rawRefreshToken);
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.authRepository.storeRefreshToken(client, {
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: expiresAt,
      });

      // 6. Write audit log
      await this.authRepository.createAuditLog(client, {
        tenant_id: tenant.id,
        actor_user_id: user.id,
        action: 'user.login',
        entity_type: 'user',
        entity_id: user.id,
        metadata: { ip: 'unknown' },
      });

      return {
        user: { id: user.id, email: user.email, role: roleName },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        tokens: { accessToken, refreshToken: rawRefreshToken },
      };
    } finally {
      client.release();
    }
  }

  /**
   * Rotates access and refresh tokens.
   */
  async refresh(
    rawRefreshToken: string,
    signToken: (payload: JWTPayload) => string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const client = await this.db.connect();
    try {
      const tokenHash = AuthUtils.hashToken(rawRefreshToken);
      
      // 1. Find the refresh token
      const storedToken = await this.authRepository.findRefreshToken(client, tokenHash);
      if (!storedToken) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      // 2. Check if expired
      if (new Date() > storedToken.expires_at) {
        await this.authRepository.deleteRefreshToken(client, tokenHash);
        throw new Error('EXPIRED_REFRESH_TOKEN');
      }

      // 3. Resolve user details to sign new JWT
      const userDetails = await this.authRepository.findUserById(client, storedToken.user_id);
      if (!userDetails || userDetails.status === 'disabled') {
        await this.authRepository.deleteRefreshToken(client, tokenHash);
        throw new Error('USER_NOT_FOUND_OR_DISABLED');
      }

      // 4. Delete the used refresh token (Rotation / Single-use)
      await this.authRepository.deleteRefreshToken(client, tokenHash);

      // 5. Generate new access and refresh tokens
      const newAccessToken = signToken({
        id: userDetails.id,
        tenant_id: userDetails.tenant_id,
        role: userDetails.role,
      });

      const newRawRefreshToken = AuthUtils.generateRandomToken();
      const newRefreshTokenHash = AuthUtils.hashToken(newRawRefreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.authRepository.storeRefreshToken(client, {
        user_id: userDetails.id,
        token_hash: newRefreshTokenHash,
        expires_at: expiresAt,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Invalidates a refresh token (logout).
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const client = await this.db.connect();
    try {
      const tokenHash = AuthUtils.hashToken(rawRefreshToken);
      await this.authRepository.deleteRefreshToken(client, tokenHash);
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves profile details of the currently authenticated user.
   */
  async me(userId: string): Promise<{ id: string; email: string; role: string; tenant: { id: string; name: string; slug: string } }> {
    const client = await this.db.connect();
    try {
      const userDetails = await this.authRepository.findUserById(client, userId);
      if (!userDetails) {
        throw new Error('USER_NOT_FOUND');
      }

      // Resolve tenant details
      const query = 'SELECT id, name, slug FROM tenants WHERE id = $1';
      const tenantRes = await client.query(query, [userDetails.tenant_id]);
      const tenant = tenantRes.rows[0];

      return {
        id: userDetails.id,
        email: userDetails.email,
        role: userDetails.role,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
      };
    } finally {
      client.release();
    }
  }
}
