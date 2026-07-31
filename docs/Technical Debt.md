# 🧹 Technical Debt

Tracked shortcuts and known issues. Nothing blocking the demo.

---

## Backend

| # | Location | Issue | Fix When |
|---|---|---|---|
| 1 | `app.py:15` | `governance.db` path in project root | Move to `backend/data/` |
| 2 | `app.py:587-676` | Simulator duplicates agent-read + policy logic from `/simulate/action` | Extract shared `run_action(agent_id, action_type, amount)` helper |
| 3 | `app.py` (all) | No auth on any endpoint — kill switch is open | Add JWT middleware |
| 4 | `background_simulator` | No backoff on DB exceptions — silently passes all errors | Add structured error logging |
| 5 | `record_audit_entry` | Opens new DB connection per call — fine for SQLite, not for Postgres | Use dependency injection connection pool |

---

## Frontend

| # | Location | Issue | Fix When |
|---|---|---|---|
| 1 | `App.jsx` | 800-line single file | Split to `AgentCard.jsx`, `AuditTable.jsx`, `LiveFeed.jsx`, `PolicyModal.jsx` |
| 2 | `App.jsx` | Polls `GET /agents` every 2s AND gets WS events | Remove interval, push agent diffs via WS |
| 3 | `App.jsx` | No error state when backend is down | Add error boundary + "backend offline" banner |
| 4 | `App.jsx` | No WS reconnect logic | Exponential backoff reconnect loop |
| 5 | Audit table | No pagination — 50 rows flat | Add "load more" button, infinite scroll |
| 6 | Policy modal | No validation on action inputs (free text) | Dropdown from known action types |

---

## Architecture

| # | Issue | Fix When |
|---|---|---|
| 1 | All governance logic in one file | Split if adding tests or second dev |
| 2 | No unit tests for `evaluate_policy` or `record_audit_entry` | Before prod |
| 3 | Hash chain tamper-evident but not tamper-proof (DB access = full control) | WORM storage + external notarization |
