# 🌐 API Reference

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

---

## Agents

### `GET /agents`
List all agents with current state.

**Response:**
```json
[
  {
    "agent_id": "travel_agent_01",
    "display_name": "Travel Rebooking Agent",
    "allowed_actions": ["flight_rebook", "hotel_rebook"],
    "blocked_actions": ["credit_limit_increase"],
    "spend_cap_daily": 1500.0,
    "spend_used_today": 342.5,
    "status": "active",
    "policy_version": 1
  }
]
```

---

### `POST /agents`
Create a new agent.

**Body:**
```json
{
  "agent_id": "my_new_agent",
  "display_name": "My Agent",
  "allowed_actions": ["balance_check"],
  "blocked_actions": ["wire_transfer"],
  "spend_cap_daily": 500.0
}
```

---

### `PATCH /agents/{agent_id}/policy`
Update an agent's policy. All fields optional.

**Body:**
```json
{
  "allowed_actions": ["balance_check", "account_summary"],
  "blocked_actions": ["wire_transfer"],
  "spend_cap_daily": 750.0
}
```
Bumps `policy_version` by 1 on success.

---

### `POST /agents/{agent_id}/reset-spend`
Reset `spend_used_today` to 0. Useful for demo resets.

---

## Simulation

### `POST /simulate/action`
Manually trigger an agent action attempt. Goes through full policy engine.

**Body:**
```json
{
  "agent_id": "travel_agent_01",
  "action_type": "flight_rebook",
  "amount": 450.0
}
```

**Response:** Full audit log entry (same as WS push)

---

### `POST /simulator/toggle?running=true|false`
Start/stop the background simulator loop.

---

## Emergency Controls

### `POST /emergency-stop`
Stop **all** agents (`status = "stopped"`).

### `POST /emergency-stop/{agent_id}`
Stop one specific agent.

### `POST /resume-all`
Resume all stopped agents.

### `POST /resume/{agent_id}`
Resume one specific agent.

---

## Audit Log

### `GET /audit-log`
Get recent audit entries. Query params:
- `agent_id` — filter by agent
- `outcome` — `approved` or `blocked`  
- `limit` — default 50, max 500

**Response:** Array of audit entries (newest first)

---

### `GET /audit-log/verify`
Re-compute every hash in the chain and verify integrity.

**Response:**
```json
{ "valid": true, "entries_checked": 247 }
```
Or if tampered:
```json
{ "valid": false, "broken_at": "<action_id>", "reason": "entry_hash invalid" }
```

---

## WebSocket

### `WS /ws/live-feed`
Connect to receive real-time audit events as they happen.

**Message format:** Same as audit log entry JSON:
```json
{
  "action_id": "uuid",
  "agent_id": "travel_agent_01",
  "action_type": "flight_rebook",
  "amount": 450.0,
  "timestamp": "2026-07-22T18:45:00Z",
  "outcome": "approved",
  "rule_triggered": null,
  "policy_version": 1,
  "prev_hash": "abc123...",
  "entry_hash": "def456..."
}
```
