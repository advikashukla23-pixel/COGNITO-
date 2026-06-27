import { useState, useEffect, useRef } from "react";

const C = {
  amber: "#d4871e", amberLight: "#e8a83a", brown: "#2c1a0e",
  brownMid: "#3e2510", brownLight: "#5c3820", cream: "#f5efe6",
  creamDark: "#e8ddd0", card: "#fdf8f2", border: "#e2d0bc",
  textMain: "#2c1a0e", textMuted: "#7a5c42", textSoft: "#a08060",
  green: "#4a7a5a",
};

const DOMAINS = [
  { id: "emotional",      label: "Emotional",    icon: "🫀", color: "#c0622f" },
  { id: "loan",          label: "Loan / Money",  icon: "💸", color: "#b07d2a" },
  { id: "family",        label: "Family",        icon: "🏠", color: "#7a6b3a" },
  { id: "physique",      label: "Physique",      icon: "🪞", color: "#4a7a5a" },
  { id: "studies",       label: "Studies",       icon: "📖", color: "#3a5a8a" },
  { id: "relationships", label: "Relationships", icon: "🫂", color: "#7a3a7a" },
];

function shannonEntropy(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return values.filter(v => v > 0).reduce((sum, v) => {
    const p = v / total; return sum - p * Math.log2(p);
  }, 0);
}
function getMaxEntropy(n) { return Math.log2(Math.max(n, 1)); }

