import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { registerHandlers } from './socket/handlers';

const PORT = Number(process.env.PORT ?? 3001);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

// Servir el cliente compilado (en producción)
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`[catan-assistant] listening on http://localhost:${PORT}`);
});
