# CodexUCI Prototype

Prototype system demonstrating a web based audio mixer UI and Node.js gateway
for a Q-SYS Core. The gateway relays WebSocket messages between the browser
UI and the Q-SYS QRC interface. Assets and control IDs are defined in
`config/assets.json` and shared between projects.

## Projects

### UI (`/ui`)
* React + TypeScript + Vite
* Loads audio assets from `config/assets.json`
* Connects to the gateway via WebSocket
* Dark mode and German translations by default

```bash
cd ui
npm install
npm run dev      # start development server
```

### Gateway (`/gateway`)
* Node.js WebSocket server
* Bridges between UI clients and Q-SYS Core

```bash
cd gateway
npm install
# Configure Q-SYS Core address (examples)
# PowerShell:
$env:QSYS_URL = 'ws://<core-ip>:1710/qrc'
# Optional: allow self-signed when using wss
# $env:QSYS_INSECURE = '1'

# Start gateway (default UI bridge on ws://localhost:8080/ws)
npm start
```

By default, the gateway now connects to the Q-SYS Core via QRC over TCP at `192.168.10.5:1710`.
Override with env vars `QSYS_HOST` and `QSYS_PORT`.
If you specifically need WebSocket QRC, set `QSYS_URL` to a `ws://`/`wss://` URL including `/qrc` and the gateway will use WS instead.

Troubleshooting connection to Q-SYS
- Verify IP/port: for TCP QRC use `QSYS_HOST`/`QSYS_PORT` (e.g. `10.1.2.3:1710`). For WS QRC use `QSYS_URL` (e.g. `wss://10.1.2.3:1710/qrc`).
- Secure cores: if HTTPS is enforced on the Core, use `wss://` and, if needed for a self-signed cert, set `QSYS_INSECURE=1`.
- Firewall/routing: ensure the machine running the gateway can reach the Core on the chosen port.
- Logs: the gateway now logs the Q-SYS URL and any socket errors/codes to help diagnose issues.

## assets.json
`config/assets.json` contains all controllable assets (audio, light, etc.).
The UI currently renders only `audio` assets with `adapter: "QSYS"` to the
existing fader view (gain/mute/level preserved). The gateway serves and
persists this file at `GET/PUT http://localhost:8080/assets.json`.

Schema: see `config/assets.schema.json` (JSON Schema 2020-12). The gateway
does a light validation (requires `version` and `assets` array). Full schema
validation may be added later.

Migration: the previous `channels.json` is no longer used.
