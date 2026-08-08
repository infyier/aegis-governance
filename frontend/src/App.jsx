import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Activity,
  AlertTriangle,
  Lock,
  Sliders,
  RefreshCw,
  Cpu,
  Copy,
  Check,
  Eye,
  Layers
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/live-feed';

export default function App() {
  const [agents, setAgents] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [simulatorRunning, setSimulatorRunning] = useState(true);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [wsConnected, setWsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [auditLimit, setAuditLimit] = useState(50);
  const [copiedHash, setCopiedHash] = useState(null);
  const [isFeedHovered, setIsFeedHovered] = useState(false);
  const [activeTabMap, setActiveTabMap] = useState({});

  const feedRef = useRef(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      if (res.ok) {
        setAgents(await res.json());
        setIsError(false);
      } else {
        setIsError(true);
      }
    } catch (e) {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async (limit = auditLimit) => {
    try {
      let url = `${API_BASE}/audit-log?limit=${limit}`;
      if (filterAgent !== 'all') url += `&agent_id=${filterAgent}`;
      if (filterOutcome !== 'all') url += `&outcome=${filterOutcome}`;
      const res = await fetch(url);
      if (res.ok) setAuditLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchAuditLogs(auditLimit);
  }, [filterAgent, filterOutcome]);

  const isFeedHoveredRef = useRef(false);
  useEffect(() => {
    isFeedHoveredRef.current = isFeedHovered;
  }, [isFeedHovered]);

  useEffect(() => {
    let ws;
    let isMounted = true;

    const connectWs = () => {
      if (!isMounted) return;
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        if (isMounted) setWsConnected(true);
      };
      ws.onclose = () => {
        if (isMounted) {
          setWsConnected(false);
          setTimeout(connectWs, 3000);
        }
      };
      ws.onmessage = (event) => {
        try {
          const newEntry = JSON.parse(event.data);
          if (newEntry._agent_snapshot) {
            const snap = newEntry._agent_snapshot;
            setAgents((prev) => prev.map((a) => a.agent_id === snap.agent_id ? snap : a));
          }
          if (!isFeedHoveredRef.current) {
            setLiveFeed((prev) => {
              if (prev.some((item) => item.action_id === newEntry.action_id)) return prev;
              return [newEntry, ...prev.slice(0, 49)];
            });
          }
          setAuditLogs((prev) => {
            if (prev.some((item) => item.action_id === newEntry.action_id)) return prev;
            return [newEntry, ...prev];
          });
        } catch (e) {
          console.error(e);
        }
      };
    };

    connectWs();

    return () => {
      isMounted = false;
      if (ws) {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            ws.close();
          };
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const toggleSimulator = async () => {
    const nextState = !simulatorRunning;
    try {
      await fetch(`${API_BASE}/simulator/toggle?running=${nextState}`, { method: 'POST' });
      setSimulatorRunning(nextState);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFleetEmergencyStop = async () => {
    if (!window.confirm('Stop ALL agents in the fleet immediately?')) return;
    try {
      await fetch(`${API_BASE}/emergency-stop`, { method: 'POST' });
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAgentStop = async (agentId) => {
    try {
      await fetch(`${API_BASE}/emergency-stop/${agentId}`, { method: 'POST' });
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async (agentId = null) => {
    try {
      const url = agentId ? `${API_BASE}/resume/${agentId}` : `${API_BASE}/resume-all`;
      await fetch(url, { method: 'POST' });
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetSpend = async (agentId) => {
    try {
      await fetch(`${API_BASE}/agents/${agentId}/reset-spend`, { method: 'POST' });
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAllSpend = async () => {
    try {
      await fetch(`${API_BASE}/reset-all-spend`, { method: 'POST' });
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  const triggerDemoMoment = async (moment) => {
    let payload = {};
    if (moment === 1) {
      payload = { agent_id: 'travel_agent_01', action_type: 'flight_rebook', amount: 450.0 };
    } else if (moment === 2) {
      payload = { agent_id: 'travel_agent_01', action_type: 'credit_limit_increase', amount: 1000.0 };
    }
    if (moment === 1 || moment === 2) {
      try {
        await fetch(`${API_BASE}/simulate/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.error(e);
      }
    } else if (moment === 3) {
      handleFleetEmergencyStop();
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/audit-log/verify`);
      const data = await res.json();
      setVerificationResult(data);
    } catch (e) {
      setVerificationResult({ valid: false, reason: 'Request failed' });
    } fontinally: {
      setVerifying(false);
    }
  };

  const handleSavePolicy = async (agentId, updatedPolicy) => {
    try {
      await fetch(`${API_BASE}/agents/${agentId}/policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPolicy)
      });
      setEditingAgent(null);
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 font-sans p-4 md:p-6">
      <header className="panel-base p-4 mb-6 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#1C2128] rounded-xl text-[#E8A33D]">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#E6E8EB]">
              Aegis | AI Agent Governance Control Tower
            </h1>
            <p className="text-xs text-[#8A93A3] flex items-center gap-2 mt-0.5 font-mono">
              <span>Financial Agent Supervision Infrastructure</span>
              <span className="text-[#8A93A3]">•</span>
              <span className={`inline-block w-2 h-2 rounded-full ${wsConnected ? 'bg-[#4C9A6A]' : 'bg-[#C1443B]'}`} />
              <span>{wsConnected ? 'Live Feed Online' : 'Disconnected'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={toggleSimulator}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-[#1C2128] hover:bg-[#252C35] text-[#E6E8EB] border border-[#2D333B] transition-all"
          >
            {simulatorRunning ? <Pause className="w-3.5 h-3.5 text-[#E8A33D]" /> : <Play className="w-3.5 h-3.5 text-[#4C9A6A]" />}
            {simulatorRunning ? 'Pause Simulator' : 'Start Simulator'}
          </button>

          <button
            onClick={() => handleResume()}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#1C2128] hover:bg-[#252C35] text-[#E6E8EB] border border-[#2D333B] rounded-xl text-xs font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#4C9A6A]" />
            Resume Fleet
          </button>

          <button
            onClick={handleResetAllSpend}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#1C2128] hover:bg-[#252C35] text-[#E6E8EB] border border-[#2D333B] rounded-xl text-xs font-medium transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#E8A33D]" />
            Reset Fleet Spend
          </button>

          <button
            onClick={handleFleetEmergencyStop}
            className="flex items-center gap-2 px-4 py-2 bg-[#C1443B] hover:bg-[#A8372F] text-white font-semibold text-xs rounded-xl transition-all active:scale-95 shadow-sm"
          >
            <ShieldAlert className="w-4 h-4 text-white" />
            Fleet Emergency Stop
          </button>
        </div>
      </header>

      {isError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#C1443B]/10 border border-[#C1443B]/40 text-[#C1443B] text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Backend offline — cannot reach {API_BASE}. Start the FastAPI server and refresh.
        </div>
      )}

      <section className="panel-demo p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#E8A33D] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#E8A33D]" /> Presenter View — Scenario Triggers
          </h2>
          <span className="text-[11px] text-[#8A93A3] font-mono font-semibold">Live Policy Evaluation Drivers</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => triggerDemoMoment(1)}
            className="p-3 bg-[#14171B] hover:bg-[#1C2128] border border-[#2D333B] hover:border-[#4C9A6A]/50 rounded-xl text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#4C9A6A] group-hover:underline font-mono">1. Moment: Approved Action</span>
              <CheckCircle2 className="w-4 h-4 text-[#4C9A6A]" />
            </div>
            <p className="text-[11px] text-[#8A93A3]">Travel Agent rebooks flight ($450) — within policy cap.</p>
          </button>

          <button
            onClick={() => triggerDemoMoment(2)}
            className="p-3 bg-[#14171B] hover:bg-[#1C2128] border border-[#2D333B] hover:border-[#C1443B]/50 rounded-xl text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#C1443B] group-hover:underline font-mono">2. Moment: Policy Blocked</span>
              <XCircle className="w-4 h-4 text-[#C1443B]" />
            </div>
            <p className="text-[11px] text-[#8A93A3]">Travel Agent requests credit increase — blocked (unpermitted).</p>
          </button>

          <button
            onClick={() => triggerDemoMoment(3)}
            className="p-3 bg-[#14171B] hover:bg-[#1C2128] border border-[#2D333B] hover:border-[#C1443B]/50 rounded-xl text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#C1443B] group-hover:underline font-mono">3. Moment: Emergency Stop</span>
              <AlertTriangle className="w-4 h-4 text-[#C1443B]" />
            </div>
            <p className="text-[11px] text-[#8A93A3]">Pull global plug — all agents flip stopped immediately.</p>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold text-[#8A93A3] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#E8A33D]" /> Fleet Agent Status ({agents.length})
            </h2>
            <button onClick={fetchAgents} className="text-[#8A93A3] hover:text-[#E6E8EB] text-xs font-mono flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="panel-base p-4 animate-pulse space-y-3">
                  <div className="h-4 bg-[#1C2128] rounded w-3/4" />
                  <div className="h-3 bg-[#1C2128] rounded w-1/2" />
                  <div className="h-2 bg-[#1C2128] rounded w-full mt-4" />
                </div>
              ))
            ) : (
              agents.map((agent) => {
                const isStopped = agent.status === 'stopped';
                const spendPct = Math.min(100, (agent.spend_used_today / agent.spend_cap_daily) * 100);
                const activeTab = activeTabMap[agent.agent_id] || 'allowed';

                return (
                  <div
                    key={agent.agent_id}
                    className={`panel-base p-4 transition-all border ${
                      isStopped ? 'border-[#C1443B]/60 bg-[#1A1214]' : 'border-[#1E232A] hover:border-[#2D333B]'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-[#E6E8EB]">{agent.display_name}</h3>
                        <p className="text-[11px] text-[#8A93A3] font-mono">ID: {agent.agent_id}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${
                          isStopped
                            ? 'bg-[#C1443B]/20 text-[#C1443B]'
                            : 'bg-[#4C9A6A]/20 text-[#4C9A6A]'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>

                    <div className="bg-[#0E1115] rounded-lg p-2.5 mb-3 border border-[#1E232A]">
                      <div className="flex justify-between text-[11px] mb-1 font-mono">
                        <span className="text-[#8A93A3]">Daily Spend</span>
                        <span className="text-[#E6E8EB] font-bold">
                          ${agent.spend_used_today.toFixed(2)} / ${agent.spend_cap_daily.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-[#181C22] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            spendPct >= 90 ? 'bg-[#C1443B]' : spendPct >= 70 ? 'bg-[#E8A33D]' : 'bg-[#4C9A6A]'
                          }`}
                          style={{ width: `${spendPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex border-b border-[#1E232A] mb-2 font-mono">
                        <button
                          onClick={() => setActiveTabMap((prev) => ({ ...prev, [agent.agent_id]: 'allowed' }))}
                          className={`pb-1 text-[10px] font-bold mr-3 transition-all ${
                            activeTab === 'allowed'
                              ? 'text-[#4C9A6A] border-b border-[#4C9A6A]'
                              : 'text-[#8A93A3] hover:text-[#E6E8EB]'
                          }`}
                        >
                          Allowed ({agent.allowed_actions.length})
                        </button>
                        <button
                          onClick={() => setActiveTabMap((prev) => ({ ...prev, [agent.agent_id]: 'blocked' }))}
                          className={`pb-1 text-[10px] font-bold transition-all ${
                            activeTab === 'blocked'
                              ? 'text-[#C1443B] border-b border-[#C1443B]'
                              : 'text-[#8A93A3] hover:text-[#E6E8EB]'
                          }`}
                        >
                          Blocked ({agent.blocked_actions.length})
                        </button>
                      </div>

                      <div className="min-h-[24px] flex flex-wrap gap-1.5 items-center text-[10px] font-mono text-[#8A93A3]">
                        {activeTab === 'allowed' ? (
                          agent.allowed_actions.length > 0 ? (
                            agent.allowed_actions.map((act) => (
                              <span key={act} className="text-[#4C9A6A]">
                                {act}
                              </span>
                            ))
                          ) : (
                            <span className="italic text-[#8A93A3]">None</span>
                          )
                        ) : (
                          agent.blocked_actions.length > 0 ? (
                            agent.blocked_actions.map((act) => (
                              <span key={act} className="text-[#C1443B]">
                                {act}
                              </span>
                            ))
                          ) : (
                            <span className="italic text-[#8A93A3]">None</span>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#1E232A]">
                      <div className="flex items-center gap-2 font-mono">
                        <button
                          onClick={() => setEditingAgent(agent)}
                          className="p-1.5 bg-[#1C2128] hover:bg-[#252C35] text-[#E6E8EB] rounded-lg text-[11px] flex items-center gap-1 border border-[#2D333B]"
                          title="Edit Policy"
                        >
                          <Sliders className="w-3.5 h-3.5 text-[#E8A33D]" /> Policy
                        </button>
                        <button
                          onClick={() => handleResetSpend(agent.agent_id)}
                          className="p-1.5 bg-[#1C2128] hover:bg-[#252C35] text-[#8A93A3] hover:text-[#E6E8EB] rounded-lg text-[11px] border border-[#2D333B]"
                          title="Reset Spend"
                        >
                          Reset spend
                        </button>
                      </div>

                      {isStopped ? (
                        <button
                          onClick={() => handleResume(agent.agent_id)}
                          className="px-3 py-1 bg-[#4C9A6A]/20 hover:bg-[#4C9A6A]/30 text-[#4C9A6A] rounded-lg text-[11px] font-mono font-bold"
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAgentStop(agent.agent_id)}
                          className="px-3 py-1 bg-[#C1443B]/20 hover:bg-[#C1443B]/30 text-[#C1443B] rounded-lg text-[11px] font-mono font-bold"
                        >
                          Stop Agent
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          onMouseEnter={() => setIsFeedHovered(true)}
          onMouseLeave={() => setIsFeedHovered(false)}
          className="panel-base p-4 flex flex-col h-[540px] relative border border-[#1E232A]"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1E232A]">
            <h2 className="text-xs font-mono font-bold text-[#8A93A3] uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#E8A33D]" /> Live Activity Feed
            </h2>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              {isFeedHovered && (
                <span className="text-[#E8A33D] font-bold">
                  PAUSED ON HOVER
                </span>
              )}
              <span className="text-[#8A93A3]">
                Live Feed
              </span>
            </div>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1">
            {liveFeed.length === 0 ? (
              <p className="text-xs text-[#8A93A3] text-center py-10 font-mono">Awaiting live actions...</p>
            ) : (
              liveFeed.map((entry, idx) => {
                const isApproved = entry.outcome === 'approved';
                return (
                  <div
                    key={`${entry.action_id || 'feed'}-${idx}`}
                    className={`p-2.5 rounded-xl border text-xs font-mono transition-all animate-slide-down ${
                      isApproved
                        ? 'bg-[#121A15] border-[#4C9A6A]/30 text-[#E6E8EB]'
                        : 'bg-[#1F1314] border-[#C1443B]/30 text-[#E6E8EB]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#E6E8EB]">{entry.agent_id}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isApproved ? 'bg-[#4C9A6A]/20 text-[#4C9A6A]' : 'bg-[#C1443B]/20 text-[#C1443B]'
                        }`}
                      >
                        {entry.outcome}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#8A93A3] text-[11px]">
                      <span>{entry.action_type}</span>
                      <span>${entry.amount.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-[#8A93A3] mt-0.5">
                      {entry.timestamp ? entry.timestamp.split('T')[1]?.slice(0, 8) + ' UTC' : ''}
                    </div>
                    {entry.rule_triggered && (
                      <div className="mt-1 text-[10px] text-[#C1443B] flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Rule: {entry.rule_triggered}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <section className="panel-base p-6 border border-[#1E232A]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#1E232A]">
          <div>
            <h2 className="text-sm font-mono font-bold text-[#E6E8EB] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#E8A33D]" /> IMMUTABLE HASH-CHAINED AUDIT LOG
            </h2>
            <p className="text-xs text-[#8A93A3] mt-0.5">
              SHA-256 cryptographic linkage ensures tamper-proof mathematical proof for every agent action.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleVerifyChain}
              disabled={verifying}
              className="flex items-center gap-2 px-4 py-2 bg-[#E8A33D] hover:bg-[#D6922C] text-[#0B0D10] text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 font-mono"
            >
              <ShieldCheck className="w-4 h-4 text-[#0B0D10]" />
              {verifying ? 'Verifying Chain...' : 'Verify Chain Integrity'}
            </button>

            {verificationResult && (
              <div
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 ${
                  verificationResult.valid
                    ? 'bg-[#4C9A6A]/10 border-[#4C9A6A]/40 text-[#4C9A6A]'
                    : 'bg-[#C1443B]/10 border-[#C1443B]/40 text-[#C1443B]'
                }`}
              >
                {verificationResult.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#4C9A6A]" />
                    <span>VALID ({verificationResult.entries_checked} ENTRIES UNBROKEN)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-[#C1443B]" />
                    <span>CHAIN BROKEN AT {verificationResult.broken_at}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#8A93A3]">Agent:</span>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-[#0E1115] border border-[#2D333B] text-[#E6E8EB] rounded-lg px-2.5 py-1"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.agent_id} value={a.agent_id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#8A93A3]">Outcome:</span>
            <select
              value={filterOutcome}
              onChange={(e) => setFilterOutcome(e.target.value)}
              className="bg-[#0E1115] border border-[#2D333B] text-[#E6E8EB] rounded-lg px-2.5 py-1"
            >
              <option value="all">All Outcomes</option>
              <option value="approved">Approved</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E232A] text-[#8A93A3] uppercase tracking-wider text-[10px]">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Agent</th>
                <th className="p-3">Action</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Rule Triggered</th>
                <th className="p-3">SHA-256 Entry Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E232A] text-[#E6E8EB]">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[#8A93A3]">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log, idx) => {
                  const isApproved = log.outcome === 'approved';
                  const isCopied = copiedHash === log.entry_hash;
                  return (
                    <tr key={`${log.action_id || 'log'}-${idx}`} className="hover:bg-[#14181F] transition-all">
                      <td className="p-3 text-[#8A93A3] text-[11px]">{log.timestamp.split('T')[1]?.replace('Z', '') || log.timestamp}</td>
                      <td className="p-3 font-semibold text-[#E6E8EB]">{log.agent_id}</td>
                      <td className="p-3">{log.action_type}</td>
                      <td className="p-3">${log.amount.toFixed(2)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isApproved ? 'bg-[#4C9A6A]/20 text-[#4C9A6A]' : 'bg-[#C1443B]/20 text-[#C1443B]'
                          }`}
                        >
                          {log.outcome}
                        </span>
                      </td>
                      <td className="p-3 text-[#C1443B]">{log.rule_triggered || '-'}</td>
                      <td className="p-3 font-mono text-[10px]">
                        <button
                          onClick={() => copyToClipboard(log.entry_hash)}
                          className="flex items-center gap-1.5 text-[#E8A33D] hover:text-[#F3B85E] bg-[#1C2128] border border-[#2D333B] px-2 py-1 rounded transition-all group"
                          title="Click to copy full SHA-256 hash"
                        >
                          <span className="truncate max-w-[140px] font-mono">{log.entry_hash}</span>
                          {isCopied ? (
                            <Check className="w-3 h-3 text-[#4C9A6A]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#8A93A3] group-hover:text-[#E8A33D]" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-4">
          <button
            onClick={() => {
              const next = auditLimit + 50;
              setAuditLimit(next);
              fetchAuditLogs(next);
            }}
            className="px-5 py-2 bg-[#1C2128] hover:bg-[#252C35] text-[#E6E8EB] text-xs font-mono rounded-xl border border-[#2D333B] transition-all"
          >
            Load 50 more
          </button>
        </div>
      </section>

      {editingAgent && (
        <PolicyEditorModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleSavePolicy}
        />
      )}
    </div>
  );
}

const KNOWN_ACTIONS = 'flight_rebook, hotel_rebook, waive_fee, account_summary, balance_check, wire_transfer, credit_limit_increase, score_check, card_issue, card_lock';

function PolicyEditorModal({ agent, onClose, onSave }) {
  const [allowed, setAllowed] = useState(agent.allowed_actions.join(', '));
  const [blocked, setBlocked] = useState(agent.blocked_actions.join(', '));
  const [spendCap, setSpendCap] = useState(agent.spend_cap_daily);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(agent.agent_id, {
      allowed_actions: allowed.split(',').map((s) => s.trim()).filter(Boolean),
      blocked_actions: blocked.split(',').map((s) => s.trim()).filter(Boolean),
      spend_cap_daily: parseFloat(spendCap)
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl">
        <h3 className="text-base font-bold text-slate-100 mb-1">Edit Policy — {agent.display_name}</h3>
        <p className="text-xs text-slate-400 mb-1 font-mono">Bumps policy version to v{agent.policy_version + 1}</p>
        <p className="text-[10px] text-slate-600 mb-4 font-mono">Known actions: {KNOWN_ACTIONS}</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Allowed Actions (comma separated)</label>
            <input
              type="text"
              value={allowed}
              onChange={(e) => setAllowed(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Blocked Actions (comma separated)</label>
            <input
              type="text"
              value={blocked}
              onChange={(e) => setBlocked(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Daily Spend Cap ($)</label>
            <input
              type="number"
              step="0.01"
              value={spendCap}
              onChange={(e) => setSpendCap(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl"
            >
              Save Policy Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
