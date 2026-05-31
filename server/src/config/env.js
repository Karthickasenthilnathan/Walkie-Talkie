const required = ['DATABASE_URL', 'REDIS_URL', 'GITHUB_CLIENT_ID',
                  'GITHUB_CLIENT_SECRET', 'JWT_SECRET', 'CLIENT_URL'];

required.forEach(key => {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
});

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL,
};