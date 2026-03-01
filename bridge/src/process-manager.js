import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');

const processes = {
  servers: [],
  serverPorts: [],
  loadBalancer: null,
};

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, [], {
      cwd: ROOT_DIR,
      shell: true,
      ...options,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    proc.on('error', reject);
  });
}

export async function compile() {
  const results = [];
  const commands = [
    'g++ server.cpp -lpthread -o server',
    'g++ loadbalancer.cpp -lpthread -o loadbalancer',
    'g++ client.cpp -lpthread -o client',
  ];
  for (const cmd of commands) {
    const { code, stdout, stderr } = await runCommand(cmd);
    results.push({ cmd, code, stdout, stderr });
  }
  const success = results.every((r) => r.code === 0);
  return { success, results };
}

export function startServers(ports) {
  for (const p of processes.servers) {
    try { p.kill(); } catch (_) {}
  }
  processes.servers = [];
  processes.serverPorts = [...ports];
  for (const port of ports) {
    const proc = spawn('./server', [String(port)], {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    processes.servers.push(proc);
  }
  return { started: ports.length, ports };
}

export function startLoadBalancer(startingPort, totalServers) {
  if (processes.loadBalancer) {
    try { processes.loadBalancer.kill(); } catch (_) {}
  }
  const proc = spawn('./loadbalancer', [], {
    cwd: ROOT_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // Load balancer reads cin for starting port and total servers
  setTimeout(() => {
    if (proc.stdin?.writable) {
      proc.stdin.write(`${startingPort}\n${totalServers}\n`);
      proc.stdin.end();
    }
  }, 150);
  processes.loadBalancer = proc;
  return { started: true };
}

export function getProcessStatus() {
  return {
    servers: processes.servers.length,
    serverPorts: processes.serverPorts,
    loadBalancer: !!processes.loadBalancer,
  };
}

export function getActiveServerPorts() {
  return processes.serverPorts.length ? processes.serverPorts : null;
}
