import asyncio
import hashlib
import json
import os
import random
import sqlite3
import uuid
from datetime import datetime
from typing import Any, List, Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_FILE = os.path.join(os.path.dirname(__file__), "governance.db")

app = FastAPI(title="Aegis | Governance Layer for Financial Agents")

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",")] if allowed_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            agent_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            allowed_actions TEXT NOT NULL,
            blocked_actions TEXT NOT NULL,
            spend_cap_daily REAL NOT NULL,
            spend_used_today REAL NOT NULL DEFAULT 0.0,
            status TEXT NOT NULL DEFAULT 'active',
            policy_version INTEGER NOT NULL DEFAULT 1
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            action_id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            amount REAL NOT NULL,
            timestamp TEXT NOT NULL,
            outcome TEXT NOT NULL,
            rule_triggered TEXT,
            policy_version INTEGER NOT NULL,
            prev_hash TEXT NOT NULL,
            entry_hash TEXT NOT NULL
        )
    """)

    conn.commit()

    cursor.execute("SELECT COUNT(*) as count FROM agents")
    if cursor.fetchone()["count"] == 0:
        seed_agents = [
            (
                "travel_agent_01",
                "Travel Rebooking Agent",
                json.dumps(["flight_rebook", "hotel_rebook"]),
                json.dumps(["credit_limit_increase"]),
                1500.00,
                0.0,
                "active",
                1,
            ),
            (
                "fee_reversal_02",
                "Fee Reversal Agent",
                json.dumps(["waive_fee", "account_summary"]),
                json.dumps(["wire_transfer"]),
                500.00,
                0.0,
                "active",
                1,
            ),
            (
                "credit_limit_03",
                "Credit Limit Agent",
                json.dumps(["credit_limit_increase", "score_check"]),
                json.dumps(["card_issue"]),
                5000.00,
                0.0,
                "active",
                1,
            ),
            (
                "card_replacement_04",
                "Card Replacement Agent",
                json.dumps(["card_issue", "card_lock"]),
                json.dumps(["waive_fee"]),
                200.00,
                0.0,
                "active",
                1,
            ),
            (
                "balance_check_05",
                "Account Inquiry Agent",
                json.dumps(["account_summary", "balance_check"]),
                json.dumps(["wire_transfer", "flight_rebook"]),
                100.00,
                0.0,
                "active",
                1,
            ),
        ]
        cursor.executemany(
            """
            INSERT INTO agents (agent_id, display_name, allowed_actions, blocked_actions, spend_cap_daily, spend_used_today, status, policy_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            seed_agents,
        )
        conn.commit()
    conn.close()


class ConnectionManager:
    """Manages active WebSocket client connections for real-time telemetry."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_with_agent(self, log_entry: dict, agent: dict):
        msg = {**log_entry, "_agent_snapshot": agent}
        await self.broadcast(msg)


ws_manager = ConnectionManager()
simulator_running = True


class AgentCreate(BaseModel):
    agent_id: str
    display_name: str
    allowed_actions: List[str]
    blocked_actions: List[str]
    spend_cap_daily: float


class AgentPolicyUpdate(BaseModel):
    allowed_actions: Optional[List[str]] = None
    blocked_actions: Optional[List[str]] = None
    spend_cap_daily: Optional[float] = None


class ActionAttempt(BaseModel):
    agent_id: str
    action_type: str
    amount: float = 0.0


def evaluate_policy(agent: dict, action_type: str, amount: float):
    """Executes sequential policy checks: Status -> Block-List -> Allow-List -> Spend Cap."""
    if agent["status"] == "stopped":
        return "blocked", "emergency_stop_active"
    if action_type in agent["blocked_actions"]:
        return "blocked", "action_not_permitted"
    if action_type not in agent["allowed_actions"]:
        return "blocked", "action_not_in_allowlist"
    if agent["spend_used_today"] + amount > agent["spend_cap_daily"]:
        return "blocked", "spend_cap_exceeded"
    return "approved", None


def compute_entry_hash(entry_data: dict) -> str:
    payload = json.dumps(entry_data, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def record_audit_entry(
    agent_id: str,
    action_type: str,
    amount: float,
    outcome: str,
    rule_triggered: Optional[str],
    policy_version: int,
) -> dict:
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT entry_hash FROM audit_logs ORDER BY rowid DESC LIMIT 1"
    )
    last_row = cursor.fetchone()
    prev_hash = last_row["entry_hash"] if last_row else "GENESIS"

    action_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"

    entry_data = {
        "action_id": action_id,
        "agent_id": agent_id,
        "action_type": action_type,
        "amount": round(amount, 2),
        "timestamp": timestamp,
        "outcome": outcome,
        "rule_triggered": rule_triggered,
        "policy_version": policy_version,
        "prev_hash": prev_hash,
    }

    entry_hash = compute_entry_hash(entry_data)

    cursor.execute(
        """
        INSERT INTO audit_logs (action_id, agent_id, action_type, amount, timestamp, outcome, rule_triggered, policy_version, prev_hash, entry_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            action_id,
            agent_id,
            action_type,
            round(amount, 2),
            timestamp,
            outcome,
            rule_triggered,
            policy_version,
            prev_hash,
            entry_hash,
        ),
    )
    conn.commit()
    conn.close()

    entry_data["entry_hash"] = entry_hash
    return entry_data


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/agents")
def list_agents():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM agents")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append(
            {
                "agent_id": r["agent_id"],
                "display_name": r["display_name"],
                "allowed_actions": json.loads(r["allowed_actions"]),
                "blocked_actions": json.loads(r["blocked_actions"]),
                "spend_cap_daily": r["spend_cap_daily"],
                "spend_used_today": r["spend_used_today"],
                "status": r["status"],
                "policy_version": r["policy_version"],
            }
        )
    return result


