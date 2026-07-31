# 🏛️ Governance Layer for Financial Agents

> **CodeStreet Hackathon** — Solo build. Sponsor: American Express.
> Theme: Governance Layer for Financial Agents (least crowded, most technical).

## What This Is

A **control tower**, not the planes. Infrastructure that governs a fleet of autonomous financial AI agents — permissions, spend caps, a kill switch, and a mathematically verifiable audit trail.

**Elevator pitch:**
> "Every major financial institution is racing to deploy autonomous AI agents. Almost none of them have the infrastructure to govern that fleet responsibly. This is the control layer that makes trustworthy agent deployment possible."

---

## Quick Links

- [[Architecture]] — System design, data flow, component breakdown
- [[Backend]] — FastAPI, SQLite, policy engine, hash chain
- [[Frontend]] — React dashboard, WebSocket live feed, UI components
- [[API Reference]] — All REST endpoints + WebSocket
- [[Data Models]] — Agent, AuditEntry, PolicyUpdate schemas
- [[Demo Script]] — Exact judge pitch, step by step
- [[Deployment]] — How to run locally, start servers

---

## Project Structure (Clean)

```
governance-project-agentic/
├── backend/
│   └── app.py          ← Entire backend (FastAPI + SQLite + simulator)
├── frontend/
│   ├── src/
│   │   ├── App.jsx     ← Entire React dashboard
│   │   ├── index.css   ← Tailwind + custom animations
│   │   └── main.jsx    ← React entry
│   ├── package.json
│   └── vite.config.js
├── governance.db       ← SQLite database (auto-created on startup)
└── docs/               ← This Obsidian vault
```

---

## Status

- [x] Phase 0 — Plan
- [x] Phase 1 — Backend core (policy engine, audit log, REST API)
- [x] Phase 2 — Agent simulator (5 personas, asyncio loop)
- [x] Phase 3 — WebSocket live feed
- [x] Phase 4 — React dashboard
- [x] Phase 5 — Demo control panel + audit log UI
- [ ] Phase 6 — Policy versioning UI *(skip — not enough time)*
- [x] Phase 7 — Polish + seed data
