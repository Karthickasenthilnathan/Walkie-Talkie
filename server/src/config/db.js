import { Pool } from 'pg';
import { databaseUrl } from './env.js';

const pool = new Pool({ connectionString: databaseUrl });
pool.on('error', (err) => console.error('PG pool error:', err));

export default pool;
