import { io } from 'socket.io-client'
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

export const connectSocket=(token)=>{
     return io(SERVER_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,    //returns server_url and object containgin 3 params to the socket from client.
    //3 params inside object is jwt token, reconnection:true allows client to reconnect when network connection is lost
    //max limits for reconnection is 5 tries for 5 time to reconnect when offline
     })

}
