import { Router } from 'express';
import db from '../config/db.js';
import jwt from 'jsonwebtoken';
import { publisher } from '../config/redis.js';
import { jwtSecret } from '../config/env.js';
import { getPgQueryCount } from '../config/db.js';
import { getRedisHitCount, getRedisMissCount } from '../config/redis.js';

const router = Router();

router.get('/metrics', (_req, res) => {
    res.json({
        pgQueryCount: getPgQueryCount(),
        redisHitCount: getRedisHitCount(),
        redisMissCount: getRedisMissCount(),
    });
});

//actual authentication

const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ 'error': 'unauthorized' });
    }

    try {
        req.user = jwt.verify(token, jwtSecret);
        next();
    }
    catch {
        return res.status(401).json({ 'error': 'Invalid token' });
    }
};

router.get("/channels", async (req, res) => {
    const result = await db.query(
        "SELECT id, name FROM channels ORDER BY name"
    );

    res.json(result.rows);
});

router.post('/post', auth, async (req, res) => {
    const { name, description } = req.body;

    const result = await db.query(
        'Insert into channels (name, description, created_by) values ($1,$2,$3) returning *',
        [name, description, req.user.userId]
    );

    res.json(result.rows[0]);
});

//loading previous messages in a chat - cursor(prevents jumping around of msgs when scrolling) based pagination
router.get('/channels/:id/messages', auth, async (req, res) => {
    const { limit = 50, before } = req.query;

    const params = [req.params.id, parseInt(limit)];

    let query = `
        select m.*, u.username, u.avatar_url
        from messages m
        JOIN users u on m.sender_id =u.id
        where m.channel_id=$1
    `;

    if (before) {
        query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $3)`;
        params.push(before);
    }

    //to pass new msgs first and then old msg at the bottom
    query += ` order by m.created_at desc limit $2`;

    const result = await db.query(query, params);

    res.json(result.rows.reverse());
});

router.get('/users', auth, async (req, res) => {
    const online = await publisher.sMembers('online_users');

    const result = await db.query(
        'SELECT id, username, avatar_url FROM users ORDER BY username'
    );

    const users = result.rows.map(u => ({
        ...u,
        online: online.includes(String(u.id))
    }));

    res.json(users);
});

router.get('/dm/:userId/messages', auth, async (req, res) => {
    const { userId } = req.user; //js object destructuring again. grabbbing userid of the requester, who is looki at screen rn

    const other = req.params.userId; //person with whome they r chatting. obtained from the url

    const result = await db.query(
        `
        SELECT m.*, u.username
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = $1 AND m.dm_to = $2)
           OR (m.sender_id = $2 AND m.dm_to = $1)
        ORDER BY m.created_at DESC
        LIMIT 50
        `,
        [userId, other]
    );

    res.json(result.rows.reverse());
});

export default router;
