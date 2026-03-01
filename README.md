# ThreadNet

Multi-threaded, load-balanced chat room system with a C++ TCP backend and web UIs (Admin + User).

---

## How It Works

### Backend (C++)

1. **Load Balancer** (port 6000) accepts client connections. Each client sends **name** and **room ID**.
2. The load balancer asks each **server** for its current client count and uses **Round-Robin** to pick the least loaded server for that room.
3. The client connects to the chosen **server**. Servers run on ports you choose (e.g. 7000, 7001, 7002).
4. Each server runs **one thread per client**. **Mutex locks** avoid race conditions when broadcasting messages.
5. Messages in a room are broadcast only to other clients in the same room on the same server.

### Web UIs and Bridge

- **Admin UI**: Compile C++, start servers, start load balancer, view server load.
- **User UI**: Create or join rooms and chat. Multiple users open the same URL in different tabs or devices; same **Room ID** = same room.
- **Bridge** (Node.js): Sits between the browser and the C++ backend. It speaks the same TCP protocol as the C++ client, so the backend does not need to change. The bridge also stores room names and cleans up when a room is empty.

### Flow (one user joining a room)

```
Browser (User UI)  →  WebSocket  →  Bridge  →  TCP  →  Load Balancer (6000)
                                                          ↓
                                                    Server port (e.g. 7000)
                                                          ↓
Browser  ←  WebSocket  ←  Bridge  ←  TCP  ←  Server (7000)
```

---

## How to Run

### One-time setup

```bash
cd ThreadNet
make
npm run install:all
```

- `make` builds the C++ binaries: `server`, `loadbalancer`, `client`.
- `npm run install:all` installs dependencies for the bridge and both frontends.

### Every time you run

**1. Start the bridge** (Terminal 1)

```bash
cd ThreadNet
npm run dev:bridge
```

Keep it running. It listens on port 3001 and talks to the C++ backend.

**2. Start the Admin UI** (Terminal 2)

```bash
cd ThreadNet
npm run dev:admin
```

Open **http://localhost:3002**.

**3. Start the C++ backend from the Admin UI**

1. Click **Admin**.
2. Click **Add Server (Compile)** and wait for success.
3. Set **Initial port** (e.g. `7000`) and click **+ Add Server** until you have enough servers (e.g. 3).
4. Click **Start Servers**.
5. Click **Add Load Balancer**.

**4. Start the User UI** (Terminal 3)

```bash
cd ThreadNet
npm run dev:user
```

Open **http://localhost:3003**.

**5. Chat**

- **Create room:** Create Room → Room name, Room ID (or use **Generate**), Your name → Create.
- **Join room:** Join Room → same Room ID, Your name → Join.
- More users: open http://localhost:3003 in other tabs or devices and use the same Room ID.

### Running C++ from terminals (alternative)

If you prefer not to use the Admin UI:

- **Terminal 1:** `./loadbalancer` → enter first server port (e.g. 7000) and number of servers (e.g. 3).
- **Terminals 2–4:** `./server 7000`, `./server 7001`, `./server 7002`.

Then start the bridge and frontends as in steps 1–2 and 4 above.

---

## URLs

| Service      | URL                    |
|-------------|------------------------|
| Admin UI    | http://localhost:3002  |
| User Chat   | http://localhost:3003  |
| Bridge API  | http://localhost:3001  |

---

## Configuration

Edit `bridge/src/config.js` if you use different ports:

- `loadBalancer.port`: 6000 (where the load balancer listens).
- `serverPorts`: list of backend server ports (e.g. [7000, 7001, 7002]).

---

## API (Admin)

- `GET /api/health` – Bridge health.
- `GET /api/servers/load` – Client count per backend server.

---

## Hosting (Vercel and beyond)

### What can run where

| Part           | Runs on Vercel? | Notes |
|----------------|-----------------|--------|
| Admin frontend | ✅ Yes          | Static/SPA; build with `npm run build:admin`. |
| User frontend  | ✅ Yes          | Static/SPA; build with `npm run build:user`. |
| Bridge         | ❌ No           | Needs a long-lived Node server and TCP to C++ backend. |
| C++ backend    | ❌ No           | Needs a Linux environment and fixed ports. |

So you **can** host the two frontends on Vercel. The **bridge** and **C++ backend** must run somewhere else.

### Option A: Frontends on Vercel, backend elsewhere

1. **Vercel** – deploy `admin-frontend` and `user-frontend` (e.g. two Vercel projects or two paths).
2. **Backend host** – run the C++ load balancer + servers and the Node bridge on a **VPS** (e.g. Ubuntu on DigitalOcean, AWS EC2, etc.) or a **PaaS** that allows long-lived processes and custom binaries (e.g. **Railway**, **Render**; C++ may require a Dockerfile).

In the frontend apps, set the API/WebSocket base URL to your bridge’s public URL (e.g. `https://your-bridge.example.com`) so they talk to your deployed bridge instead of `localhost:3001`.

### Option B: All on a VPS

1. Rent a Linux VPS (DigitalOcean, Linode, etc.).
2. Clone the repo, run `make` and `npm run install:all`.
3. Run the load balancer and servers (e.g. with `systemd` or `screen`/`tmux`).
4. Run the bridge with Node (e.g. `node bridge/src/index.js` with a process manager like `pm2`).
5. Serve the built frontends with nginx (or another server) or use the Vite build and a static server.
6. Put a reverse proxy (e.g. nginx) in front with HTTPS; point your domain to the VPS.

### Summary

- **Vercel**: Use it for the **Admin** and **User** frontends only. Point their config to your bridge URL.
- **Bridge + C++**: Run on a **VPS** or **PaaS** that supports Node and long-lived C++ processes. Vercel cannot run the bridge or the C++ backend.
