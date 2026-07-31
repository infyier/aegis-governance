# 🗄️ Data Models

## SQLite Tables

### `agents`

| Column | Type | Notes |
|---|---|---|
| `agent_id` | TEXT PK | e.g. `travel_agent_01` |
| `display_name` | TEXT | Human-readable label |
| `allowed_actions` | TEXT | JSON array of action strings |
| `blocked_actions` | TEXT | JSON array of blocked strings |
| `spend_cap_daily` | REAL | Max daily spend in dollars |
| `spend_used_today` | REAL | Current day running total |
| `status` | TEXT | `active` or `stopped` |
| `policy_version` | INTEGER | Increments on each PATCH |

---

### `audit_logs`

| Column | Type | Notes |
|---|---|---|
| `action_id` | TEXT PK | UUID4 |
| `agent_id` | TEXT | FK → agents.agent_id (soft) |
| `action_type` | TEXT | e.g. `flight_rebook` |
| `amount` | REAL | Dollar amount attempted |
| `timestamp` | TEXT | ISO 8601 UTC |
| `outcome` | TEXT | `approved` or `blocked` |
| `rule_triggered` | TEXT | NULL if approved, else rule name |
| `policy_version` | INTEGER | Snapshot of agent policy version at time |
| `prev_hash` | TEXT | Hash of previous entry (or `"GENESIS"`) |
| `entry_hash` | TEXT | SHA-256 of this entry's canonical JSON |

---

## Pydantic Schemas (API)

### `AgentCreate`
```python
class AgentCreate(BaseModel):
    agent_id: str
    display_name: str
    allowed_actions: List[str]
    blocked_actions: List[str]
    spend_cap_daily: float
```

### `AgentPolicyUpdate`
```python
class AgentPolicyUpdate(BaseModel):
    allowed_actions: Optional[List[str]] = None
    blocked_actions: Optional[List[str]] = None
    spend_cap_daily: Optional[float] = None
```

### `ActionAttempt`
```python
class ActionAttempt(BaseModel):
    agent_id: str
    action_type: str
    amount: float = 0.0
```

---

## Action Types (Known Values)

| Action | Description | Typical Amount |
|---|---|---|
| `flight_rebook` | Rebook a flight | $300–$700 |
| `hotel_rebook` | Rebook a hotel | $150–$450 |
| `waive_fee` | Waive a bank fee | $20–$55 |
| `account_summary` | Read account info | $0 |
| `balance_check` | Read balance | $0 |
| `wire_transfer` | Wire money | $150–$375 |
| `credit_limit_increase` | Increase credit limit | $800–$3,000 |
| `score_check` | Pull credit score | $0 |
| `card_issue` | Issue replacement card | $15–$75 |
| `card_lock` | Lock a card | $0 |

---

## Hash Chain Explained

```
GENESIS
   │
   ▼
Entry 1: { ...data, prev_hash: "GENESIS" }
  entry_hash = SHA256(canonical_json)
   │
   ▼
Entry 2: { ...data, prev_hash: entry_hash_of_1 }
  entry_hash = SHA256(canonical_json)
   │
   ▼
  ...
```

To verify: re-compute each `entry_hash` from stored fields, confirm it matches.
If **any** record is edited/deleted, every subsequent hash breaks.
This is the tamper-evidence guarantee.
