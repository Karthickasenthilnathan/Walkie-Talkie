const jwt = requires('jsonwebtoken')
const secret = require('../config/jwtSecret');
jwt.verify(token, jwtSecret)

module.exports = (socket,next) =>{
    const token = socket.handshake.auth?.token;   // ? = chaining. if suppose auths value is null then instead of crashing the token is assigned to value of underfined
if(!token){
    return next(new Error("No token provided"))
}
try{
    const secret = jwt.verify(token, jwtSecret);
    next();
}
catch(err){
    return next(new Error('Invalid Token'))
}
}