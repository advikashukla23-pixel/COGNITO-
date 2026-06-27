import { useState, useEffect } from "react";

const PRESET_DOMAINS = [
  { id: "studies", label: "Studies", icon: "📖", description: "deadlines, exams, feeling behind, pressure to perform" },
  { id: "family", label: "Family", icon: "🏠", description: "expectations, tension, feeling misunderstood at home" },
  { id: "relationships", label: "Relationships", icon: "🫂", description: "friendships, romantic, feeling distant or overwhelmed" },
  { id: "physique", label: "Physique", icon: "🪞", description: "body image, health, energy, how you feel in your skin" },
  { id: "loan", label: "Loan / Money", icon: "💸", description: "financial stress, debt, family money pressure, future anxiety" },
];

function shannonEntropy(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return values.filter(v => v > 0).reduce((sum, v) => {
    const p = v / total;
    return sum - p * Math.log2(p);
  }, 0);
}

function getMaxEntropy(n) { return Math.log2(Math.max(n, 1)); }

function interpretEntropy(entropy, maxEntropy, domains, values) {
  const ratio = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const total = values.reduce((a, b) => a + b, 0);
  const sorted = domains.map((d, i) => ({ ...d, value: values[i] })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  const dominant = sorted[0];
  const second = sorted[1];
  const dominantPercent = dominant ? Math.round((dominant.value / total) * 100) : 0;

  if (ratio < 0.35) {
    return {
      level: "Tunnel Vision",
      emoji: "🔦",
      color: "#c0622f",
      tagline: `Right now, ${dominant?.label} is taking up almost all the space.`,
      insight: `${dominantPercent}% of your stress is sitting in ${dominant?.label}. That's a lot to carry in one place. Here's the thing though — when one area gets this loud, it often means your mind is quietly borrowing stress from everywhere else and dumping it here. It feels like a ${dominant?.label} problem. But it might be bigger than that.`,
      prompt: `I want you to do something a little uncomfortable. Think about ${second ? second.label : "the other areas in your life"} — what's one small thing there that's been quietly bothering you? You don't have to fix it. Just name it. Sometimes just seeing it separate from everything else gives you a little room to breathe.`,
      subtext: "Your stress has compressed — that's a real pattern, not a personal failing."
    };
  } else if (ratio < 0.65) {
    return {
      level: "Carrying A Lot",
      emoji: "🎒",
      color: "#b07d2a",
      tagline: `You're holding stress in a few places at once. That's genuinely hard.`,
      insight: `${dominant?.label} is the loudest at ${dominantPercent}%, but you've got weight in multiple areas. This kind of distributed-but-uneven stress is actually one of the harder patterns to sit with — because nothing feels "bad enough" to address, but everything feels a little heavy. Your nervous system is working overtime.`,
      prompt: `Look at the areas you rated lower. Pick one. Ask yourself honestly: has it been sitting at that number for a while, or did it just get quieter lately? Something that's been a low hum for months can be more exhausting than a recent spike. Write one line about it — just for you.`,
      subtext: "You're not overreacting. The load is real, even when it's spread out."
    };
  } else {
    return {
      level: "Spread Thin",
      emoji: "🌊",
      color: "#7a6b3a",
      tagline: "Everything's a little heavy right now. That counts.",
      insight: `Your stress is genuinely spread across multiple areas — nothing catastrophic in one place, but everything asking for something. This is the pattern that's hardest to explain to people, because you can't point to one thing. But distributed stress is still stress. Your body and mind are tracking all of it, even when you're not consciously thinking about it.`,
      prompt: `When everything needs attention, the instinct is to either fix all of it or ignore all of it. Neither works. I want you to pick just one area — the one that would give you the most relief if it improved even slightly — and write down one concrete thing, however small, you could do about it this week.`,
      subtext: "Feeling overwhelmed by 'nothing specific' is a real experience. You're not being dramatic."
    };
  }
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const STORAGE_KEY = "genz-therapist-history";

async function loadHistory() {
  try { const r = await window.storage.get(STORAGE_KEY); return r ? JSON.parse(r.value) : []; }
  catch { return []; }
}
async function saveHistory(entries) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(entries)); }
  catch (e) { console.error(e); }
}

