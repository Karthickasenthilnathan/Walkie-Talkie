import { Server } from 'socket.io'; //creates a socket server

import { publisher, subscriber } from '../config/redis.js';
import authMiddleware from './middleware.js';
import messageHandler from './handlers/message.js';
import channelHandler from "./handlers/channel.js";

//const ONLINE_KEY = 'online_users'; //used to track users who are online

export default (httpServer) => {
    const io = new Server(httpServer, { //creating a server and attaching http to it cuz socket sits on top of http
        cors: {
            origin: '*'
        }
    });

    io.use(authMiddleware); //authenticating users
    

    subscriber.subscribe('chat', (message) => { //subscribe is a method in redis, arrow function is a callback
        const data = JSON.parse(message);

        const room = io.sockets.adapter.rooms.get(data.room);

if (!room) return;

for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);

    if (!socket) continue;

    if (!socket.data.caughtUp) continue;

    socket.emit(data.event, data.payload);
}
    });

    io.on('connection', async (socket) => {
        const { userId, username } = socket.user; //object destructuring
        socket.data.caughtUp = false;

        // Register handlers before awaited startup work. The client emits
        // channels:list as soon as its connect event fires; if Redis is slow,
        // registering these after sAdd would lose that first request.
        socket.on("channel:join", (channelId) => {
            socket.join(`channel:${channelId}`);
            socket.emit("channel:joined", channelId);
        });
        messageHandler(io, socket, publisher);
        channelHandler(socket);

        console.log(`${username} connected`);

        /*await publisher.sAdd(ONLINE_KEY, userId); //pauses until redis adds extracted userId to online_users set. sAdd = Set Add

        io.emit('user:online', { //broadcasts that they are online to all clients
            userId,
            username
        });*/

       /* socket.on('disconnect', async () => {
            await publisher.sRem(ONLINE_KEY, userId); //sRem = Set Remove

            io.emit('user:offline', {
                userId
            });
        }); */
    });

    return io;
};
