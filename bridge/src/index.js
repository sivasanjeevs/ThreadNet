import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import {
  getServerPort,
  connectToChatServer,
  getServerLoad,
} from './tcp-client.js';
import {
  compile,
  startServers,
  startLoadBalancer,
  getProcessStatus,
  getActiveServerPorts,
} from './process-manager.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// --- REST API (for admin) ---

/** POST /api/compile - Compile C++ files */
app.post('/api/compile', async (_req, res) => {
  try {
    const result = await compile();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/servers/start - Start server processes */
app.post('/api/servers/start', (req, res) => {
  const { ports } = req.body || {};
  if (!Array.isArray(ports) || ports.length === 0) {
    return res.status(400).json({ error: 'ports array required' });
  }
  try {
    const result = startServers(ports);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/loadbalancer/start - Start load balancer */
app.post('/api/loadbalancer/start', (req, res) => {
  const { startingPort, totalServers } = req.body || {};
  if (!startingPort || !totalServers) {
    return res.status(400).json({ error: 'startingPort and totalServers required' });
  }
  try {
    const result = startLoadBalancer(Number(startingPort), Number(totalServers));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/processes - Process status */
app.get('/api/processes', (_req, res) => {
  res.json(getProcessStatus());
});

/** GET /api/servers/load - Load on each backend server */
app.get('/api/servers/load', async (req, res) => {
  const ports = getActiveServerPorts() || config.serverPorts;
  const loads = await Promise.all(
    ports.map(async (port) => {
      const load = await getServerLoad(port);
      return { port, load: load >= 0 ? load : null };
    })
  );
  res.json(loads);
});

/** GET /api/health - Bridge health */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'threadnet-bridge' });
});

// --- WebSocket (for user chat) ---
// Bridge implements same protocol as C++ client: LB → get port → connect to server

const MAX_LEN = 256;

// C++ sends null-terminated strings in 256-byte buffers; rest is garbage
function readNullTerminated(buf, offset, maxLen = MAX_LEN) {
  const slice = buf.subarray(offset, offset + maxLen);
  const nullIdx = slice.indexOf(0);
  const end = nullIdx >= 0 ? nullIdx : maxLen;
  return slice.subarray(0, end).toString('utf8');
}

function createMessageReader(tcpSocket, onMessage) {
  let buffer = Buffer.alloc(0);
  const need = MAX_LEN + 4 + MAX_LEN; // name + color + msg

  tcpSocket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= need) {
      const name = readNullTerminated(buffer, 0);
      const colorCode = buffer.readInt32LE(MAX_LEN);
      const msg = readNullTerminated(buffer, MAX_LEN + 4);
      buffer = buffer.subarray(need);
      onMessage({ sender: name, colorCode, text: msg });
    }
  });
}

const roomNames = new Map(); // roomId -> roomName (set by creator)
const roomCounts = new Map(); // roomId -> number of users in room

function leaveRoom(room) {
  if (!room) return;
  const n = (roomCounts.get(room) || 1) - 1;
  if (n <= 0) {
    roomCounts.delete(room);
    roomNames.delete(room);
  } else {
    roomCounts.set(room, n);
  }
}

io.on('connection', (socket) => {
  socket.on('join', async ({ name, room, roomName }) => {
    try {
      const hasRoom = roomCounts.has(room) || roomNames.has(room);
      if (!hasRoom && !roomName) {
        socket.emit("error", { message: "Room does not exist. Please create it first or check the Room ID." });
        return;
      }
      if (!hasRoom && roomName) {
        roomNames.set(room, roomName);
      }
      roomCounts.set(room, (roomCounts.get(room) || 0) + 1);

      // 1. Client → Load Balancer: send name, room; receive server port
      const serverPort = await getServerPort(name, room);
      // 2. Client → Server: connect to chosen server, send name, room
      const tcpSocket = await connectToChatServer(serverPort, name, room);

      socket.tcpSocket = tcpSocket;
      socket.userName = name;
      socket.userRoom = room;

      const displayRoomName = roomNames.get(room) || `Room ${room}`;
      socket.emit('joined', { room, serverPort, roomName: displayRoomName });

      // 3. Forward incoming messages (name 256 + color 4 + msg 256)
      createMessageReader(tcpSocket, (msg) => socket.emit('message', msg));

      tcpSocket.on('close', () => socket.emit('disconnected'));
      tcpSocket.on('error', () => {
        tcpSocket.destroy();
        socket.emit('error', { message: 'Connection lost' });
      });
    } catch (err) {
      socket.emit('error', { message: err.message || 'Failed to join. Ensure load balancer and servers are running.' });
    }
  });

  socket.on('send', (text) => {
    if (!socket.tcpSocket) return;
    const buf = Buffer.alloc(MAX_LEN);
    buf.write(String(text || '').slice(0, 255), 0, 255, 'utf8');
    socket.tcpSocket.write(buf);
  });

  socket.on('leave', () => {
    if (socket.tcpSocket) {
      const buf = Buffer.alloc(MAX_LEN);
      buf.write('#exit', 0, 5, 'utf8');
      socket.tcpSocket.write(buf);
      socket.tcpSocket.destroy();
      socket.tcpSocket = null;
    }
    leaveRoom(socket.userRoom);
    socket.emit('disconnected');
  });

  socket.on('disconnect', () => {
    if (socket.tcpSocket) {
      const buf = Buffer.alloc(MAX_LEN);
      buf.write('#exit', 0, 5, 'utf8');
      socket.tcpSocket.write(buf);
      socket.tcpSocket.destroy();
    }
    leaveRoom(socket.userRoom);
  });
});

// --- Start ---

const { port, host } = config.bridge;
httpServer.listen(port, host, () => {
  console.log(`ThreadNet Bridge running at http://${host}:${port}`);
  console.log(`  - REST API: http://localhost:${port}/api/*`);
  console.log(`  - WebSocket: ws://localhost:${port}`);
  console.log(`  - Load balancer (clients connect here): ${config.loadBalancer.host}:${config.loadBalancer.port}`);
  console.log(`  - Backend server ports (run ./server on these): ${config.serverPorts.join(', ')}`);
});
