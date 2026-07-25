import db from "../../config/db.js";

export default (socket) => {
    socket.on("channels:list", async () => {
        try {
            const result = await db.query(
                `SELECT id, name
                 FROM channels
                 ORDER BY name`
            );

            socket.emit("channels:list", result.rows);
        } catch (error) {
            console.error('Failed to load channels:', error);
            socket.emit('channels:error', 'database unavailable');
        }
    });

    socket.on("channel:join", (channelId) => {
    socket.join(`channel:${channelId}`);

    socket.emit("channel:joined", channelId);
});
};
