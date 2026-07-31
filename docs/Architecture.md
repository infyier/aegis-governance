# 🏗️ Architecture

## System Overview

```
                    ┌────────────────────────────────┐
                    │         React Dashboard          │
                    │  Agent cards · Audit table       │
                    │  Live feed · Policy editor       │
                    └──────────┬──────────────────────┘
                               │ HTTP REST + WebSocket
                    ┌──────────▼──────────────────────┐
                    │         FastAPI Backend           │
                    │                                   │
                    │  ┌──────────┐  ┌──────────────┐  │
                    │  │ Policy   │  │  Audit Logger │  │
                    │  │ Engine   │  │  (hash chain) │  │
                    │  └──────────┘  └──────────────┘  │
                    │  ┌──────────────────────────────┐ │
                    │  │   Background Simulator Loop   │ │
                    │  └──────────────────────────────┘ │
                    │  ┌──────────────────────────────┐ │
                    │  │      WebSocket Manager        │ │
                    │  └──────────────────────────────┘ │
                    └──────────┬──────────────────────┘
                               │ sqlite3
                    ┌──────────▼──────────────────────┐
                    │          governance.db            │
                    │  agents table · audit_logs table  │
                    └───────────────────────────────────┘
```

## Data Flow: One Agent Action

1. **Simulator** (background asyncio loop) picks a random agent + action
2. Calls `evaluate_policy()` — checks: stopped? blocked? not in allowlist? over spend cap?
3. If approved → update `spend_used_today` in DB
4. Either way → `record_audit_entry()` hashes entry + prev_hash → inserts to `audit_logs`
5. `ws_manager.broadcast()` pushes the entry to all connected WebSocket clients
6. React Live Feed panel receives it instantly, no polling needed

## Why These Choices

| Decision | Rationale |
|---|---|
| SQLite not Postgres | Zero-setup, hackathon-appropriate, single file = easy demo |
| Hash chain audit | Makes tampering detectable — the key governance claim |
| asyncio simulator | Realistic live traffic without external tooling |
| FastAPI not Flask | Async native, auto OpenAPI docs at `/docs`, fast enough |
| React + Vite | Fastest dev iteration, hot reload |

## Known Weaknesses

- `governance.db` in project root (should be in `backend/`) 
- Frontend polls agents every 2s AND gets WS events — redundant
- All in one `app.py` — splits into `policy.py`, `audit.py`, `simulator.py` if growing
- No auth on any endpoint — kill switch is open to the internet
