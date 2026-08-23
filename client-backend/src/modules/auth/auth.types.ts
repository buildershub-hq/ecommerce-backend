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
  email_verified: boolean;
  mfa_secret: string | null;
  mfa_enabled: boolean;
  mfa_pending: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Shape embedded in every JWT */
export interface JWTPayload {
  id: string;
  role: string;
  purpose?: string;
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
  emailVerificationToken?: string;
}

/** Extended User with MFA + email verification columns */
export interface UserWithMfa extends User {
  email_verified: boolean;
  mfa_secret: string | null;
  mfa_enabled: boolean;
  mfa_pending: boolean;
}

/** Response when MFA is required during login */
export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
}

/** Union: login can return normal tokens OR mfa-required */
export type LoginResponseData = AuthResponseData | MfaRequiredResponse;
