/**
 * Bridge server configuration.
 * Must match your C++ backend setup.
 *
 * Load balancer: always port 7000 (clients connect here).
 * "Starting Server port" in load balancer = first BACKEND server port (e.g. 7000).
 */
export const config = {
  // Load balancer listens on 7000; clients connect here (not to server ports)
  loadBalancer: {
    host: '127.0.0.1',
    port: 7000,
  },
  // Backend server ports (what you enter in load balancer: first port + count)
  serverPorts: [7000, 7001, 7002],
  // Bridge HTTP/WebSocket server
  bridge: {
    port: 3001,
    host: '0.0.0.0',
  },
  // C++ protocol constants
  maxLen: 256,
};
