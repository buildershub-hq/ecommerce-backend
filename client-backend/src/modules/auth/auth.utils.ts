import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
}
