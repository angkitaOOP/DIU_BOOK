import http from 'node:http';
import app from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { initSocket } from './socket.js';

const server = http.createServer(app);
initSocket(server);

await pool.query('SELECT 1'); // fail fast if MySQL is unreachable
server.listen(config.port, () => console.log(`DIULink API listening on http://localhost:${config.port}`));

const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
