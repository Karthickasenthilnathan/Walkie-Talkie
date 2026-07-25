import { Pool } from 'pg';
import { databaseUrl } from './env.js';

const pool = new Pool({ connectionString: databaseUrl });
pool.on('error', (err) => console.error('PG pool error:', err));

// ── Benchmark instrumentation ────────────────────────────────────────────────
// Counts every query executed against PostgreSQL.
// Exposed via GET /api/metrics for the benchmark runner.
let pgQueryCount = 0;

export function getPgQueryCount() { return pgQueryCount; }
export function resetPgQueryCount() { pgQueryCount = 0; }

// Wrap pool.query so every call increments the counter.
const originalQuery = pool.query.bind(pool);
pool.query = (...args) => {
    pgQueryCount++;
    return originalQuery(...args);
};

export default pool;
