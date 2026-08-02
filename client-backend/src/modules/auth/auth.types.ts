// ─────────────────────────────────────────────────────────────────────────────
// auth.types.ts
// All types are based on the single `users` table.
// ─────────────────────────────────────────────────────────────────────────────

/** Matches every column in the `users` table */
export interface User {
  id: string;
  fullname: string;
  email: string;
  company: string;
  business_type: string;
  password_hash: string;
  role: string;
  status: 'active' | 'invited' | 'disabled';
  created_at: Date;
  updated_at: Date;
}

/** Shape embedded in every JWT */
export interface JWTPayload {
  id: string;
  role: string;
}

/** Shape returned by signup / login */
export interface AuthResponseData {
  user: {
    id: string;
    fullname: string;
    email: string;
    company: string;
    business_type: string;
    role: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}
