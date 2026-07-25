import 'dotenv/config';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const jwtSecret = process.env.JWT_SECRET;

export async function seedBenchmarkData(userCount = 100) {
  if (!Number.isInteger(userCount) || userCount <= 0) {
    throw new Error('userCount must be a positive integer');
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is missing');
  }

  const users = [];

  for (let index = 0; index < userCount; index++) {
    const githubId = `benchmark-${index}`;
    const username = `benchmark_user_${index}`;

    const result = await pool.query(
      `
      INSERT INTO users (github_id, username, avatar_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (github_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url
      RETURNING id, github_id, username, avatar_url
      `,
      [
        githubId,
        username,
        'https://example.com/benchmark-avatar.png',
      ],
    );

    const user = result.rows[0];

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      jwtSecret,
      {
        expiresIn: '7d',
      },
    );

    users.push({
      ...user,
      token,
    });
  }

  const channelResult = await pool.query(
    `
    INSERT INTO channels (name, description)
    VALUES ($1, $2)
    ON CONFLICT (name)
    DO UPDATE SET description = EXCLUDED.description
    RETURNING id, name, description
    `,
    ['benchmark', 'Load-testing channel'],
  );

  return {
    users,
    channelId: channelResult.rows[0].id,
  };
}

export async function closeSeedDatabase() {
  await pool.end();
}