const amber = "#d4871e";
const amberLight = "#e8a83a";
const brown = "#2c1a0e";
const brownMid = "#3e2510";
const brownLight = "#5c3820";
const cream = "#f5efe6";
const creamDark = "#e8ddd0";
const textMain = "#2c1a0e";
const textMuted = "#7a5c42";
const textSoft = "#a08060";
const cardBg = "#fdf8f2";
const cardBorder = "#e8d8c4";

export default function App() {
  const [step, setStep] = useState("intro");
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

  useEffect(() => { loadHistory().then(h => { setHistory(h); setHistoryLoaded(true); }); }, []);
  useEffect(() => { setTimeout(() => setAnimIn(true), 60); }, [step]);

  function goTo(s) { setAnimIn(false); setTimeout(() => setStep(s), 130); }

  function addCustomDomain() {
    const t = customInput.trim(); if (!t) return;
    setDomains(p => [...p, { id: `custom_${Date.now()}`, label: t, icon: "✦", description: "your custom domain" }]);
    setValues(p => [...p, 0]); setCustomInput("");
  }

  function removeDomain(idx) {
    if (!PRESET_DOMAINS.find(p => p.id === domains[idx].id)) {
      setDomains(p => p.filter((_, i) => i !== idx));
      setValues(p => p.filter((_, i) => i !== idx));
    }
  }

  function calculate() {
    const entropy = shannonEntropy(values);
    const maxE = getMaxEntropy(domains.filter((_, i) => values[i] > 0).length);
    const interp = interpretEntropy(entropy, maxE, domains, values);
    const entry = { id: Date.now(), timestamp: Date.now(), domains: domains.map((d, i) => ({ ...d, value: values[i] })), entropy, maxEntropy: maxE, interpretation: interp, reflection: "" };
    setResult(entry); setReflection(""); setReflectionSaved(false); goTo("result");
  }

  async function saveReflection() {
    if (!result) return;
    const updated = { ...result, reflection };
    setResult(updated);
    const nh = [updated, ...history.filter(h => h.id !== updated.id)];
    setHistory(nh); await saveHistory(nh); setReflectionSaved(true);
  }

  async function saveAndGoHistory() {
    if (!result) return;
    const entry = { ...result, reflection };
    const nh = [entry, ...history.filter(h => h.id !== entry.id)];
    setHistory(nh); await saveHistory(nh); goTo("history");
  }

  async function deleteEntry(id) {
    const nh = history.filter(h => h.id !== id);
    setHistory(nh); await saveHistory(nh);
  }

  function reset() {
    setDomains(PRESET_DOMAINS); setValues(PRESET_DOMAINS.map(() => 0));
    setReflection(""); setResult(null); setReflectionSaved(false); goTo("intro");
  }

  const filledCount = values.filter(v => v > 0).length;

  const NAV = (
    <div style={{ background: brownMid, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2px solid ${brownLight}` }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "15px", fontWeight: "700", color: amberLight, fontFamily: "system-ui", letterSpacing: "0.01em" }}>your GenZ therapist</span>
        <span style={{ fontSize: "10px", color: textSoft, fontFamily: "system-ui", letterSpacing: "0.08em", textTransform: "uppercase" }}>for GenZ problems</span>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {step !== "history" && (
          <button onClick={() => goTo("history")} style={{ background: brownLight, border: "none", color: "#c8a882", fontSize: "12px", padding: "7px 14px", cursor: "pointer", borderRadius: "20px", fontFamily: "system-ui", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>Sessions</span>
            {history.length > 0 && <span style={{ background: amber, color: brown, borderRadius: "10px", padding: "1px 7px", fontSize: "10px", fontWeight: "700" }}>{history.length}</span>}
          </button>
        )}
        {step !== "intro" && step !== "history" && (
          <button onClick={reset} style={{ background: "none", border: `1px solid ${brownLight}`, color: textSoft, fontSize: "12px", padding: "7px 14px", cursor: "pointer", borderRadius: "20px", fontFamily: "system-ui" }}>start over</button>
        )}
        {step === "history" && (
          <button onClick={() => goTo("intro")} style={{ background: "none", border: `1px solid ${brownLight}`, color: textSoft, fontSize: "12px", padding: "7px 14px", cursor: "pointer", borderRadius: "20px", fontFamily: "system-ui" }}>← back</button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: cream, color: textMain, fontFamily: "'Georgia', serif", margin: 0, padding: 0 }}>
      {NAV}
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 20px", opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(10px)", transition: "opacity 0.35s ease, transform 0.35s ease" }}>

        {/* ── INTRO ── */}
        {step === "intro" && (
          <div>
            <div style={{ marginBottom: "36px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.14em", color: amber, textTransform: "uppercase", fontFamily: "system-ui", marginBottom: "12px", fontWeight: "600" }}>check in with yourself</div>
              <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: "normal", lineHeight: "1.3", marginBottom: "16px", color: brownMid, letterSpacing: "-0.01em" }}>
                When everything feels like <em style={{ color: amber }}>too much</em>,<br />what's actually going on?
              </h1>
              <p style={{ fontSize: "15px", lineHeight: "1.85", color: textMuted, maxWidth: "500px", margin: 0 }}>
                You know that feeling where you can't even explain why you're stressed, you just are? This helps you figure out what's actually weighing on you — and why it might feel heavier than it should.
              </p>
            </div>

            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "14px", padding: "18px 22px", marginBottom: "32px" }}>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {["📖 Studies", "🏠 Family", "🫂 Relationships", "🪞 Physique", "💸 Loan / Money"].map(d => (
                  <span key={d} style={{ background: creamDark, border: `1px solid ${cardBorder}`, borderRadius: "20px", padding: "5px 12px", fontSize: "12px", color: textMuted, fontFamily: "system-ui" }}>{d}</span>
                ))}
              </div>
              <div style={{ fontSize: "12px", color: textSoft, fontFamily: "system-ui", marginTop: "12px", lineHeight: "1.6" }}>
                Rate your stress across these areas. We'll calculate how compressed or spread out it is — and tell you what that actually means.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button onClick={() => goTo("rate")} style={{ background: amber, border: "none", color: "#fff", fontSize: "15px", padding: "14px 32px", cursor: "pointer", borderRadius: "30px", fontFamily: "system-ui", fontWeight: "700", boxShadow: "0 2px 12px #d4871e44" }}>
                Let's check in →
              </button>
              {historyLoaded && history.length > 0 && (
                <button onClick={() => goTo("history")} style={{ background: "none", border: `1.5px solid ${cardBorder}`, color: textMuted, fontSize: "15px", padding: "14px 28px", cursor: "pointer", borderRadius: "30px", fontFamily: "system-ui" }}>
                  Past sessions ({history.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── RATE ── */}
        {step === "rate" && (
          <div>
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "normal", color: brownMid, marginBottom: "8px" }}>How heavy is each area right now?</h2>
              <p style={{ fontSize: "13px", color: textSoft, fontFamily: "system-ui", lineHeight: "1.65", margin: 0 }}>
                0 means it's genuinely not on your mind. 10 means it's taking up a lot of space. Be honest — this is just for you.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
              {domains.map((domain, idx) => (
                <div key={domain.id} style={{ background: cardBg, border: `1.5px solid ${values[idx] > 0 ? amber + "60" : cardBorder}`, borderRadius: "14px", padding: "16px 18px", transition: "border-color 0.2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <div>
                      <span style={{ fontSize: "16px", marginRight: "7px" }}>{domain.icon}</span>
                      <span style={{ fontSize: "15px", color: brownMid, fontWeight: values[idx] > 0 ? "600" : "normal" }}>{domain.label}</span>
                      <div style={{ fontSize: "11px", color: textSoft, fontFamily: "system-ui", marginTop: "3px", marginLeft: "23px" }}>{domain.description}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "22px", fontWeight: "700", color: values[idx] > 0 ? amber : creamDark, fontFamily: "system-ui", minWidth: "28px", textAlign: "right" }}>{values[idx]}</span>
                      {!PRESET_DOMAINS.find(p => p.id === domain.id) && (
                        <button onClick={() => removeDomain(idx)} style={{ background: "none", border: "none", color: textSoft, cursor: "pointer", fontSize: "13px", padding: "2px 5px" }}>✕</button>
                      )}
                    </div>
                  </div>
                  <input type="range" min="0" max="10" step="1" value={values[idx]}
                    onChange={(e) => { const v = [...values]; v[idx] = parseInt(e.target.value); setValues(v); }}
                    style={{ width: "100%", accentColor: amber, cursor: "pointer", height: "4px" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: textSoft, fontFamily: "system-ui", marginTop: "4px" }}>
                    <span>not really</span><span>a bit</span><span>noticeable</span><span>a lot</span><span>consuming</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: cardBg, border: `1.5px dashed ${cardBorder}`, borderRadius: "14px", padding: "14px 18px", marginBottom: "24px", display: "flex", gap: "10px", alignItems: "center" }}>
              <input type="text" placeholder="Add something else (e.g. Career, Identity, Sleep...)" value={customInput}
                onChange={(e) => setCustomInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomDomain()}
                style={{ flex: 1, background: "none", border: "none", color: textMuted, fontSize: "13px", fontFamily: "system-ui", outline: "none" }} />
              <button onClick={addCustomDomain} style={{ background: creamDark, border: "none", color: textMuted, padding: "7px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontFamily: "system-ui" }}>Add</button>
            </div>

            <button onClick={calculate} disabled={filledCount < 2} style={{
              background: filledCount >= 2 ? amber : creamDark, border: "none",
              color: filledCount >= 2 ? "#fff" : textSoft, fontSize: "15px", padding: "14px 32px",
              cursor: filledCount >= 2 ? "pointer" : "not-allowed", borderRadius: "30px",
              fontFamily: "system-ui", fontWeight: "700", transition: "all 0.2s",
              boxShadow: filledCount >= 2 ? "0 2px 12px #d4871e44" : "none"
            }}>
              {filledCount < 2 ? "Rate at least 2 areas first" : "Show me what's going on →"}
            </button>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <div>
            {/* Header card */}
            <div style={{ background: brownMid, borderRadius: "18px", padding: "28px 24px", marginBottom: "20px" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>{result.interpretation.emoji}</div>
              <div style={{ fontSize: "11px", letterSpacing: "0.12em", color: amberLight, textTransform: "uppercase", fontFamily: "system-ui", marginBottom: "8px", fontWeight: "600" }}>
                {result.interpretation.level}
              </div>
              <div style={{ fontSize: "18px", color: cream, lineHeight: "1.5", marginBottom: "16px" }}>
                {result.interpretation.tagline}
              </div>
              {/* Domain bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {result.domains.filter(d => d.value > 0).sort((a, b) => b.value - a.value).map(d => {
                  const total = result.domains.reduce((a, b) => a + b.value, 0);
                  const pct = total > 0 ? (d.value / total) * 100 : 0;
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "100px", fontSize: "12px", color: "#c8a882", fontFamily: "system-ui", flexShrink: 0 }}>{d.icon} {d.label}</div>
                      <div style={{ flex: 1, background: brownLight, borderRadius: "4px", height: "6px" }}>
                        <div style={{ height: "6px", borderRadius: "4px", background: amberLight, width: `${pct}%`, transition: "width 0.9s ease" }} />
                      </div>
                      <div style={{ width: "36px", fontSize: "11px", color: textSoft, fontFamily: "system-ui", textAlign: "right" }}>{Math.round(pct)}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: "11px", color: textSoft, fontFamily: "system-ui", marginTop: "14px" }}>
                entropy {result.entropy.toFixed(2)} / {result.maxEntropy.toFixed(2)}
              </div>
            </div>

            {/* Insight */}
            <div style={{ background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: "14px", padding: "22px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.12em", color: amber, textTransform: "uppercase", fontFamily: "system-ui", marginBottom: "12px", fontWeight: "600" }}>what's happening</div>
              <p style={{ fontSize: "15px", lineHeight: "1.9", color: textMuted, margin: "0 0 14px 0", fontFamily: "s