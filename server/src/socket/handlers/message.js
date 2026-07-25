//-- Active: 1783004658282@@127.0.0.1@5432@terminalclichatapp
import db from '../../config/db.js';
import { messageCacheLimit } from '../../config/env.js';
import { messageCacheTtlSeconds } from '../../config/env.js';
import {
    incrementRedisHitCount,
    incrementRedisMissCount,
} from '../../config/redis.js';

export default (io, socket, publisher) => {
    const { userId } = socket.user;

  
    // RESUME / MESSAGE REPLAY
    

    socket.on("resume", async ({ channelId, lastCursor }) => {
        try {
            if (!channelId) {
                return;
            }

            const cacheKey = `channel:${channelId}:recent_messages`;

            /*
             * Get the oldest message currently available in Redis.
             */
            const oldestCached = await publisher.zRangeWithScores(
                cacheKey,
                0,
                0
            );

         
           // REDIS IS EMPTY
            
            //
            // Redis cannot help with recovery.
            // If the client has a cursor, PostgreSQL gives us
            // everything after that cursor.
            
        
            

            if (oldestCached.length === 0) {

                if (lastCursor != null) {

                    incrementRedisMissCount();

                    const result = await db.query(
                        `
                        SELECT m.*, u.username
                        FROM messages m
                        JOIN users u
                            ON u.id = m.sender_id
                        WHERE m.channel_id = $1
                          AND m.seq > $2
                        ORDER BY m.seq ASC
                        `,
                        [channelId, Number(lastCursor)]
                    );

                    for (const message of result.rows) {
                        socket.emit('message:new', message);
                    }
                }
                 console.log("Replay: PSQL only");
                return;
            }


            // Redis has messages.
            //
            // zRangeWithScores returns something like:
           

            const oldestCachedSeq =
                Number(oldestCached[0].score);


            
            // CASE 2: CLIENT CURSOR IS OLDER THAN REDIS

            if (
                lastCursor != null &&
                Number(lastCursor) < oldestCachedSeq - 1
            ) {

                incrementRedisMissCount();
                incrementRedisHitCount();

               
                // Fetch the missing gap from PostgreSQL
          

                const result = await db.query(
                    `
                    SELECT m.*, u.username
                    FROM messages m
                    JOIN users u
                        ON u.id = m.sender_id
                    WHERE m.channel_id = $1
                      AND m.seq > $2
                      AND m.seq < $3
                    ORDER BY m.seq ASC
                    `,
                    [
                        channelId,
                        Number(lastCursor),
                        oldestCachedSeq
                    ]
                );


                // First emit PostgreSQL messages
           
                // 21 ... 79

                for (const message of result.rows) {
                    socket.emit(
                        'message:new',
                        message
                    );
                }


                
                // Now fetch Redis messages
             
                
                // 80 ... 100

                const cachedMessages =
                    await publisher.zRangeByScore(
                        cacheKey,
                        oldestCachedSeq,
                        '+inf'
                    );


                for (const encodedMessage of cachedMessages) {

                    socket.emit(
                        'message:new',
                        JSON.parse(encodedMessage)
                    );

                }

                console.log("Replay: PostgreSQL + Redis");

                return;

            }


           
            // CASE 3: REDIS CAN FULLY HANDLE THE REPLAY
            
           
            // lastCursor = 90
            
            // Redis:
            // 80 ... 100
            
            // Redis already contains everything we need.
         
            // 91 ... 100
          
            

            const minScore = lastCursor == null
    ? '-inf'
    : `(${lastCursor}`;
            const cachedMessages =
                await publisher.zRangeByScore(
                    cacheKey,
                    minScore,
                    '+inf'
                );

            incrementRedisHitCount();


            for (const encodedMessage of cachedMessages) {

                socket.emit(
                    'message:new',
                    JSON.parse(encodedMessage)
                );

            }
        console.log("Replay: Redis only");

        } catch (err) {

            console.error(
                "Resume replay failed:",
                err
            );

        } finally {

            /*
              Replay has finished
             */

            socket.data.caughtUp = true;

            socket.emit(
                "resume_complete"
            );
        }
    });



    // =========================================================
    // CHANNEL MESSAGE
    // =========================================================

    socket.on(
        'message:send',
        async ({
            channelId,
            content,
            type = 'text',
            language
        }) => {

            const result = await db.query(
                `
                INSERT INTO messages(
                    sender_id,
                    channel_id,
                    content,
                    type,
                    language
                )
                VALUES ($1,$2,$3,$4,$5)
                RETURNING *
                `,
                [
                    userId,
                    channelId,
                    content,
                    type,
                    language
                ]
            );


            const msg =
                result.rows[0];


            const realtimeMessage = {

                ...msg,

                username:
                    socket.user.username

            };


            // -----------------------------------------
            // Cache recent message in Redis
            // -----------------------------------------

            try {

                await cacheMessage(
                    channelId,
                    realtimeMessage
                );

            } catch (err) {

                console.error(
                    'Message cache write failed:',
                    err
                );

            }


            // -----------------------------------------
            // Publish live message
            // -----------------------------------------

            await publisher.publish(

                'chat',

                JSON.stringify({

                    room:
                        `channel:${channelId}`,

                    event:
                        'message:new',

                    payload:
                        realtimeMessage

                })

            );

        }
    );



    // =========================================================
    // DIRECT MESSAGES
    // =========================================================

    socket.on(
        'dm:send',
        async ({
            toUserId,
            content,
            type = 'text',
            language
        }) => {

            const result = await db.query(
                `
                INSERT INTO messages(
                    sender_id,
                    dm_to,
                    content,
                    type,
                    language
                )
                VALUES ($1,$2,$3,$4,$5)
                RETURNING *
                `,
                [
                    userId,
                    toUserId,
                    content,
                    type,
                    language
                ]
            );


            const msg =
                result.rows[0];


            /*
             * Create deterministic DM room.
             *
             * Example:
             *
             * user 12 + user 45
             *
             * room:
             *
             * 12:45
             *
             * Never:
             *
             * 45:12
             */

            const dmRoom = [
                userId,
                toUserId
            ]
                .sort()
                .join(':');


            const realtimeMessage = {

                ...msg,

                username:
                    socket.user.username

            };


            await publisher.publish(

                'chat',

                JSON.stringify({

                    room:
                        `dm:${dmRoom}`,

                    event:
                        'dm:new',

                    payload:
                        realtimeMessage

                })

            );

        }
    );



    // =========================================================
    // REDIS MESSAGE CACHE
    // =========================================================

    async function cacheMessage(
        channelId,
        message
    ) {

        const cacheKey =
            `channel:${channelId}:recent_messages`;


        await publisher
            .multi()

            // Store message using seq as score
            .zAdd(
                cacheKey,
                {
                    score:
                        Number(message.seq),

                    value:
                        JSON.stringify(message)
                }
            )

            // Keep only the newest N messages
            .zRemRangeByRank(
                cacheKey,
                0,
                -messageCacheLimit - 1
            )

            // Automatically remove inactive cache
            .expire(
                cacheKey,
                messageCacheTtlSeconds
            )

            .exec();
    }
};
