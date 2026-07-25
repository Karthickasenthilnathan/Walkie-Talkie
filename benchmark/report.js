import { percentile } from './metrics.js';

export function printReport(results, output = console.log) {
  const postgres = results.filter((result) => result.mode === 'postgresql');
  const redis = results.filter((result) => result.mode === 'redis');
  const rows = [
    ['Replay p50', replayPercentile(postgres, 50), replayPercentile(redis, 50)],
    ['Replay p95', replayPercentile(postgres, 95), replayPercentile(redis, 95)],
    ['Replay p99', replayPercentile(postgres, 99), replayPercentile(redis, 99)],
    ['DB queries/replay', averageReplayCounter(postgres, 'pgQueryCount'), averageReplayCounter(redis, 'pgQueryCount')],
    ['Redis hits', '-', sumReplayCounter(redis, 'redisHitCount')],
    ['500 clients latency p50', ...latencyAt(postgres, redis, 500)],
    ['1000 clients latency p50', ...latencyAt(postgres, redis, 1000)],
    ['Error rate', errorRate(postgres), errorRate(redis)],
  ];

  const lines = [
    '                         PostgreSQL-only     Redis + PostgreSQL',
    ...rows.map(([label, left, right]) => `${label.padEnd(26)}${format(left).padStart(12)}${format(right).padStart(22)}`),
  ];
  output(lines.join('\n'));
  return lines.join('\n');
}

function replayPercentile(results, p) {
  return percentile(results.flatMap((result) => Object.values(result.samples?.replay || {}).flat()), p);
}

function latencyAt(leftResults, rightResults, clientCount) {
  return [
    percentile(leftResults.filter((r) => r.clientCount === clientCount).flatMap((r) => r.samples?.latency || []), 50),
    percentile(rightResults.filter((r) => r.clientCount === clientCount).flatMap((r) => r.samples?.latency || []), 50),
  ];
}

function averageCounter(results, key) {
  const values = results.map((result) => result.counters?.[key]).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function averageReplayCounter(results, key) {
  const values = results.flatMap((result) => result.replayCounters || [])
    .map((counter) => counter[key])
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sumReplayCounter(results, key) {
  const values = results.flatMap((result) => result.replayCounters || [])
    .map((counter) => counter[key])
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function sumCounter(results, key) {
  const values = results.map((result) => result.counters?.[key]).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function errorRate(results) {
  const operations = results.reduce((sum, result) => sum + (result.totalOperations || 0), 0);
  const errors = results.reduce((sum, result) => sum + (result.errors || 0), 0);
  return operations ? (errors / operations) * 100 : null;
}

function format(value) {
  if (Array.isArray(value)) return value.map(format).join(' / ');
  if (value === null || value === undefined) return '?';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

export default printReport;
