import { useState } from 'react';

const API_BASE = '/api';

function AdminDashboard({ onBack }) {
  const [compileStatus, setCompileStatus] = useState(null);
  const [compileLoading, setCompileLoading] = useState(false);
  const [initialPort, setInitialPort] = useState(7000);
  const [serverCount, setServerCount] = useState(1);
  const [serversStarted, setServersStarted] = useState(false);
  const [loadBalancerStarted, setLoadBalancerStarted] = useState(false);
  const [error, setError] = useState('');
  const [loadBalancerLoading, setLoadBalancerLoading] = useState(false);

  const serverPorts = Array.from({ length: serverCount }, (_, i) => initialPort + i);

  const handleCompile = async () => {
    setCompileLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/compile`, { method: 'POST' });
      const data = await res.json();
      setCompileStatus(data);
      if (!data.success) {
        setError(data.results?.map((r) => r.stderr).filter(Boolean).join('\n') || 'Compilation failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to compile. Is the bridge running?');
      setCompileStatus(null);
    } finally {
      setCompileLoading(false);
    }
  };

  const handleStartServers = async () => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/servers/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ports: serverPorts }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setServersStarted(true);
    } catch (err) {
      setError(err.message || 'Failed to start servers');
    }
  };

  const handleStartLoadBalancer = async () => {
    setLoadBalancerLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/loadbalancer/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startingPort: initialPort,
          totalServers: serverCount,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLoadBalancerStarted(true);
    } catch (err) {
      setError(err.message || 'Failed to start load balancer');
    } finally {
      setLoadBalancerLoading(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>Admin Dashboard</h1>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <section className="section">
        <h2>1. Compile C++ Backend</h2>
        <p className="hint">Compiles server.cpp, loadbalancer.cpp, client.cpp</p>
        <button
          className="action-btn"
          onClick={handleCompile}
          disabled={compileLoading}
        >
          {compileLoading ? 'Compiling...' : 'Add Server (Compile)'}
        </button>
        {compileStatus && (
          <div className={`compile-result ${compileStatus.success ? 'success' : 'failed'}`}>
            {compileStatus.success ? '✓ Compilation successful' : '✗ Compilation failed'}
            {compileStatus.results?.map((r, i) => (
              <pre key={i}>{r.stderr || r.stdout || `Exit ${r.code}`}</pre>
            ))}
          </div>
        )}
      </section>

      {compileStatus?.success && (
        <>
          <section className="section">
            <h2>2. Configure Servers</h2>
            <p className="hint">Initial port and number of servers (consecutive ports)</p>
            <div className="port-row">
              <label>
                Initial port:
                <input
                  type="number"
                  value={initialPort}
                  onChange={(e) => setInitialPort(Number(e.target.value) || 7000)}
                  min={1024}
                  max={65535}
                />
              </label>
              <button
                className="plus-btn"
                onClick={() => setServerCount((c) => c + 1)}
                title="Add server"
              >
                + Add Server
              </button>
            </div>
            <div className="server-list">
              {serverPorts.map((port, i) => (
                <div key={port} className="server-item">
                  Server {i + 1}: <code>./server {port}</code>
                </div>
              ))}
            </div>
            <button
              className="action-btn"
              onClick={handleStartServers}
              disabled={serversStarted}
            >
              {serversStarted ? `✓ ${serverCount} server(s) running` : 'Start Servers'}
            </button>
          </section>

          <section className="section">
            <h2>3. Start Load Balancer</h2>
            <p className="hint">Runs on port 7000 by default</p>
            <button
              className="action-btn"
              onClick={handleStartLoadBalancer}
              disabled={loadBalancerStarted || loadBalancerLoading}
            >
              {loadBalancerLoading
                ? 'Starting...'
                : loadBalancerStarted
                  ? '✓ Load balancer running'
                  : 'Add Load Balancer'}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
