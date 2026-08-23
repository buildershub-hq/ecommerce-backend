import bcrypt from 'bcrypt';
import crypto from 'crypto';
import * as otpauth from 'otpauth';
import { env } from '../../config/env';

export class AuthUtils {
  /**
   * Hashes a plain-text password using bcrypt.
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, env.BCRYPT_ROUNDS);
  }

  /**
   * Compares a plain-text password with its hashed version.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a high-entropy cryptographically secure random hex string.
   */
  static generateRandomToken(bytesLength = 32): string {
    return crypto.randomBytes(bytesLength).toString('hex');
  }

  /**
   * Hashes a token string using SHA-256 (for secure database storage of refresh tokens).
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate a TOTP instance for a user.
   */
  static generateMfaSecret(userEmail: string): otpauth.TOTP {
    return new otpauth.TOTP({
      issuer: env.MFA_APP_NAME,
      label: userEmail,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new otpauth.Secret({ size: 20 }),
    });
  }

  /**
   * Validate a TOTP code against a base32 secret. Returns true if valid.
   */
  static verifyTotpCode(secretBase32: string, code: string): boolean {
    const totp = new otpauth.TOTP({
      issuer: env.MFA_APP_NAME,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: otpauth.Secret.fromBase32(secretBase32),
    });
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }
}
