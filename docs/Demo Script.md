# 🎤 Demo Script

Step-by-step judge walkthrough. ~5 minutes.

---

## 0. Setup (before judges arrive)

```bash
# Terminal 1 — Backend
cd /home/infyier/Desktop/governance-project-agentic
python3 -m uvicorn backend.app:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open `http://localhost:5173` in browser. Confirm live feed is flowing.

---

## 1. Opening Line (30 sec)

> "Every major financial institution is racing to deploy autonomous AI agents — agents that book flights, reverse fees, adjust credit limits, issue cards. Almost none of them have the infrastructure to govern that fleet responsibly. This is the control layer."

Point at the **5 agent cards** on screen.

> "Five agents. Each has a policy — what it's allowed to do, what it's explicitly blocked from doing, and a daily spend cap. Every action they attempt gets evaluated against that policy in real time."

---

## 2. Show the Live Feed (1 min)

Point at the right panel (live feed, scrolling).

> "This is happening right now. The background simulator is generating realistic agent actions — rebooking flights, reversing fees, checking balances, attempting wire transfers."

**Point to a red (blocked) entry:**
> "That wire transfer was blocked. The Fee Reversal Agent isn't allowed to initiate wire transfers — that's outside its scope of authority. The policy engine caught it before it executed."

**Point to the spend bar on a card:**
> "The Travel Agent is at 78% of its daily cap. It attempted to rebook a $450 flight — approved. One more large booking and it'll be blocked for the rest of the day."

---

## 3. Emergency Stop Demo (45 sec)

Click **Emergency Stop** (fleet-wide button, top-right area).

> "Something went wrong. I don't know which agent, I don't know what's happening. I need everything stopped, now."

Watch live feed — all new entries should show `blocked: emergency_stop_active`.

> "Every agent in the fleet is now stopped. No action they attempt will execute, regardless of their individual policies."

Click **Resume All**.

> "And when the situation is resolved — resume. Clean, surgical, instant."

---

## 4. Edit a Policy Live (1 min)

Click **Edit Policy** on `fee_reversal_02`.

> "The compliance team just flagged something. Fee Reversal Agent was attempting account summaries — that's inside policy, but the risk team wants it gone."

Remove `account_summary` from allowed actions. Save.

Watch the next audit entry — any `account_summary` attempt by that agent now shows `blocked: action_not_in_allowlist`.

> "Policy updated, version incremented. Every audit entry from this point forward carries the new policy version number. You can reconstruct exactly which rules were in effect for any historical action."

---

## 5. Audit Integrity Check (1 min)

Open `http://localhost:8000/docs` → `GET /audit-log/verify`.

> "This is our tamper-evidence guarantee. Every audit entry is hash-chained — like a mini blockchain. Each entry contains a hash of the previous entry."

Execute it. Show response: `{ "valid": true, "entries_checked": 187 }`

> "187 entries. All valid. If anyone edits, deletes, or reorders a single record in the database, every subsequent hash breaks. You get a forensic record that is mathematically verifiable."

---

## 6. Close (30 sec)

> "In regulated industries — banking, insurance, healthcare — autonomous agents are coming whether the governance infrastructure is ready or not. The question is who builds the guardrails."

> "This is what responsible agent deployment looks like: policy enforcement, spend controls, a kill switch, and an audit trail you can prove in court."

---

## Backup Questions

**Q: Why not a rules engine like Drools?**
> This is purpose-built for agents — policies are versioned per agent, each policy change is stamped on the audit log, and the whole thing is queryable via REST. A generic rules engine doesn't give you the per-agent governance semantics.

**Q: How does this scale?**
> SQLite handles 250k writes/sec. Swap for Postgres for multi-node. The policy engine is stateless — scales horizontally. WebSocket layer moves to Redis pub/sub. Architecture is already decomposed for that.

**Q: Is the hash chain actually secure?**
> It's tamper-evident, not tamper-proof. An adversary with DB write access could reconstruct the chain. Production would add an append-only log service (WORM storage) and periodic root hash notarization.
