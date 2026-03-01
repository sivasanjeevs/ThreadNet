import net from 'net';
import { config } from './config.js';

const MAX_LEN = config.maxLen;

/**
 * Pad or truncate string to fixed length for C++ protocol.
 */
function toFixedBuffer(str) {
  const buf = Buffer.alloc(MAX_LEN);
  buf.write(str || '', 0, MAX_LEN - 1, 'utf8');
  return buf;
}

/**
 * Connect to load balancer, get server port for room.
 */
export function getServerPort(name, room) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      { host: config.loadBalancer.host, port: config.loadBalancer.port },
      () => {
        socket.write(toFixedBuffer(name));
        socket.write(toFixedBuffer(room));
      }
    );

    socket.once('data', (data) => {
      const port = data.readInt32LE(0);
      socket.destroy();
      resolve(port);
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

/**
 * Connect to a backend server and return a duplex stream for chat.
 * Protocol: send name, room; then send/recv messages (256 bytes each).
 * Incoming: othername (256), color_code (4), othermsg (256)
 */
export function connectToChatServer(serverPort, name, room) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      { host: config.loadBalancer.host, port: serverPort },
      () => {
        socket.write(toFixedBuffer(name));
        socket.write(toFixedBuffer(room));
        resolve(socket);
      }
    );

    socket.on('error', (err) => reject(err));
  });
}

/**
 * Query load (client count) of a backend server.
 * Uses __LoadBalancer__ / __getLoad?__ protocol.
 */
export function getServerLoad(serverPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection(
      { host: config.loadBalancer.host, port: serverPort },
      () => {
        socket.write(toFixedBuffer('__LoadBalancer__'));
        socket.write(toFixedBuffer('__getLoad?__'));
      }
    );

    socket.once('data', (data) => {
      const load = data.readInt32LE(0);
      socket.write(toFixedBuffer('#exit'));
      socket.destroy();
      resolve(load);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(-1);
    });
  });
}
