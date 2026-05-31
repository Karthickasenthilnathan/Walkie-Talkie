const { createClient } = require('redis');
const { redisUrl } = require('./env');

const publisher  = createClient({ url: redisUrl });
const subscriber = createClient({ url: redisUrl });

(async () => {
  await publisher.connect();
  await subscriber.connect();
})();

module.exports = { publisher, subscriber };