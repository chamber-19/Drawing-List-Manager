import { useEffect } from "react";

// ─── Tokens (framework-level design system) ──────────────────
const T = {
  bg: "#1C1B19", bgEl: "#252420", bgCard: "#2C2B27",
  bd: "#3E3D38",
  t1: "#F0ECE4", t2: "#A39E93", t3: "#736E64", tOn: "#1C1B19",
  acc: "#C4884D",
  fB: "'DM Sans',system-ui,sans-serif",
  fM: "'JetBrains Mono','SF Mono',monospace",
  fD: "'Instrument Serif',Georgia,serif",
  r: "6px", rL: "10px",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};color:${T.t1};font-family:${T.fB};font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
::selection{background:${T.acc};color:${T.tOn}}
input,select,textarea{font-family:inherit;font-size:inherit}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${T.bd};border-radius:3px}
`;

export default function App() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: T.bg }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 32px", borderBottom: `1px solid ${T.bd}`, background: T.bgEl, flexShrink: 0 }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill={T.acc} />
          <text x="14" y="19" textAnchor="middle" fill={T.tOn} fontFamily="monospace" fontWeight="700" fontSize="9">R3P</text>
        </svg>
        <div>
          <div style={{ fontFamily: T.fD, fontSize: "18px", color: T.t1, letterSpacing: "-0.01em" }}>Drawing List Manager</div>
          <div style={{ fontFamily: T.fM, fontSize: "10px", color: T.t3, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "1px" }}>ROOT3POWER</div>
        </div>
      </header>

      {/* Placeholder content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", gap: "16px" }}>
        <div style={{ fontFamily: T.fD, fontSize: "36px", color: T.t1, letterSpacing: "-0.02em" }}>Drawing List Manager</div>
        <div style={{ height: "1px", width: "200px", background: T.bd }} />
        <div style={{ fontFamily: T.fM, fontSize: "11px", color: T.t3, letterSpacing: "0.1em", textTransform: "uppercase" }}>Coming soon</div>
      </main>

      {/* Footer */}
      <footer style={{ display: "flex", justifyContent: "space-between", padding: "10px 32px", borderTop: `1px solid ${T.bd}`, fontSize: "11px", fontFamily: T.fM, color: T.t3, flexShrink: 0, background: T.bgEl }}>
        <span>Drawing List Manager v{__APP_VERSION__}</span>
        <span>ROOT3POWER ENGINEERING</span>
      </footer>

    </div>
  );
}
