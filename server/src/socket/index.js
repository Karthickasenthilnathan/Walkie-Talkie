const { Server }= require('socket.io')  //creates a scoket server

const {publisher, subscriber } = require('../config/redis')
const {authMiddleware} = require('./middleware')
const {messsageHandlers} = reuire('./handlers/message')

const ONLINE_KEY= 'online_users' //used to track users in online

module.exports = (httpServer)=>{ 
    const io = new Server( httpServer,{ //creating a server and attaching http to it cuz socket sits on top of http
        cors:{
            origin:'*'
        }
    })
    io.use(authMiddleware) //authenticating users
    subscriber.subscribe('chat', (message)=>{  //sunscribe is a method in redis , arrow function is a callback
        const data = JSON.parse(message);
        io.to(data.room).emit(data.event, data.payload)
    })
    io.on('connection', async(socket)=>{
        const{userId,username}=socket.user   //object destructuringg
        console.log(`${username} connected`)
    })

    await publisher.sAdd(ONLINE_KEY,userId)  //pauses until redis adds the extracted userId to online_users list. sAdd is a setAdd function for publisher
    io.emit('user:online', userId, username) //broadcasts that they are online to all servers. 'online:users' is a event
    socket.join('channel:general')  //joins the clients socket to a general channel by default
    
    messageHandler(io, socket, publisher);

    socket.on('channel:join',(channelId)=>{
        socket.join( `channel:${channelId}`);
    })

    socket.on('disconnect',async ()=>{
        await publisher.sRem(ONLINE_KEY,userId), //sRem = set remove
        io.emit('user:offline', {userId})

    })
    return io;

}
