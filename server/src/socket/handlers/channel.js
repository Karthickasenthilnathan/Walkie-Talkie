import db from "../../config/db.js";

export default (socket) => {
    socket.on("channels:list", async () => {
        const result = await db.query(
            `SELECT id, name
             FROM channels
             ORDER BY name`
        );

        socket.emit("channels:list", result.rows);
    });

    socket.on("channel:join", (channelId) => {
    socket.join(`channel:${channelId}`);

    socket.emit("channel:joined", channelId);
});
};