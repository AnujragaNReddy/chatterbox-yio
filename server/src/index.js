import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { Server } from 'socket.io';
import { PORT, CLIENT_ORIGIN } from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import { attachSocket } from './socket/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// Serve the built React app when it's been built and placed alongside the
// server (Docker/Fly image layout) or in the sibling client/ folder (local
// monorepo layout). In plain local dev neither exists — the Vite dev server
// serves the frontend separately instead — so this is skipped entirely.
const clientDist = [
  path.join(__dirname, '..', 'client-dist'),
  path.join(__dirname, '..', '..', 'client', 'dist'),
].find((dir) => fs.existsSync(dir));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });
app.set('io', io);
attachSocket(io);

server.listen(PORT, () => {
  console.log(`ChatterBox server running on http://localhost:${PORT}`);
});
