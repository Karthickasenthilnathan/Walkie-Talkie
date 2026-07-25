import { createClient } from 'redis';
import { redisUrl } from './env.js';

const publisher  = createClient({ url: redisUrl });
const subscriber = createClient({ url: redisUrl });

// Replay instrumentation used by the benchmark metrics endpoint.
let redisHitCount = 0;
let redisMissCount = 0;

export function getRedisHitCount() { return redisHitCount; }
export function getRedisMissCount() { return redisMissCount; }
export function incrementRedisHitCount() { redisHitCount += 1; }
export function incrementRedisMissCount() { redisMissCount += 1; }
export function resetRedisCounts() {
  redisHitCount = 0;
  redisMissCount = 0;
}

(async () => {
  await publisher.connect();
  await subscriber.connect();
})();

export { publisher, subscriber };