function EulerCover() {
  const svgW = 340, svgH = 160, cy = svgH / 2;
  const rx = 32, ry = 62, spacing = 46;
  const startX = svgW / 2 - ((DOMAINS.length - 1) * spacing) / 2;
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ maxWidth: 340, display: "block", margin: "0 auto" }}>
      <defs>
        <marker id="arr" markerWidth="7" markerHeight="7" refX="3" refY="3.5" orient="auto"><polygon points="0 0,7 3.5,0 7" fill={C.amber} /></marker>
        <marker id="arrl" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto-start-reverse"><polygon points="0 0,7 3.5,0 7" fill={C.amber} /></marker>
      </defs>
      <line x1={startX - rx - 8} y1={cy} x2={startX + (DOMAINS.length - 1) * spacing + rx + 8} y2={cy}
        stroke={C.amber} strokeWidth="1.5" markerEnd="url(#arr)" markerStart="url(#arrl)" />
      {DOMAINS.map((d, i) => {
        const x = startX + i * spacing;
        return (
          <g key={d.id}>
            <ellipse cx={x} cy={cy} rx={rx} ry={ry} fill={d.color + "18"} stroke={d.color} strokeWidth="1.5" />
            <text x={x} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
              fontSize="9.5" fill={d.color} fontFamily="system-ui" fontWeight="600"
              transform={`rotate(-90,${x},${cy})`}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

async function callAI(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return data.content.map(b => b.text || "").join("");
}

const SESSION_KEY = "gzt-sessions-v3";
async function loadSessions() {
  try {
    const r = await window.storage.get(SESSION_KEY);
    if (!r || !r.value) return [];
    return JSON.parse(r.value);
  } catch { return []; }
}
async function saveSessions(s) {
  try {
    const result = await window.storage.set(SESSION_KEY, JSON.stringify(s));
    if (!result) console.error("Storage set returned null");
  } catch(e) { console.error("Save error:", e); }
}

export default function App() {
  const [tab, setTab] = useState(0);
  const [animIn, setAnimIn] = useState(true);
  const [userText, setUserText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [sliderValues, setSliderValues] = useState(DOMAINS.map(() => 0));
  const [output, setOutput] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  // task adding
  const [customTaskText, setCustomTaskText] = useState("");
  const [customTaskDomain, setCustomTaskDomain] = useState("studies");
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => { loadSessions().then(setSessions); }, []);
  useEffect(() => { setAnimIn(false); setTimeout(() => setAnimIn(true), 60); }, [tab]);

  function goTab(n) { setAnimIn(false); setTimeout(() => setTab(n), 120); }

  function toggleVoice() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Voice input not supported in this browser. Please type."); return;
    }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-IN";
    r.onresult = (e) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setUserText(t); };
    r.onend = () => setIsListening(false);
    r.start(); recognitionRef.current = r; setIsListening(true);
  }

  async function analyzeText() {
    if (!userText.trim()) return;
    setAiLoading(true);
    try {
      const raw = await callAI(`You are a compassionate GenZ therapist. A user described their stress.
User said: "${userText}"
Respond ONLY with valid JSON, no markdown:
{
  "greeting": "warm 1-sentence personalized acknowledgment",
  "named_domains": ["domain ids explicitly mentioned from: emotional,loan,family,physique,studies,relationships"],
  "named_scores": {"domain_id": score_1_to_10},
  "emotional_vulnerabilities": ["specific vulnerabilities detected"],
  "hidden_stressors": [{"id":"domain_id","label":"label","question":"gentle question","reason":"why relevant"}]
}
Suggest 2-3 hidden_stressors not already named.`);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setExtracted(parsed);
      setSliderValues(DOMAINS.map(d => parsed.named_scores?.[d.id] || 0));
      goTab(2);
    } catch(e) { console.error(e); alert("Something went wrong. Try again."); }
    setAiLoading(false);
  }

  async function generateOutput() {
    setAiLoading(true);
    const domainSummary = DOMAINS.map((d, i) => `${d.label}: ${sliderValues[i]}/10`).join(", ");
    const entropy = shannonEntropy(sliderValues);
    const maxE = getMaxEntropy(sliderValues.filter(v => v > 0).length);
    const ratio = maxE > 0 ? entropy / maxE : 0;
    const compressionLevel = ratio < 0.35 ? "highly compressed (tunnel vision)" : ratio < 0.65 ? "partially distributed" : "spread across many domains";
    try {
      const raw = await callAI(`You are a warm GenZ therapist. User described stress and rated domains.
Said: "${userText}"
Ratings: ${domainSummary}
Entropy: ${compressionLevel} (${entropy.toFixed(2)} of max ${maxE.toFixed(2)})
Vulnerabilities: ${extracted?.emotional_vulnerabilities?.join(", ") || "none"}
Respond ONLY with valid JSON:
{
  "entropy_insight": "2-3 sentences explaining pattern warmly",
  "emotional_note": "2-3 sentences on emotional vulnerabilities — acknowledge fully, honest that app can't fix deep pain, suggest talking to someone",
  "tasks": [{"domain":"label","domain_id":"id","task":"specific doable task this week","why":"one sentence why it helps"}]
}
Tasks only for domains rated 4+. Max 4 tasks. Warm, real language.`);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      // add unique ids and done flag to tasks
      const tasks = (parsed.tasks || []).map(t => ({ ...t, id: `ai_${Date.now()}_${Math.random()}`, done: false, custom: false }));
      const newOutput = { ...parsed, tasks, entropy, maxEntropy: maxE, ratio, timestamp: Date.now(), userText };
      setOutput(newOutput);
      goTab(3);
    } catch(e) { console.error(e); alert("Something went wrong. Try again."); }
    setAiLoading(false);
  }

  // auto-persist whenever output changes (tasks ticked, added, removed)
  useEffect(() => {
    if (!output) return;
    const session = { ...output, savedAt: Date.now(), sliderValues };
    const updated = [session, ...sessions.filter(s => s.timestamp !== output.timestamp)];
    setSessions(updated);
    saveSessions(updated);
  }, [output]);

  function toggleTask(id) {
    setOutput(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)
    }));
  }

  function addCustomTask() {
    if (!customTaskText.trim()) return;
    const domain = DOMAINS.find(d => d.id === customTaskDomain) || DOMAINS[4];
    const newTask = { id: `custom_${Date.now()}`, domain: domain.label, domain_id: domain.id, task: customTaskText.trim(), why: "Added by you.", done: false, custom: true };
    setOutput(prev => ({ ...prev, tasks: [...(prev.tasks || []), newTask] }));
    setCustomTaskText("");
  }

  function removeTask(id) {
    setOutput(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  }

  async function saveSession() {
    if (!output) return;
    const session = { ...output, savedAt: Date.now(), sliderValues };
    const updated = [session, ...sessions.filter(s => s.timestamp !== output.timestamp)];
    setSessions(updated);
    await saveSessions(updated);
    setSaveConfirmed(true);
    setTimeout(() => setSaveConfirmed(false), 2500);
  }

  async function deleteSession(ts) {
    const updated = sessions.filter(s => s.timestamp !== ts);
    setSessions(updated); await saveSessions(updated);
  }

  const filledCount = sliderValues.filter(v => v > 0).length;
  const WRAP = { maxWidth: 620, margin: "0 auto", padding: "32px 18px", opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(10px)", transition: "opacity 0.35s, transform 0.35s" };

  const NAV = (
    <div style={{ background: C.brownMid, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2px solid ${C.brownLight}` }}>
      <div onClick={() => { setShowHistory(false); goTab(0); }} style={{ cursor: "pointer" }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: C.amberLight, fontFamily: "system-ui" }}>your GenZ therapist</div>
        <div style={{ fontSize: "9px", color: C.textSoft, fontFamily: "system-ui", letterSpacing: "0.1em", textTransform: "uppercase" }}>for GenZ problems</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button onClick={() => setShowHistory(h => !h)} style={{ background: showHistory ? C.amber : C.brownLight, border: "none", color: showHistory ? "#fff" : "#c8a882", fontSize: "11px", padding: "6px 12px", cursor: "pointer", borderRadius: "20px", fontFamily: "system-ui", display: "flex", alignItems: "center", gap: "5px" }}>
          <span>Sessions</span>
          {sessions.length > 0 && <span style={{ background: C.amber, color: C.brown, borderRadius: "10px", padding: "1px 6px", fontSize: "10px", fontWeight: "700" }}>{sessions.length}</span>}
        </button>
        <div style={{ display: "flex", gap: "5px" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: tab === i && !showHistory ? C.amber : C.brownLight, transition: "background 0.2s", cursor: "pointer" }} onClick={() => { setShowHistory(false); tab > i && goTab(i); }} />
          ))}
        </div>
      </div>
    </div>
  );

  // ── HISTORY OVERLAY ──
  if (showHistory) return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Georgia', serif" }}>
      {NAV}
      <div style={WRAP}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "normal", color: C.brownMid, margin: 0 }}>Past sessions</h2>
          <span style={{ fontSize: "12px", color: C.textSoft, fontFamily: "system-ui" }}>{sessions.length} saved</span>
        </div>
        {sessions.length === 0 ? (
          <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: "14px", padding: "36px", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: C.textSoft, fontFamily: "system-ui" }}>No saved sessions yet.</div>
          </div>
        ) : sessions.map(s => {
          const done = s.tasks?.filter(t => t.done).length || 0;
          const total = s.tasks?.length || 0;
          return (
            <div key={s.timestamp} style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: "14px", padding: "18px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: C.textSoft, fontFamily: "system-ui", marginBottom: "4px" }}>{new Date(s.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {new Date(s.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                  <div style={{ fontSize: "13px", color: C.textMuted, fontFamily: "system-ui", lineHeight: 1.5, maxWidth: 380 }}>"{s.userText?.slice(0, 100)}{s.userText?.length > 100 ? "..." : ""}"</div>
                </div>
                <button onClick={() => deleteSession(s.timestamp)} style={{ background: "none", border: `1px solid ${C.creamDark}`, color: C.textSoft, fontSize: "10px", padding: "4px 10px", cursor: "pointer", borderRadius: "20px", fontFamily: "system-ui", flexShrink: 0 }}>delete</button>
              </div>
              {total > 0 && (
                <div>
                  <div style={{ fontSize: "11px", color: C.textSoft, fontFamily: "system-ui", marginBottom: "8px" }}>Tasks: {done}/{total} done</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {s.tasks.map(t => {
                      const dom = DOMAINS.find(d => d.id === t.domain_id) || DOMAINS[0];
                      return (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px" }}>{t.done ? "✅" : "⬜"}</span>
                          <span style={{ fontSize: "12px", color: t.done ? C.textSoft : C.textMuted, fontFamily: "system-ui", textDecoration: t.done ? "line-through" : "none" }}>{dom.icon} {t.task}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── TAB 0: COVER ──
  if (tab === 0) return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Georgia', serif" }}>
      {NAV}
      <div style={WRAP}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.16em", color: C.amber, textTransform: "uppercase", fontFamily: "system-ui", fontWeight: "600", marginBottom: "12px" }}>a space to untangle things</div>
          <h1 style={{ fontSize: "clamp(26px, 6vw, 42px)", fontWeight: "normal", color: C.brownMid, lineHeight: 1.2, marginBottom: "8px", letterSpacing: "-0.02em" }}>your GenZ therapist</h1>
          <div style={{ fontSize: "15px", color: C.textMuted, fontFamily: "system-ui", marginBottom: "28px" }}>for GenZ problems</div>
        </div>
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: "20px", padding: "26px 14px 18px", marginBottom: "28px" }}>
          <EulerCover />
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px", marginTop: "18px" }}>
            {DOMAINS.map(d => (
              <span key={d.id} style={{ fontSize: "11px", fontFamily: "system-ui", color: d.color, background: d.color + "15", border: `1px solid ${d.color}40`, borderRadius: "20px", padding: "3px 10px" }}>{d.icon} {d.label}</span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: "13px", color: C.textSoft, fontFamily: "system-ui", lineHeight: 1.8, marginBottom: "28px", textAlign: "center", maxWidth: 400, margin: "0 auto 28px" }}>
          Your stress doesn't live in neat boxes. It bleeds between domains — and the way it bleeds tells you something important.
        </div>
        <div style={{ textAlign: "center" }}>
          <button onClick={() => goTab(1)} style={{ background: C.amber, border: "none", color: "#fff", fontSize: "15px", padding: "14px 38px", cursor: "pointer", borderRadius: "30px", fontFamily: "system-ui", fontWeight: "700", boxShadow: `0 3px 16px ${C.amber}55` }}>Let's talk →</button>
        </div>
      </div>
    </div>
  );

  // ── TAB 1: DESCRIBE ──
  if (tab === 1) return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Georgia', serif" }}>
      {NAV}
      <div style={WRAP}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "22px", color: C.brownMid, marginBottom: "8px" }}>Hey. What's going on?</div>
          <div style={{ fontSize: "13px", color: C.textSoft, fontFamily: "system-ui", lineHeight: 1.7 }}>Just say it — or type it. No structure needed. Whatever's been sitting heavy.</div>
        </div>
        <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: "16px", padding: "4px", marginBottom: "18px" }}>
          <textarea value={userText} onChange={e => setUserText(e.target.value)}
            placeholder="I've been really stressed about my exams, and my parents keep fighting, and I feel like I can't focus on anything..."
            rows={7} style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "14px", fontFamily: "system-ui", color: C.textMain, padding: "14px", resize: "none", lineHeight: 1.8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 10px 10px" }}>
            <button onClick={toggleVoice} style={{ background: isListening ? "#c0622f" : C.creamDark, border: `1.5px solid ${isListening ? "#c0622f" : C.border}`, color: isListening ? "#fff" : C.textMuted, borderRadius: "20px", padding: "6px 14px", cursor: "pointer", fontSize: "12px", fontFamily: "system-ui", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.2s" }}>
              <span>{isListening ? "⏹" : "🎙"}</span><span>{isListening ? "Stop" : "Speak"}</span>
            </button>
          </div>
        </div>
        {isListening && <div style={{ fontSize: "11px", color: "#c0622f", fontFamily: "system-ui", marginBottom: "14px" }}>🔴 Listening... speak naturally</div>}
        <button onClick={analyzeText} disabled={!userText.trim() || aiLoading} style={{ background: userText.trim() && !aiLoading ? C.amber : C.creamDark, border: "none", color: userText.trim() && !aiLoading ? "#fff" : C.textSoft, fontSize: "14px", padding: "13px 30px", cursor: userText.trim() && !aiLoading ? "pointer" : "not-allowed", borderRadius: "30px", fontFamily: "system-ui", fontWeight: "700", transition: "all 0.2s", boxShadow: userText.trim() && !aiLoading ? `0 2px 12px ${C.amber}44` : "none" }}>
          {aiLoading ? "Reading what you shared..." : "Continue →"}
        </button>
      </div>
    </div>
  );

  // ── TAB 2: RATE ──
  if (tab === 2) return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Georgia', serif" }}>
      {NAV}
      <div style={WRAP}>
        {extracted?.greeting && (
          <div style={{ background: C.brownMid, borderRadius: "14px", padding: "16px 20px", marginBottom: "24px" }}>
            <div style={{ fontSize: "14px", color: C.cream, fontFamily: "system-ui", lineHeight: 1.8 }}>{extracted.greeting}</div>
          </div>
        )}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "18px", color: C.brownMid, marginBottom: "5px" }}>Apart from what you described —</div>
          <div style={{ fontSize: "13px", color: C.textSoft, fontFamily: "system-ui", lineHeight: 1.65 }}>How heavy is each area right now? Even if you didn't mention it.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
          {DOMAINS.map((domain, idx) => (
            <div key={domain.id} style={{ background: C.card, border: `1.5px solid ${sliderValues[idx] > 0 ? domain.color + "60" : C.border}`, borderRadius: "12px", padding: "13px 15px", transition: "border-color 0.2s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px" }}>{domain.icon}</span>
                  <span style={{ fontSize: "13px", color: C.brownMid, fontFamily: "system-ui", fontWeight: sliderValues[idx] > 0 ? "600" : "400" }}>{domain.label}</span>
                  {extracted?.named_domains?.includes(domain.id) && <span style={{ fontSize: "9px", background: domain.color + "20", color: domain.color, borderRadius: "10px", padding: "2px 7px", fontFamily: "system-ui" }}>you mentioned</span>}
                  {extracted?.hidden_stressors?.find(h => h.id === domain.id) && <span style={{ fontSize: "9px", background: C.creamDark, color: C.textSoft, borderRadius: "10px", padding: "2px 7px", fontFamily: "system-ui" }}>we noticed</span>}
                </div>
                <span style={{ fontSize: "17px", fontWeight: "700", color: sliderValues[idx] > 0 ? domain.color : C.creamDark, fontFamily: "system-ui" }}>{sliderValues[idx]}</span>
              </div>
              {extracted?.hidden_stressors?.find(h => h.id === domain.id) && (
                <div style={{ fontSize: "11px", color: C.textSoft, fontFamily: "system-ui", fontStyle: "italic", marginBottom: "6px" }}>
                  {extracted.hidden_stressors.find(h => h.id === domain.id).question}
                </div>
              )}
              <input type="range" min="0" max="10" step="1" value={sliderValues[idx]}
                onChange={e => { const v = [...sliderValues]; v[idx] = parseInt(e.target.value); setSliderValues(v); }}
                style={{ width: "100%", accentColor: domain.color, cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: C.textSoft, fontFamily: "system-ui", marginTop: "2px" }}>
                <span>not really</span><span>a bit</span><span>noticeable</span><span>a lot</span><span>consuming</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={generateOutput} disabled={filledCount < 1 || aiLoading} style={{ background: filledCount >= 1 && !aiLoading ? C.amber : C.creamDark, border: "none", color: filledCount >= 1 && !aiLoading ? "#fff" : C.textSoft, fontSize: "14px", padding: "13px 30px", cursor: filledCount >= 1 && !aiLoading ? "pointer" : "not-allowed", borderRadius: "30px", fontFamily: "system-ui", fontWeight: "700", transition: "all 0.2s", boxShadow: filledCount >= 1 && !aiLoading ? `0 2px 12px ${C.amber}44` : "none" }}>
          {aiLoading ? "Putting it together..." : "Show me the full picture →"}
        </button>
      </div>
    </div>
  );

  // ── TAB 3: OUTPUT ──
  if (tab === 3 && output) {
    const pending = output.tasks?.filter(t => !t.done) || [];
    const done = output.tasks?.filter(t => t.done) || [];
    return (
      <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'Georgia', serif" }}>
        {NAV}
        <div style={WRAP}>
          {/* Entropy */}
          <div style={{ background: C.brownMid, borderRadius: "16px", padding: "20px", marginBottom: "14px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.14em", color: C.amberLight, textTransform: "uppercase", fontFamily: "system-ui", fontWeight: "600", marginBottom: "8px" }}>your stress pattern</div>
            <div style={{ fontSize: "13px", color: C.cream, fontFamily: "system-ui", lineHeight: 1.85, marginBottom: "14px" }}>{output.entropy_insight}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {DOMAINS.filter((_, i) => sliderValues[i] > 0).sort((a, b) => sliderValues[DOMAINS.indexOf(b)] - sliderValues[DOMAINS.indexOf(a)]).map(d => {
                const i = DOMAINS.indexOf(d);
                const total = sliderValues.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (sliderValues[i] / total) * 100 : 0;
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "84px", fontSize: "11px", color: "#c8a882", fontFamily: "system-ui", flexShrink: 0 }}>{d.icon} {d.label}</div>
                    <div style={{ flex: 1, background: C.brownLight, borderRadius: "4px", height: "5px" }}>
                      <div style={{ height: "5px", borderRadius: "4px", background: d.color, width: `${pct}%`, transition: "width 0.9s" }} />
                    </div>
                    <div style={{ width: "30px", fontSize: "10px", color: C.textSoft, fontFamily: "system-ui", textAlign: "right" }}>{Math.round(pct)}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emotional note */}
          {output.emotional_note && (
            <div style={{ background: "#fdf2ee", border: `1.5px solid #e8c4b0`, borderRadius: "14px", padding: "18px", marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.14em", color: "#c0622f", textTransform: "uppercase", fontFamily: "system-ui", fontWeight: "600", marginBottom: "8px" }}>a note on emotional vulnerability</div>
              <div style={{ fontSize: "13px", color: C.textMuted, fontFamily: "system-ui", lineHeight: 1.85 }}>{output.emotional_note}</div>
            </div>
          )}

          {/* Tasks */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.14em", color: C.amber, textTransform: "uppercase", fontFamily: "system-ui", fontWeight: "600", marginBottom: "12px" }}>
              what you can do this week
              {output.tasks?.length > 0 && <span style={{ marginLeft: "8px", color: C.textSoft, fontWeight: "400", textTransform: "none", letterSpacing: 0 }}>({done.length}/{output.tasks.length} done)</span>}
            </div>

            {/* Pending tasks */}
            {pending.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                {pending.map(task => {
                  const domain = DOMAINS.find(d => d.id === task.domain_id) || DOMAINS[0];
                  return (
                    <div key={task.id} style={{ background: C.card, border: `1.5px solid ${domain.color}40`, borderRadius: "12px", padding: "13px 15px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <button onClick={() => toggleTask(task.id)} style={{ background: "none", border: `2px solid ${domain.color}`, borderRadius: "50%", width: 22, height: 22, cursor: "pointer", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px" }}>{domain.icon}</span>
                          <span style={{ fontSize: "10px", color: domain.color, fontFamily: "system-ui", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" }}>{task.domain}</span>
                          {task.custom && <span style={{ fontSize: "9px", background: C.creamDark, color: C.textSoft, borderRadius: "10px", padding: "1px 6px", fontFamily: "system-ui" }}>yours</span>}
                        </div>
                        <div style={{ fontSize: "13px", color: C.brownMid, fontFamily: "system-ui", fontWeight: "600", lineHeight: 1.5, marginBottom: "3px" }}>{task.task}</div>
                        {!task.custom && <div style={{ fontSize: "11px", color: C.textSoft, fontFamily: "system-ui", fontStyle: "italic" }}>{task.why}</div>}
                      </div>
                      {task.custom && (
                        <button onClick={() => removeTask(task.id)} style={{ background: "none", border: "none", color: C.textSoft, fontSize: "12px", cursor: "pointer", flexShrink: 0 }}>✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Done tasks */}
            {done.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", color: C.green, fontFamily: "system-ui", fontWeight: "600", marginBottom: "6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>completed ✓</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {done.map(task => {
                    const domain = DOMAINS.find(d => d.id === task.domain_id) || DOMAINS[0];
                    return (
                      <div key={task.id} style={{ background: "#f0f7f3", border: `1.5px solid ${C.green}30`, borderRadius: "12px", padding: "11px 15px", display: "flex", gap: "10px", alignItems: "center" }}>
                        <button onClick={() => toggleTask(task.id)} style={{ background: C.green, border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", flexShrink: 0, color: "#fff", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "12px", color: C.textSoft, fontFamily: "system-ui", textDecoration: "line-through" }}>{domain.icon} {task.task}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add custom task */}
            <div style={{ background: C.card, border: `1.5px dashed ${C.border}`, borderRadius: "12px", padding: "14px 15px", marginTop: "10px" }}>
              <div style={{ fontSize: "11px", color: C.amber, fontFamily: "system-ui", fontWeight: "600", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>+ add your own task</div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <select value={customTaskDomain} onChange={e => setCustomTaskDomain(e.target.value)}
                  style={{ background: C.creamDark, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "6px 12px", fontSize: "12px", color: C.textMuted, fontFamily: "system-ui", outline: "none", cursor: "pointer" }}>
                  {DOMAINS.map(d => <option key={d.id} value={d.id}>{d.icon} {d.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="text" value={customTaskText} onChange={e => setCustomTaskText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomTask()}
                  placeholder="Write your own task..."
                  style={{ flex: 1, background: C.cream, border: `1px solid ${C.border}`, borderRadius: "20px", padding: "8px 14px", fontSize: "13px", color: C.textMain, fontFamily: "system-ui", outline: "none" }} />
                <button onClick={addCustomTask} style={{ background: C.amber, border: "none", color: "#fff", fontSize: "12px", padding: "8px 16px", cursor: "pointer", borderRadius: "20px", fontFamily: "system-ui", fontWeight: "600", flexShrink: 0 }}>Add</button>
              </div>
            </div>
          </div>

          {/* Save + reset */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
            <button onClick={saveSession} style={{ background: saveConfirmed ? C.green : C.brownMid, border: "none", color: C.cream, fontSize: "13px", padding: "11px 22px", cursor: "pointer", borderRadius: "30px", fontFamily: "system-ui", fontWeight: "600", transition: "background 0.3s" }}>
              {saveConfirmed ? "Saved ✓" : "Save session"}
            </button>
            <button onClick={() => { setUserText(""); setExtracted(null); setSliderValues(DOMAINS.map(() => 0)); setOutput(null); goTab(1); }}
              style={{ background: "none", border: `1.5px solid ${C.border}`, color: C.textMuted, fontSize: "13px", padding: "11px 20px", cursor: "pointer", borderRadius: "30px", fontFamily: "system-ui" }}>
              Check in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
