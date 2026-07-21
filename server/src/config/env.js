const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'JWT_SECRET',
  'CLIENT_URL',
];

required.forEach((key) => {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
});

export const port = process.env.PORT || 3000;
export const databaseUrl = process.env.DATABASE_URL;
export const redisUrl = process.env.REDIS_URL;
export const github = {
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
};
export const jwtSecret = process.env.JWT_SECRET;
export const clientUrl = process.env.CLIENT_URL;

export const messageCacheLimit = Number(process.env.messageCacheLimit) || 100
export const messageCacheTtlSeconds = Number(process.env.messageCacheTtlSeconds) || 86400
