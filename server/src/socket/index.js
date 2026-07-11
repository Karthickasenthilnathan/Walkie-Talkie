import { Server } from 'socket.io'; //creates a socket server

import { publisher, subscriber } from '../config/redis.js';
import authMiddleware from './middleware.js';
import messageHandler from './handlers/message.js';
import channelHandler from "./handlers/channel.js";

const ONLINE_KEY = 'online_users'; //used to track users who are online

export default (httpServer) => {
    const io = new Server(httpServer, { //creating a server and attaching http to it cuz socket sits on top of http
        cors: {
            origin: '*'
        }
    });

    io.use(authMiddleware); //authenticating users

    subscriber.subscribe('chat', (message) => { //subscribe is a method in redis, arrow function is a callback
        const data = JSON.parse(message);

        io.to(data.room).emit(data.event, data.payload);
    });

    io.on('connection', async (socket) => {
        const { userId, username } = socket.user; //object destructuring

        console.log(`${username} connected`);

        await publisher.sAdd(ONLINE_KEY, userId); //pauses until redis adds extracted userId to online_users set. sAdd = Set Add

        io.emit('user:online', { //broadcasts that they are online to all clients
            userId,
            username
        });

        socket.on("channel:join", (channelId) => {
    socket.join(`channel:${channelId}`);
}); //joins the client's socket to general channel by default

        messageHandler(io, socket, publisher);

        channelHandler(socket);

        socket.on('disconnect', async () => {
            await publisher.sRem(ONLINE_KEY, userId); //sRem = Set Remove

            io.emit('user:offline', {
                userId
            });
        });
    });

    return io;
};