@app.post("/agents", status_code=201)
def create_agent(agent: AgentCreate):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT agent_id FROM agents WHERE agent_id = ?", (agent.agent_id,)
    )
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Agent ID already exists")

    cursor.execute(
        """
        INSERT INTO agents (agent_id, display_name, allowed_actions, blocked_actions, spend_cap_daily, spend_used_today, status, policy_version)
        VALUES (?, ?, ?, ?, ?, 0.0, 'active', 1)
    """,
        (
            agent.agent_id,
            agent.display_name,
            json.dumps(agent.allowed_actions),
            json.dumps(agent.blocked_actions),
            agent.spend_cap_daily,
        ),
    )
    conn.commit()
    conn.close()
    return {"message": "Agent created successfully"}


@app.patch("/agents/{agent_id}/policy")
def update_policy(agent_id: str, update: AgentPolicyUpdate):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM agents WHERE agent_id = ?", (agent_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Agent not found")

    allowed = (
        json.dumps(update.allowed_actions)
        if update.allowed_actions is not None
        else row["allowed_actions"]
    )
    blocked = (
        json.dumps(update.blocked_actions)
        if update.blocked_actions is not None
        else row["blocked_actions"]
    )
    cap = (
        update.spend_cap_daily
        if update.spend_cap_daily is not None
        else row["spend_cap_daily"]
    )
    new_version = row["policy_version"] + 1

    cursor.execute(
        """
        UPDATE agents
        SET allowed_actions = ?, blocked_actions = ?, spend_cap_daily = ?, policy_version = ?
        WHERE agent_id = ?
    """,
        (allowed, blocked, cap, new_version, agent_id),
    )
    conn.commit()
    conn.close()
    return {
        "message": "Policy updated",
        "agent_id": agent_id,
        "policy_version": new_version,
    }


@app.post("/agents/{agent_id}/reset-spend")
def reset_spend(agent_id: str):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE agents SET spend_used_today = 0.0 WHERE agent_id = ?",
        (agent_id,),
    )
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Agent not found")

    conn.commit()
    conn.close()
    return {"message": "Spend reset to 0.00", "agent_id": agent_id}


@app.post("/reset-all-spend")
def reset_all_spend():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE agents SET spend_used_today = 0.0")
    conn.commit()
    conn.close()
    return {"message": "All agent spend reset to 0.00"}


@app.post("/simulate/action")
async def simulate_action(attempt: ActionAttempt):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM agents WHERE agent_id = ?", (attempt.agent_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = {
        "agent_id": row["agent_id"],
        "display_name": row["display_name"],
        "allowed_actions": json.loads(row["allowed_actions"]),
        "blocked_actions": json.loads(row["blocked_actions"]),
        "spend_cap_daily": row["spend_cap_daily"],
        "spend_used_today": row["spend_used_today"],
        "status": row["status"],
        "policy_version": row["policy_version"],
    }

    outcome, rule_triggered = evaluate_policy(
        agent, attempt.action_type, attempt.amount
    )

    if outcome == "approved":
        new_spend = round(agent["spend_used_today"] + attempt.amount, 2)
        cursor.execute(
            "UPDATE agents SET spend_used_today = ? WHERE agent_id = ?",
            (new_spend, attempt.agent_id),
        )
        conn.commit()

    conn.close()

    log_entry = record_audit_entry(
        agent_id=attempt.agent_id,
        action_type=attempt.action_type,
        amount=attempt.amount,
        outcome=outcome,
        rule_triggered=rule_triggered,
        policy_version=agent["policy_version"],
    )

    conn2 = get_db()
    snap_row = conn2.execute("SELECT * FROM agents WHERE agent_id = ?", (attempt.agent_id,)).fetchone()
    conn2.close()
    agent_snapshot = {
        "agent_id": snap_row["agent_id"],
        "display_name": snap_row["display_name"],
        "allowed_actions": json.loads(snap_row["allowed_actions"]),
        "blocked_actions": json.loads(snap_row["blocked_actions"]),
        "spend_cap_daily": snap_row["spend_cap_daily"],
        "spend_used_today": snap_row["spend_used_today"],
        "status": snap_row["status"],
        "policy_version": snap_row["policy_version"],
    }
    await ws_manager.broadcast_with_agent(log_entry, agent_snapshot)

    return log_entry


