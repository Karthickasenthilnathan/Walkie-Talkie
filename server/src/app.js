import 'dotenv/config';

import express from 'express'; //backend framework
import http from 'http'; //creates raw http server
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

import setupSocket from './socket.js';
import env from './config/env.js';

const app = express();

//middleware
app.use(cors());
app.use(express.json()); //allows req.body parsing
app.use(morgan('dev')); //logs requests

//health check route
app.get('/', (req, res) => {
    res.send('Terminal Chat Server Running 🚀');
});

//mount routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

//create http server so socket.io can sit on top of it
const server = http.createServer(app);

//initialize socket.io
setupSocket(server);

//start server
server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
});