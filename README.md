# CodexUCI Prototype

Prototype system demonstrating a web based audio mixer UI and Node.js gateway
for a Q-SYS Core. The gateway relays WebSocket messages between the browser
UI and the Q-SYS QRC interface. Channels and control IDs are defined in
`channels.json` and shared between projects.

## Projects

### UI (`/ui`)
* React + TypeScript + Vite
* Loads channel strips from `channels.json`
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
npm start        # runs on ws://localhost:8080/ws
```

The gateway expects the Q-SYS Core at `ws://192.168.10.5:1710`.

## channels.json
`channels.json` describes all seven audio channels used by the prototype and
is consumed by both the UI and the gateway.