@app.get("/audit-log")
def get_audit_log(
    agent_id: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = []
    if agent_id:
        query += " AND agent_id = ?"
        params.append(agent_id)
    if outcome:
        query += " AND outcome = ?"
        params.append(outcome)

    query += " ORDER BY rowid DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]


@app.get("/audit-log/verify")
def verify_audit_chain():
    """Mathematically verifies unbroken SHA-256 parent-child hash linkage across audit logs."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY rowid ASC")
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return {"valid": True, "entries_checked": 0}

    expected_prev_hash = "GENESIS"
    for row in rows:
        r = dict(row)
        if r["prev_hash"] != expected_prev_hash:
            return {"valid": False, "broken_at": r["action_id"], "reason": "prev_hash mismatch"}

        entry_data = {
            "action_id": r["action_id"],
            "agent_id": r["agent_id"],
            "action_type": r["action_type"],
            "amount": r["amount"],
            "timestamp": r["timestamp"],
            "outcome": r["outcome"],
            "rule_triggered": r["rule_triggered"],
            "policy_version": r["policy_version"],
            "prev_hash": r["prev_hash"],
        }
        recomputed_hash = compute_entry_hash(entry_data)
        if recomputed_hash != r["entry_hash"]:
            return {"valid": False, "broken_at": r["action_id"], "reason": "entry_hash invalid"}

        expected_prev_hash = r["entry_hash"]

    return {"valid": True, "entries_checked": len(rows)}


@app.post("/emergency-stop")
def fleet_emergency_stop():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE agents SET status = 'stopped'")
    conn.commit()
    conn.close()
    return {"message": "Emergency stop triggered for all agents"}


@app.post("/emergency-stop/{agent_id}")
def agent_emergency_stop(agent_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE agents SET status = 'stopped' WHERE agent_id = ?", (agent_id,)
    )
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Agent not found")
    conn.commit()
    conn.close()
    return {"message": f"Agent {agent_id} stopped"}


@app.post("/resume-all")
@app.post("/resume/{agent_id}")
def resume_agent(agent_id: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    if agent_id:
        cursor.execute(
            "UPDATE agents SET status = 'active' WHERE agent_id = ?", (agent_id,)
        )
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Agent not found")
        msg = f"Agent {agent_id} resumed"
    else:
        cursor.execute("UPDATE agents SET status = 'active'")
        msg = "All agents resumed"
    conn.commit()
    conn.close()
    return {"message": msg}


@app.post("/simulator/toggle")
def toggle_simulator(running: bool = Query(...)):
    global simulator_running
    simulator_running = running
    return {"simulator_running": simulator_running}


@app.websocket("/ws/live-feed")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


async def background_simulator():
    action_pool = {
        "travel_agent_01": [
            ("flight_rebook", 450.0),
            ("hotel_rebook", 300.0),
            ("credit_limit_increase", 1000.0),
        ],
        "fee_reversal_02": [
            ("waive_fee", 35.0),
            ("account_summary", 0.0),
            ("wire_transfer", 250.0),
        ],
        "credit_limit_03": [
            ("credit_limit_increase", 2000.0),
            ("score_check", 0.0),
            ("card_issue", 50.0),
        ],
        "card_replacement_04": [
            ("card_issue", 25.0),
            ("card_lock", 0.0),
            ("waive_fee", 50.0),
        ],
        "balance_check_05": [
            ("account_summary", 0.0),
            ("balance_check", 0.0),
            ("wire_transfer", 500.0),
        ],
    }

    await asyncio.sleep(2)
    while True:
        await asyncio.sleep(random.uniform(2.0, 4.0))
        if not simulator_running:
            continue

        agent_ids = list(action_pool.keys())
        selected_agent = random.choice(agent_ids)
        action_type, amount = random.choice(action_pool[selected_agent])

        if amount > 0:
            amount = round(amount * random.uniform(0.8, 1.5), 2)

        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM agents WHERE agent_id = ?", (selected_agent,)
            )
            row = cursor.fetchone()
            if row:
                agent = {
                    "agent_id": row["agent_id"],
                    "display_name": row["display_name"],
                    "allowed_actions": json.loads(row["allowed_actions"]),
                    "blocked_actions": json.loads(row["blocked_actions"]),
                    "spend_cap_daily": row["spend_cap_daily"],
                    "spend_used_today": row["spend_used_today"],
                    "status": row["status"],
                    "policy_version": row["policy_version"],
                }
                outcome, rule_triggered = evaluate_policy(
                    agent, action_type, amount
                )
                if outcome == "approved":
                    new_spend = round(agent["spend_used_today"] + amount, 2)
                    cursor.execute(
                        "UPDATE agents SET spend_used_today = ? WHERE agent_id = ?",
                        (new_spend, selected_agent),
                    )
                    conn.commit()
                    agent["spend_used_today"] = new_spend

                log_entry = record_audit_entry(
                    agent_id=selected_agent,
                    action_type=action_type,
                    amount=amount,
                    outcome=outcome,
                    rule_triggered=rule_triggered,
                    policy_version=agent["policy_version"],
                )
                await ws_manager.broadcast_with_agent(log_entry, agent)
            conn.close()
        except Exception:
            pass


@app.on_event("startup")
def start_simulator_task():
    asyncio.create_task(background_simulator())
