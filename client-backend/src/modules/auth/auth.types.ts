export interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  status: 'active' | 'suspended' | 'trial' | 'cancelled';
  plan_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  status: 'active' | 'invited' | 'disabled';
  created_at: Date;
  updated_at: Date;
}

export interface JWTPayload {
  id: string;
  tenant_id: string;
  role: string;
}

export interface AuthResponseData {
  user: {
    id: string;
    email: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}
