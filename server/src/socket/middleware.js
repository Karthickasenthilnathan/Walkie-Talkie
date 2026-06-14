const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

module.exports = (socket, next) => {
    const token = socket.handshake.auth?.token; // ?. = optional chaining

    if (!token) {
        return next(new Error('No token provided'));
    }

    try {
        socket.user = jwt.verify(token, jwtSecret); // store decoded payload on socket
        next();
    } catch (err) {
        return next(new Error('Invalid Token'));
    }
};