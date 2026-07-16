import db from '../../config/db.js';

export default (io, socket, publisher) => {
    const { userId } = socket.user; //js object destructuring. grabs the userid from the user who has undergone jwt authentication

    //channel message
    socket.on("resume", async ({ channelId, lastCursor }) => {
    try {
        if (!channelId) {
            socket.emit("resume_complete");
            return;
        }

        if (lastCursor == null) {
            socket.data.caughtUp = true;
            socket.emit("resume_complete");
            return;
        }

        const result = await db.query(
            `
            SELECT *
            FROM messages
            WHERE channel_id = $1
              AND seq > $2
            ORDER BY seq ASC;
            `,
            [channelId, lastCursor]
        );

        for (const message of result.rows) {
            socket.emit("message:new", message);
        }

        socket.data.caughtUp = true;
        socket.emit("resume_complete");
    } catch (err) {
        console.error("Resume replay failed:", err);

        // Doesn't leave the client waiting forever.
        socket.data.caughtUp=true
        socket.emit("resume_complete");
    }
});
    socket.on('message:send', async ({ channelId, content, type = 'text', language }) => {

    const result = await db.query(
        `INSERT INTO messages(sender_id, channel_id, content, type, language)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [userId, channelId, content, type, language]
    );

    const msg = result.rows[0];

    const realtimeMessage = {
        ...msg,
        username: socket.user.username,
    };

    await publisher.publish(
        'chat',
        JSON.stringify({
            room: `channel:${channelId}`,
            event: 'message:new',
            payload: realtimeMessage,
        })
    );
});

    //logic for dming each other
    socket.on('dm:send', async ({ toUserId, content, type = 'text', language }) => {

        const result = await db.query(
            `INSERT INTO messages(sender_id, dm_to, content, type, language)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING *`,
            [userId, toUserId, content, type, language]
        );

        const msg = result.rows[0];

        //create a private channel for both users since its a dm. this channels name would be from their userIds in ascending order.
        //for example communication between user 12 and user 45 would be in 12:45 and not 45:12 room
        const dmRoom = [userId, toUserId]
            .sort()
            .join(':');

        const realtimeMessage = {
            ...msg,
            username: socket.user.username,
        };

        await publisher.publish(
            'chat',
            JSON.stringify({
                room: `dm:${dmRoom}`,
                event: 'dm:new',
                payload: realtimeMessage
            })
        );
    });
};
