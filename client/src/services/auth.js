import fs from 'fs';
import path from 'path';
import http from 'http';
import open from 'open';
/*
const TOKEN_PATH = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.terminal-chat-token'
);
*/
const TOKEN_PATH =
    process.env.TOKEN_PATH ||
    path.join(
        process.env.HOME || process.env.USERPROFILE,
        '.terminal-chat-token'
    );

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

export const getToken = () => {
    try {
        return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    } catch {
        return null;
    }
};

export const saveToken = (token) => {
    fs.writeFileSync(TOKEN_PATH, token);
};

export const clearToken = () => {
    try {
        fs.unlinkSync(TOKEN_PATH);
    } catch {
        // The token may already be absent.
    }
};

export const startAuthFlow = () =>
    new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://localhost:9876');
            const token = url.searchParams.get('token');

            console.error(`[auth] callback hit: ${url.pathname}${url.search}`);

            if (token) {
                console.error('[auth] token received, saving and resolving');
                saveToken(token);

                res.end(
                    '<h1>Authenticated! Return to your terminal.</h1>'
                );

                server.close();
                resolve(token);
            } else {
                res.end('Waiting for authentication...');
            }
        });

        server.listen(9876);

        console.error(`[auth] opening ${SERVER_URL}/auth/github`);

        open(`${SERVER_URL}/auth/github`).catch((err) => {
            console.error('[auth] failed to open browser:', err);
        });
    });
