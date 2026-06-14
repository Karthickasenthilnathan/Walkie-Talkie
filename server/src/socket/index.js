const { Server } = require('socket.io'); //creates a socket server

const { publisher, subscriber } = require('../config/redis');
const authMiddleware = require('./middleware');
const messageHandler = require('./handlers/message');

const ONLINE_KEY = 'online_users'; //used to track users who are online

module.exports = (httpServer) => {
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

        socket.join('channel:general'); //joins the client's socket to general channel by default

        messageHandler(io, socket, publisher);

        socket.on('channel:join', (channelId) => {
            socket.join(`channel:${channelId}`);
        });

        socket.on('disconnect', async () => {
            await publisher.sRem(ONLINE_KEY, userId); //sRem = Set Remove

            io.emit('user:offline', {
                userId
            });
        });
    });

    return io;
};