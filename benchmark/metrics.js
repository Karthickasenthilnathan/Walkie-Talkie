const REPLAY_BUCKETS = ['50', '200', '1000'];

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new RangeError('p must be between 0 and 1, or 0 and 100');
  }
  // Accept both common forms: percentile(arr, 0.95) and percentile(arr, 95).
  const percentileValue = p <= 1 ? p * 100 : p;

  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const index = (percentileValue / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];

  // Linear interpolation avoids the bias caused by rounding to a bucket.
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

class Metrics {
  constructor() {
    this.latencies = [];
    this.replay = Object.fromEntries(REPLAY_BUCKETS.map((bucket) => [bucket, []]));
  }

  recordLatency(ms) {
    const value = finiteNumber(ms);
    if (value !== null) this.latencies.push(value);
    return this;
  }

  recordReplay(bucket, ms) {
    const key = String(bucket);
    if (!REPLAY_BUCKETS.includes(key)) {
      throw new RangeError(`Unknown replay bucket: ${bucket}`);
    }

    const value = finiteNumber(ms);
    if (value !== null) this.replay[key].push(value);
    return this;
  }

  summary() {
    return {
      latency: stats(this.latencies),
      replay: Object.fromEntries(
        REPLAY_BUCKETS.map((bucket) => [bucket, stats(this.replay[bucket])]),
      ),
    };
  }
}

function stats(values) {
  const numeric = values.filter(Number.isFinite);
  const count = numeric.length;
  if (count === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      p50: null,
      p95: null,
      p99: null,
    };
  }

  return {
    count,
    min: Math.min(...numeric),
    max: Math.max(...numeric),
    mean: numeric.reduce((sum, value) => sum + value, 0) / count,
    p50: percentile(numeric, 50),
    p95: percentile(numeric, 95),
    p99: percentile(numeric, 99),
  };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export { Metrics, percentile, REPLAY_BUCKETS };
export default Metrics;
