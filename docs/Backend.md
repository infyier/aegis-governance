# ⚙️ Backend

**File:** `backend/app.py` (676 lines, single-file monolith — intentional for hackathon)
**Runtime:** Python 3 + FastAPI + uvicorn

## Running the Backend

```bash
cd /home/infyier/Desktop/governance-project-agentic
python3 -m uvicorn backend.app:app --reload --port 8000
```

Or from inside `backend/`:
```bash
cd backend
python3 -m uvicorn app:app --reload --port 8000
```

Interactive docs auto-generated at: `http://localhost:8000/docs`

---

## Module Breakdown (logical, all in app.py)

### 1. Database Setup (`init_db`)
- Creates `agents` + `audit_logs` tables if not exist
- Seeds 5 agent personas on first run
- Uses `sqlite3.Row` factory so rows act like dicts

### 2. Policy Engine (`evaluate_policy`)
```python
def evaluate_policy(agent, action_type, amount):
    if agent["status"] == "stopped":        → blocked: emergency_stop_active
    if action_type in blocked_actions:      → blocked: action_not_permitted
    if action_type not in allowed_actions:  → blocked: action_not_in_allowlist
    if spend_used_today + amount > cap:     → blocked: spend_cap_exceeded
    else:                                   → approved
```
**Order matters.** Emergency stop trumps everything. Blocked list checked before allowlist.

### 3. Hash-Chain Audit Logger (`record_audit_entry`)
- Fetches `entry_hash` of last row → becomes `prev_hash`
- First entry ever: `prev_hash = "GENESIS"`
- Hashes the full entry payload (sorted JSON) with SHA-256
- Stores both hashes — makes tampering detectable via `/audit-log/verify`

### 4. WebSocket Manager (`ConnectionManager`)
- Maintains list of active connections
- `broadcast()` sends JSON to all, removes stale connections
- All simulator events + manual simulations push through here

### 5. Background Simulator (`background_simulator`)
- Starts as an asyncio task on app startup
- Every 2–4 seconds: picks random agent, picks random action from its persona pool
- Adds ±50% noise to amounts for realism
- Respects `simulator_running` global flag (toggle via `/simulator/toggle`)
- Calls `evaluate_policy` + `record_audit_entry` + `ws_manager.broadcast` directly

---

## Agent Personas (Seeded)

| ID | Name | Allowed | Blocked | Daily Cap |
|---|---|---|---|---|
| `travel_agent_01` | Travel Rebooking Agent | flight_rebook, hotel_rebook | credit_limit_increase | $1,500 |
| `fee_reversal_02` | Fee Reversal Agent | waive_fee, account_summary | wire_transfer | $500 |
| `credit_limit_03` | Credit Limit Agent | credit_limit_increase, score_check | card_issue | $5,000 |
| `card_replacement_04` | Card Replacement Agent | card_issue, card_lock | waive_fee | $200 |
| `balance_check_05` | Account Inquiry Agent | account_summary, balance_check | wire_transfer, flight_rebook | $100 |

---

## Dependencies

```
fastapi
uvicorn[standard]
websockets
pydantic
```

Install via: `python3 -m pip install --user fastapi "uvicorn[standard]" websockets pydantic`
