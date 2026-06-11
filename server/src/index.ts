import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';

// El .env vive en la raíz del repo; el server corre desde server/ (dev) o server/dist (prod).
// En Docker no hay .env: las variables llegan por el entorno del contenedor.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
import { Server } from 'socket.io';
import { registerHandlers } from './socket/handlers';
import { connectDb } from './db/connection';
import { authRouter } from './auth/auth';
import { socketAuthGuard } from './auth/middleware';

const PORT = Number(process.env.PORT ?? 3001);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.json());
app.use(authRouter);

// Guard del handshake: con JWT válido adjunta socket.data.userId; sin token, invitado.
io.use(socketAuthGuard);
io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

// Servir el cliente compilado (en producción)
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

void connectDb();

server.listen(PORT, () => {
  console.log(`[catan-assistant] listening on http://localhost:${PORT}`);
});
