import { Pool, PoolConfig } from 'pg';
import { env } from './env';

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'production' ? 20 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export default pool;
