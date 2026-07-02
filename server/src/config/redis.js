import { createClient } from 'redis';
import { redisUrl } from './env.js';

const publisher  = createClient({ url: redisUrl });
const subscriber = createClient({ url: redisUrl });

(async () => {
  await publisher.connect();
  await subscriber.connect();
})();

export { publisher, subscriber };
