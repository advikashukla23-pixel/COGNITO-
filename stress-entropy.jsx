import { useState, useEffect } from "react";

const PRESET_DOMAINS = [
  { id: "academic", label: "Academic", icon: "📚", description: "exams, deadlines, performance pressure" },
  { id: "financial", label: "Financial", icon: "💸", description: "money, family expenses, future uncertainty" },
  { id: "social", label: "Social", icon: "🫂", description: "friendships, belonging, conflict" },
  { id: "family", label: "Family", icon: "🏠", description: "relationships, expectations, home tension" },
  { id: "health", label: "Health", icon: "🫀", description: "physical, mental, sleep, energy" },
];

function shannonEntropy(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return values
    .filter((v) => v > 0)
    .reduce((sum, v) => {
      const p = v / total;
      return sum - p * Math.log2(p);
    }, 0);
}

function getMaxEntropy(n) {
  return Math.log2(Math.max(n, 1));
}

function interpretEntropy(entropy, maxEntropy, domains, values) {
  const ratio = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const total = values.reduce((a, b) => a + b, 0);
  const sorted = domains
    .map((d, i) => ({ ...d, value: values[i] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const dominant = sorted[0];
  const dominantPercent = dominant ? Math.round((dominant.value / total) * 100) : 0;

  if (ratio < 0.35) {
    return {
      level: "Compressed",
      color: "#e05c5c",
      tagline: "Your stress has collapsed onto one axis.",
      insight: `${dominantPercent}% of your reported stress is concentrated in ${dominant?.label}. This is what the Defensive Merger pattern looks like from the inside — when pressure from many sources gets channeled through a single emotional proxy, you become aware of that one thing intensely while the others recede from view. The problem isn't just the ${dominant?.label} pressure. It's that the compression is hiding the full picture from you.`,
      prompt: `Take three minutes. Without judging yourself, write down one specific thing that is actually bothering you in each of the other domains — not your biggest worry, just one honest thing. The act of naming them separately is the beginning of decompression.`,
    };
  } else if (ratio < 0.65) {
    return {
      level: "Partially Distributed",
      color: "#e09a3a",
      tagline: "A few sources are carrying most of the weight.",
      insight: `Your stress is partially spread across domains, but ${dominant?.label} is still disproportionately dominant at ${dominantPercent}%. You're maintaining some awareness of multiple pressures, which is good — but the cognitive load is uneven. Some sources may be quietly draining you without registering as "stress" because they're not the loudest signal.`,
      prompt: `Look at the domains you rated lower. Are they genuinely less stressful, or have they just been quieter recently? Sometimes a 3/10 that's been a 3/10 for six months is more exhausting than a 9/10 that just appeared. Write one sentence about what's going on in each domain you scored below 5.`,
    };
  } else {
    return {
      level: "Distributed",
      color: "#4a9e6e",
      tagline: "Your stress is spread across many sources.",
      insight: `Your entropy is high — stress is genuinely distributed across multiple domains rather than compressed onto one. This is actually the more accurate picture of how stress usually works. The challenge here isn't compression; it's that distributed stress can feel diffuse and hard to act on. Everything feels a little heavy, but nothing specific enough to address.`,
      prompt: `With stress distributed like this, the risk is paralysis — feeling overwhelmed without knowing where to start. Pick one domain, just one, and write down the single most concrete action that would reduce that pressure by even 10%. Not solve it. Reduce it by 10%.`,
    };
  }
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const STORAGE_KEY = "euler-mind-history";

async function loadHistory() {
  try {
    const res = await window.storage.get(STORAGE_KEY);
    return res ? JSON.parse(res.value) : [];
  } catch {
    return [];
  }
}

async function saveHistory(entries) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error("Storage error", e);
  }
}

export default function App() {
  const [step, setStep] = useState("intro"); // intro | rate | result | history
  const [domains, setDomains] = useState(PRESET_DOMAINS);
  const [values, setValues] = useState(PRESET_DOMAINS.map(() => 0));
  const [customInput, setCustomInput] = useState("");
  const [reflection, setReflection] = useState("");
  const [result, setResult] = useState(null);
  const [animIn, setAnimIn] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [reflectionSaved, setReflectionSaved] = useState(false);

  useEffect(() => {
    loadHistory().then((h) => {
      setHistory(h);
      setHistoryLoaded(true);
    });
  }, []);

  useEffect(() => {
    setTimeout(() => setAnimIn(true), 50);
  }, [step]);

  function goTo(s) {
    setAnimIn(false);
    setTimeout(() => setStep(s), 120);
  }

  function addCustomDomain() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setDomains((prev) => [...prev, { id: `custom_${Date.now()}`, label: trimmed, icon: "✦", description: "custom domain" }]);
    setValues((prev) => [...prev, 0]);
    setCustomInput("");
  }

  function removeDomain(idx) {
    if (!PRESET_DOMAINS.find(p => p.id === domains[idx].id)) {
      setDomains((prev) => prev.filter((_, i) => i !== idx));
      setValues((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  function calculate() {
    const entropy = shannonEntropy(values);
    const maxE = getMaxEntropy(domains.filter((_, i) => values[i] > 0).length);
    const interp = interpretEntropy(entropy, maxE, domains, values);
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      domains: domains.map((d, i) => ({ ...d, value: values[i] })),
      entropy,
      maxEntropy: maxE,
      interpretation: interp,
      reflection: "",
    };
    setResult(entry);
    setReflection("");
    setReflectionSaved(false);
    goTo("result");
  }

  async function saveReflection() {
    if (!result) return;
    const updated = { ...result, reflection };
    setResult(updated);
    const newHistory = [updated, ...history.filter(h => h.id !== updated.id)];
    setHistory(newHistory);
    await saveHistory(newHistory);
    setReflectionSaved(true);
  }

  async function saveResultToHistory() {
    if (!result) return;
    const entry = { ...result, reflection };
    const newHistory = [entry, ...history.filter(h => h.id !== entry.id)];
    setHistory(newHistory);
    await saveHistory(newHistory);
  }

  async function deleteEntry(id) {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    await saveHistory(newHistory);
  }

  function reset() {
    setDomains(PRESET_DOMAINS);
    setValues(PRESET_DOMAINS.map(() => 0));
    setReflection("");
    setResult(null);
    setReflectionSaved(false);
    goTo("intro");
  }

  const filledCount = values.filter((v) => v > 0).length;

  const NAV = (
    <div style={{
      borderBottom: "1px solid #2a2a35", padding: "16px 28px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "13px", letterSpacing: "0.15em", color: "#7a7a8c", textTransform: "uppercase", fontFamily: "system-ui" }}>Euler Mind</span>
        <span style={{ color: "#2a2a35", margin: "0 6px" }}>·</span>
        <span style={{ fontSize: "13px", color: "#5a5a6c", fontFamily: "system-ui" }}>Stress Entropy Mapper</span>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {step !== "history" && (
          <button onClick={() => goTo("history")} style={{
            background: "none", border: "1px solid #2a2a35", color: "#7a7a8c",
            fontSize: "12px", padding: "6px 14px", cursor: "pointer", borderRadius: "4px",
            fontFamily: "system-ui", display: "flex", alignItems: "center", gap: "6px"
          }}>
            <span>History</span>
            {history.length > 0 && (
              <span style={{ background: "#2a2a42", color: "#9b8ec4", borderRadius: "10px", padding: "1px 7px", fontSize: "11px" }}>
                {history.length}
              </span>
            )}
          </button>
        )}
        {step !== "intro" && step !== "history" && (
          <button onClick={reset} style={{
            background: "none", border: "1px solid #2a2a35", color: "#7a7a8c",
            fontSize: "12px", padding: "6px 14px", cursor: "pointer", borderRadius: "4px", fontFamily: "system-ui"
          }}>Start over</button>
        )}
        {step === "history" && (
          <button onClick={() => goTo("intro")} style={{
            background: "none", border: "1px solid #2a2a35", color: "#7a7a8c",
            fontSize: "12px", padding: "6px 14px", cursor: "pointer", borderRadius: "4px", fontFamily: "system-ui"
          }}>← Back</button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e12", color: "#e8e4dc", fontFamily: "'Georgia', serif", margin: 0, padding: 0 }}>
      {NAV}

      <div style={{
        maxWidth: "680px", margin: "0 auto", padding: "44px 24px",
        opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}>

        {/* ── INTRO ── */}
        {step === "intro" && (
          <div>
            <div style={{ marginBottom: "44px" }}>
              <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", fontWeight: "normal", lineHeight: "1.25", marginBottom: "18px", color: "#f0ece4", letterSpacing: "-0.02em" }}>
                When everything feels heavy,<br />
                <em style={{ color: "#9b8ec4" }}>what is actually weighing on you?</em>
              </h1>
              <p style={{ fontSize: "15px", lineHeight: "1.8", color: "#9a96a0", maxWidth: "520px" }}>
                Stress compresses. When you're overwhelmed, your mind funnels pressure through the loudest signal — making one thing feel like everything. This tool measures that compression using Shannon entropy, and helps you see the actual shape of what you're carrying.
              </p>
            </div>
            <div style={{ background: "#16161e", border: "1px solid #2a2a35", borderRadius: "8px", padding: "18px 22px", marginBottom: "36px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#5a5a6c", textTransform: "uppercase", fontFamily: "system-ui", marginBottom: "8px" }}>How it works</div>
              <div style={{ fontSize: "13px", color: "#8a8698", lineHeight: "1.8", fontFamily: "system-ui" }}>
                Rate your stress across domains → entropy is calculated → you receive a metacognitive insight and reflection prompt. Sessions are saved to your history automatically.
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button onClick={() => goTo("rate")} style={{
                background: "#9b8ec4", border: "none", color: "#0e0e12",
                fontSize: "15px", padding: "13px 30px", cursor: "pointer",
                borderRadius: "6px", fontFamily: "system-ui", fontWeight: "600"
              }}>Map my stress →</button>
              {historyLoaded && history.length > 0 && (
                <button onClick={() => goTo("history")} style={{
                  background: "none", border: "1px solid #2a2a35", color: "#7a7a8c",
                  fontSize: "15px", padding: "13px 30px", cursor: "pointer",
                  borderRadius: "6px", fontFamily: "system-ui"
                }}>View history ({history.length})</button>
              )}
            </div>
          </div>
        )}

        {/* ── RATE ── */}
        {step === "rate" && (
          <div>
            <h2 style={{ fontSize: "21px", fontWeight: "normal", marginBottom: "6px", color: "#f0ece4" }}>Rate each domain</h2>
            <p style={{ fontSize: "13px", color: "#7a7a8c", marginBottom: "32px", fontFamily: "system-ui", lineHeight: "1.6" }}>
              How much is this contributing to your stress right now? 0 = none, 10 = overwhelming. Be honest.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
              {domains.map((domain, idx) => (
                <div key={domain.id} style={{
                  background: "#16161e", border: `1px solid ${values[idx] > 0 ? "#2e2a42" : "#1e1e28"}`,
                  borderRadius: "8px", padding: "16px 18px", transition: "border-color 0.2s"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "15px", marginRight: "7px" }}>{domain.icon}</span>
                      <span style={{ fontSize: "14px", color: "#e0dce8" }}>{domain.label}</span>
                      <div style={{ fontSize: "11px", color: "#5a5a6c", fontFamily: "system-ui", marginTop: "2px", marginLeft: "22px" }}>{domain.description}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px", fontWeight: "300", color: values[idx] > 0 ? "#9b8ec4" : "#3a3a4a", minWidth: "24px", textAlign: "right", fontFamily: "system-ui" }}>
                        {values[idx]}
                      </span>
                      {!PRESET_DOMAINS.find(p => p.id === domain.id) && (
                        <button onClick={() => removeDomain(idx)} style={{ background: "none", border: "none", color: "#4a4a5a", cursor: "pointer", fontSize: "13px", padding: "2px 5px" }}>✕</button>
                      )}
                    </div>
                  </div>
                  <input type="range" min="0" max="10" step="1" value={values[idx]}
                    onChange={(e) => { const v = [...values]; v[idx] = parseInt(e.target.value); setValues(v); }}
                    style={{ width: "100%", accentColor: "#9b8ec4", cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#3a3a4a", fontFamily: "system-ui", marginTop: "3px" }}>
                    <span>none</span><span>mild</span><span>moderate</span><span>high</span><span>overwhelming</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#13131a", border: "1px dashed #2a2a35", borderRadius: "8px", padding: "14px 18px", marginBottom: "28px", display: "flex", gap: "10px", alignItems: "center" }}>
              <input type="text" placeholder="Add another domain (e.g. Career, Identity...)" value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomDomain()}
                style={{ flex: 1, background: "none", border: "none", color: "#c0bcc8", fontSize: "13px", fontFamily: "system-ui", outline: "none" }} />
              <button onClick={addCustomDomain} style={{ background: "#2a2a35", border: "none", color: "#9b8ec4", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontFamily: "system-ui" }}>Add</button>
            </div>
            <button onClick={calculate} disabled={filledCount < 2} style={{
              background: filledCount >= 2 ? "#9b8ec4" : "#2a2a35", border: "none",
              color: filledCount >= 2 ? "#0e0e12" : "#4a4a5a", fontSize: "14px",
              padding: "13px 30px", cursor: filledCount >= 2 ? "pointer" : "not-allowed",
              borderRadius: "6px", fontFamily: "system-ui", fontWeight: "600", transition: "all 0.2s"
            }}>
              {filledCount < 2 ? "Rate at least 2 domains to continue" : "Calculate entropy →"}
            </button>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <div>
            <div style={{ marginBottom: "36px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#5a5a6c", textTransform: "uppercase", fontFamily: "system-ui", marginBottom: "14px" }}>Entropy Score</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "14px" }}>
                <span style={{ fontSize: "52px", fontWeight: "300", color: result.interpretation.color, letterSpacing: "-0.03em" }}>
                  {result.entropy.toFixed(2)}
                </span>
                <div>
                  <div style={{ fontSize: "12px", color: "#7a7a8c", fontFamily: "system-ui" }}>of {result.maxEntropy.toFixed(2)} max</div>
                  <div style={{ fontSize: "13px", fontFamily: "system-ui", color: result.interpretation.color, marginTop: "2px" }}>{result.interpretation.level}</div>
                </div>
              </div>
              <div style={{ background: "#1e1e28", borderRadius: "4px", height: "5px", marginBottom: "20px" }}>
                <div style={{ height: "5px", borderRadius: "4px", background: result.interpretation.color, width: `${Math.min(100, (result.entropy / (result.maxEntropy || 1)) * 100)}%`, transition: "width 1s ease" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {result.domains.map((d) => {
                  const total = result.domains.reduce((a, b) => a + b.value, 0);
                  const pct = total > 0 ? (d.value / total) * 100 : 0;
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "88px", fontSize: "12px", color: "#7a7a8c", fontFamily: "system-ui", flexShrink: 0 }}>{d.icon} {d.label}</div>
                      <div style={{ flex: 1, background: "#1e1e28", borderRadius: "3px", height: "5px" }}>
                        <div style={{ height: "5px", borderRadius: "3px", background: "#9b8ec4", opacity: 0.5 + (pct / 100) * 0.5, width: `${pct}%`, transition: "width 0.8s ease" }} />
                      </div>
                      <div style={{ width: "32px", fontSize: "11px", color: "#5a5a6c", fontFamily: "system-ui", textAlign: "right" }}>{Math.round(pct)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "#16161e", border: `1px solid ${result.interpretation.color}28`, borderRadius: "8px", padding: "22px", marginBottom: "24px" }}>
              <div style={{ fontSize: "17px", color: result.interpretation.color, marginBottom: "12px", fontStyle: "italic" }}>{result.interpretation.tagline}</div>
              <p style={{ fontSize: "14px", lineHeight: "1.85", color: "#a0a0b0", fontFamily: "system-ui", margin: 0 }}>{result.interpretation.insight}</p>
            </div>

            <div style={{ background: "#13131a", border: "1px solid #2a2a35", borderRadius: "8px", padding: "22px", marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#5a5a6c", textTransform: "uppercase", fontFamily: "system-ui", marginBottom: "12px" }}>Metacognitive Prompt</div>
              <p style={{ fontSize: "14px", lineHe