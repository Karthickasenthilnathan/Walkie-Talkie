import db from '../../config/db.js';

export default (io, socket, publisher) => {
    const { userId } = socket.user; //js object destructuring. grabs the userid from the user who has undergone jwt authentication

    //channel message
    socket.on('message:send', async ({ channelId, content, type = 'text', language }) => {

        const result = await db.query(
            `INSERT INTO messages(sender_id, channel_id, content, type, language)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING *`,
            [userId, channelId, content, type, language]
        );

        const msg = result.rows[0];

        await publisher.publish(
            'chat',
            JSON.stringify({
                room: `channel:${channelId}`,
                event: 'message:new',
                payload: msg,
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

        await publisher.publish(
            'chat',
            JSON.stringify({
                room: `dm:${dmRoom}`,
                event: 'dm:new',
                payload: msg
            })
        );
    });
};
