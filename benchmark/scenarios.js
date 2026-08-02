import 'dotenv/config';
import { createClient } from 'redis';
import BenchmarkClient from './client.js';
import Metrics from './metrics.js';
import { seedBenchmarkData } from './seed.js';

const DEFAULT_URL = process.env.BENCHMARK_URL || 'http://localhost:3000';
const DEFAULT_WARMUP_MS = Number(process.env.BENCHMARK_WARMUP_MS || 10_000);
const SEND_INTERVAL_MS = Number(process.env.BENCHMARK_SEND_INTERVAL_MS || 10);
const REPLAY_TIMEOUT_MS = Number(process.env.BENCHMARK_REPLAY_TIMEOUT_MS || 5_000);

export async function runScenario(mode, clientCount, missedCount) {
  validateInputs(mode, clientCount, missedCount);

  const metrics = new Metrics();
  const errors = [];
  const countersBefore = await readServerMetrics();
  const replayCounters = [];
  const seeded = await seedBenchmarkData(clientCount);
  const clients = seeded.users.map((user) => new BenchmarkClient({
    url: DEFAULT_URL,

    token: user.token,
    socketOptions: {
    transports: ['websocket'],
    upgrade: false,
  },
  }));

  const half = Math.ceil(clients.length / 2);
  const disconnected = clients.slice(0, half);
  const connected = clients.slice(half);
  let operations = 0;

  try {
    // Phase 1: connect and join.
    await settle(clients.map((client) => client.connect()), errors);
    await settle(clients.map((client) => joinChannel(client, seeded.channelId)), errors);
    // The server only forwards live traffic after a successful resume marks
    // the socket as caught up. Start every client at the beginning of history.
    await settle(
      clients.map((client) => resumeAndWait(client, seeded.channelId, null)),
      errors,
    );

    // Phase 2: warm-up traffic for the configured ten-second window.
    operations += await sendFor(clients, seeded.channelId, DEFAULT_WARMUP_MS, metrics);

    // Phase 3: disconnect half, preserving each client's last cursor.
    const cursors = new Map(disconnected.map((client) => [client, client.lastSeq]));
    disconnected.forEach((client) => client.disconnect());

    // Phase 4: send exactly missedCount messages while half are offline.
    operations += await sendMessages(connected, seeded.channelId, missedCount, metrics);

    // PostgreSQL-only mode clears the recent-message cache immediately before replay.
    if (mode === 'postgresql') await flushRecentMessages(seeded.channelId);

    // Phase 5: reconnect and replay from each client's saved cursor.
    for (const client of disconnected) {
      try {
        await client.connect();
        await joinChannel(client, seeded.channelId);
        const replayBefore = await readServerMetrics();
        const started = Date.now();
        await resumeAndWait(client, seeded.channelId, cursors.get(client));
        metrics.recordReplay(String(missedCount), Date.now() - started);
        const replayAfter = await readServerMetrics();
        const replayDelta = counterDelta(replayBefore, replayAfter);
        replayCounters.push(replayDelta);
      } catch (error) {
        errors.push(error);
      }
    }

    // Phase 6: verify that replayed clients receive live traffic again.
    operations += await sendMessages(clients, seeded.channelId, Math.max(1, clients.length), metrics);
  } finally {
    clients.forEach((client) => client.disconnect());
  }

  const countersAfter = await readServerMetrics();
  return {
    mode,
    clientCount,
    missedCount,
    metrics: metrics.summary(),
    samples: {
      latency: [...metrics.latencies],
      replay: Object.fromEntries(Object.entries(metrics.replay).map(([key, values]) => [key, [...values]])),
    },
    counters: counterDelta(countersBefore, countersAfter),
    replayCounters,
    errors: errors.length,
    totalOperations: Math.max(operations, 1),
  };
}

async function sendFor(clients, channelId, durationMs, metrics) {
  const started = Date.now();
  let operations = 0;
  let index = 0;
  while (Date.now() - started < durationMs) {
    const client = clients[index++ % clients.length];
    client.send({ channelId, content: `benchmark sentAt:${Date.now()}` });
    operations += 1;
    await delay(SEND_INTERVAL_MS);
  }
  collectLatencies(clients, metrics);
  return operations;
}

async function sendMessages(clients, channelId, count, metrics) {
  if (clients.length === 0) return 0;
  for (let index = 0; index < count; index += 1) {
    clients[index % clients.length].send({
      channelId,
      content: `benchmark sentAt:${Date.now()}`,
    });
    await delay(SEND_INTERVAL_MS);
  }
  await delay(50);
  collectLatencies(clients, metrics);
  return count;
}

function collectLatencies(clients, metrics) {
  for (const client of clients) {
    const cursor = client._metricsCursor || 0;
    for (const latency of client.latencies.slice(cursor)) metrics.recordLatency(latency);
    client._metricsCursor = client.latencies.length;
  }
}

function joinChannel(client, channelId) {
  return waitForEvent(client.socket, 'channel:joined', () => client.join(channelId));
}

function resumeAndWait(client, channelId, cursor) {
  return waitForEvent(
    client.socket,
    'resume_complete',
    () => client.resume({ channelId, lastCursor: cursor }),
    REPLAY_TIMEOUT_MS,
  );
}

function waitForEvent(socket, event, action, timeout = REPLAY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    const onEvent = (...args) => {
      clearTimeout(timer);
      resolve(args[0]);
    };
    socket.once(event, onEvent);
    action();
  });
}

async function flushRecentMessages(channelId) {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  try {
    await redis.del(`channel:${channelId}:recent_messages`);
  } finally {
    await redis.quit();
  }
}

async function readServerMetrics() {
  try {
    const response = await fetch(`${DEFAULT_URL}/api/metrics`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function counterDelta(before, after) {
  if (!before || !after) return { pgQueryCount: null, redisHitCount: null, redisMissCount: null };
  return {
    pgQueryCount: after.pgQueryCount - before.pgQueryCount,
    redisHitCount: after.redisHitCount - before.redisHitCount,
    redisMissCount: after.redisMissCount - before.redisMissCount,
  };
}

function validateInputs(mode, clientCount, missedCount) {
  if (!['postgresql', 'redis'].includes(mode)) throw new Error(`Unsupported mode: ${mode}`);
  if (!Number.isInteger(clientCount) || clientCount <= 0) throw new Error('clientCount must be positive');
  if (!['50', '200', '1000'].includes(String(missedCount))) {
    throw new Error('missedCount must be 50, 200, or 1000');
  }
}

async function settle(promises, errors) {
  const results = await Promise.allSettled(promises);
  results.filter((result) => result.status === 'rejected').forEach((result) => errors.push(result.reason));
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
