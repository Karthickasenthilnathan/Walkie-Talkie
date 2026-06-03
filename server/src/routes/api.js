const router = require(express).Router();
const db = reuire('../config/db')
const jwt = require('jsonwebtoken')
const {publisher} = require('../config/redis')

//actual authentication

const auth=(req,res,next)=>{
    const token = req.header.authorization?.split(' ')[1]
    if(!token){
        return res.status(403).json({'error':'unauthorized'})
    }
    try{
        req.user=jwt.verify(token, jwtSecret)
        next()
    }
    catch{
        return res.status(401).json({'error':'Invalid token'})
    }
};