import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_db',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_EXPIRES_IN_DAYS: parseInt(process.env.REFRESH_EXPIRES_IN_DAYS || '30', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
};

export type Env = typeof env;
