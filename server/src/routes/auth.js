const router  = require('express').Router();
const axios   = require('axios');
const jwt     = require('jsonwebtoken');

const db      = require('../config/db');
const { github, jwtSecret, clientUrl } = require('../config/env');

// Step 1: Redirect to GitHub
router.get('/github', (req, res) => {
  const url = `https://github.com/login/oauth/authorize?client_id=${github.clientId}&scope=read:user`;
  res.redirect(url);
});

// Step 2: GitHub callback
router.get('/github/callback', async (req, res) => {
  const { code } = req.query;

  // Exchange code for access token
  const tokenRes = await axios.post('https://github.com/login/oauth/access_token',
    { client_id: github.clientId, client_secret: github.clientSecret, code },
    { headers: { Accept: 'application/json' } }
  );
  const accessToken = tokenRes.data.access_token;

  // Fetch GitHub user
  const userRes = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const { id, login, avatar_url } = userRes.data;

  // Upsert user in DB
  const result = await db.query(`
    INSERT INTO users (github_id, username, avatar_url)
    VALUES ($1, $2, $3)
    ON CONFLICT (github_id) DO UPDATE
      SET username = $2, avatar_url = $3
    RETURNING *
  `, [String(id), login, avatar_url]);

  const user = result.rows[0];
  const token = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, { expiresIn: '7d' });

  // Redirect CLI client with token
  res.redirect(`${clientUrl}/auth?token=${token}`);
});

module.exports = router;