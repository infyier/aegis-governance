# 🖥️ Frontend

**Stack:** React 18 + Vite + Tailwind CSS
**Entry:** `frontend/src/main.jsx` → `App.jsx`

## Running the Frontend

```bash
cd /home/infyier/Desktop/governance-project-agentic/frontend
npm run dev
```

Opens at `http://localhost:5173`

**Requires backend running on port 8000 first.**

---

## Files

```
frontend/src/
├── App.jsx         ← Entire app (single-file React component, ~800 lines)
├── App.css         ← Component-level styles
├── index.css       ← Tailwind directives + global tokens
└── main.jsx        ← React DOM render entry
```

---

## UI Sections (all inside App.jsx)

### Header Bar
- Title + live connection status badge (WebSocket)
- Emergency Stop (fleet-wide) button

### Agent Cards Grid
- One card per agent (5 default)
- Shows: name, status badge, spend bar (used/cap), policy version
- **Per-agent controls:**
  - Stop / Resume toggle
  - Edit Policy (opens modal)
  - Reset Spend

### Policy Editor Modal
- Inline form for allowed actions, blocked actions, daily cap
- PATCH → `/agents/{id}/policy`

### Live Feed Panel
- Right-side panel, WebSocket-driven
- Real-time stream of audit events
- Color coded: green = approved, red = blocked
- Shows: agent name, action type, amount, rule triggered

### Audit Log Table
- Full table below agent cards
- Columns: timestamp, agent, action, amount, outcome, rule, hash preview
- Filter dropdowns: by agent, by outcome
- Last 50 entries by default (limit=50)

### Simulator Controls
- Toggle simulator on/off
- Manual action trigger (pick agent + action + amount)

---

## WebSocket Connection

```javascript
// App.jsx — simplified
const ws = new WebSocket("ws://localhost:8000/ws/live-feed");
ws.onmessage = (e) => {
  const entry = JSON.parse(e.data);
  setLiveFeed(prev => [entry, ...prev].slice(0, 100));
  setAuditLog(prev => [entry, ...prev].slice(0, 50));
};
```

**Known issue:** Frontend also polls `GET /agents` every 2 seconds for spend bar updates.  
This is redundant with the WS feed — the WS should push agent state diffs instead.

---

## Known Issues / Debt

- [ ] Single 800-line `App.jsx` — should split into component files
- [ ] No error state when backend is offline (just shows empty skeleton)
- [ ] Audit table has no pagination, loads 50 rows flat
- [ ] WS reconnect logic is not implemented (lost connection = silent failure)
