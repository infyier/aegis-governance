# 🚀 Deployment

## Local Dev (Default)

### Step 1 — Install backend deps (once)
```bash
python3 -m pip install --user fastapi "uvicorn[standard]" websockets pydantic
```

### Step 2 — Start Backend
```bash
cd /home/infyier/Desktop/governance-project-agentic
python3 -m uvicorn backend.app:app --reload --port 8000
```

Backend will:
- Auto-create `governance.db` in the project root
- Seed 5 default agents on first run
- Start background simulator loop
- Serve API at `http://localhost:8000`
- Serve interactive docs at `http://localhost:8000/docs`

### Step 3 — Start Frontend
```bash
cd /home/infyier/Desktop/governance-project-agentic/frontend
npm run dev
```

Frontend at `http://localhost:5173`

---

## Reset Everything

To start fresh (wipe all data, re-seed):
```bash
rm /home/infyier/Desktop/governance-project-agentic/governance.db
# Restart backend — it will re-seed
```

To reset just spend counters (all agents):
```bash
curl -s http://localhost:8000/agents | python3 -c "
import sys, json
agents = json.load(sys.stdin)
import urllib.request
for a in agents:
    req = urllib.request.Request(f\"http://localhost:8000/agents/{a['agent_id']}/reset-spend\", method='POST')
    urllib.request.urlopen(req)
    print(f\"Reset {a['agent_id']}\")
"
```

---

## Environment

- Python 3.10+ required
- Node 18+ required (for frontend)
- No Docker, no external services needed
- All data in single `governance.db` SQLite file

---

## Production Considerations (if this were real)

| Current | Production |
|---|---|
| SQLite | Postgres with connection pooling |
| No auth | JWT tokens + RBAC per endpoint |
| Open CORS `*` | Restrict origins to known frontends |
| `governance.db` in root | Separate data volume, WORM storage for audit log |
| In-process simulator | External agent processes via message queue (RabbitMQ/Kafka) |
| Single FastAPI process | Multiple workers behind a load balancer |
| WebSocket direct | Redis pub/sub → multiple WS servers |
