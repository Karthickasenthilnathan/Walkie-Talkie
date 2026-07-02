// server/src/app.js
import 'dotenv/config';

import './config/env.js'; // Validates env vars at startup — throws if anything's missing
import http from 'node:http';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import setupSocket from './socket/index.js';

import { port } from './config/env.js';
import pool from './config/db.js';
import { publisher, subscriber } from './config/redis.js';

const app    = express();
const server = http.createServer(app);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);   // GitHub OAuth: /auth/github, /auth/github/callback
app.use('/api',  apiRoutes);    // REST: /api/channels, /api/users, /api/dm/:id/messages

// Health check (useful for Docker / load balancer)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Socket.IO ───────────────────────────────────────────────────────────────
setupSocket(server);   // attaches io to the same http server

// ── Start ───────────────────────────────────────────────────────────────────
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(async () => {
    await pool.end();
    await publisher.quit();
    await subscriber.quit();
    console.log('All connections closed. Bye!');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
