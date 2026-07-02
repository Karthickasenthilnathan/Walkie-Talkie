import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';

import db from '../config/db.js';
import { github, jwtSecret, clientUrl } from '../config/env.js';

const router = Router();

router.get('/github', (req,res) =>{
  const url = `https://github.com/login/oauth/authorize?client_id=${github.clientId}&scope=read:user`; //scope is a specific permission. tells github what our app can access from it.
  res.redirect(url);
})

router.get('/github/callback', async (req,res) =>{
  const {code} = req.query;

  const tokenRes = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: github.clientId,
      client_secret: github.clientSecret,
      code
    },
    {
      headers:{
        accept:'application/json'
      }
    }
  )

  const accessToken = tokenRes.data.access_token;

  const userRes = await axios.get(
    'https://api.github.com/user',
    {
      headers:{
        Authorization: `Bearer ${accessToken}`
      }
    }
  )

  const {id, login, avatar_url } = userRes.data;

  const result = await db.query(
    'INSERT INTO users(github_id, username, avatar_url) VALUES($1, $2, $3) ON CONFLICT (github_id) DO UPDATE SET username = $2, avatar_url = $3 RETURNING *',
    [String(id), login, avatar_url]
  )

  const user = result.rows[0];

  const token = jwt.sign(
    {
      userId: user.id,
      userName: user.username,
    },
    jwtSecret,
    {
      expiresIn: '7d',
    }
  );

  res.redirect(`${clientUrl}/auth?token=${token}`);
})

export default router;
