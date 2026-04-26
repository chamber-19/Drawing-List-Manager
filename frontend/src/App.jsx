// App root — owns the "which view" decision (landing vs project) and
// injects shared CSS at mount.

import { Component, useEffect, useRef, useState } from "react";
import { CSS } from "./styles.js";
import { T } from "./tokens.js";
import LandingView from "./views/LandingView.jsx";
import ProjectView from "./views/ProjectView.jsx";

const SESSION_KEY = "dlm.activeMarkerPath";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error("[DLM] uncaught", err, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: T.err, fontFamily: T.fMono }}>
          <div style={{ fontFamily: T.fDisp, fontSize: 22, marginBottom: 8 }}>
            Something went wrong
          </div>
          <pre style={{ whiteSpace: "pre-wrap", color: T.t2 }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function Header({ onClose, hasProject }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 24px",
        borderBottom: `1px solid ${T.bd}`,
        background: T.bgEl,
        flexShrink: 0,
      }}
    >
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill={T.acc} />
        <text
          x="14"
          y="19"
          textAnchor="middle"
          fill={T.tOn}
          fontFamily="monospace"
          fontWeight="700"
          fontSize="9"
        >
          R3P
        </text>
      </svg>
      <div>
        <div style={{ fontFamily: T.fDisp, fontSize: 16, color: T.t1, letterSpacing: "-0.01em" }}>
          Drawing List Manager
        </div>
        <div
          style={{
            fontFamily: T.fMono,
            fontSize: 9,
            color: T.t3,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          ROOT3POWER
        </div>
      </div>
      {hasProject && (
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: `1px solid ${T.bdSoft}`,
            color: T.t2,
            padding: "5px 12px",
            borderRadius: T.rSm,
            fontFamily: T.fMono,
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ← Projects
        </button>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 24px",
        borderTop: `1px solid ${T.bd}`,
        fontSize: 10,
        fontFamily: T.fMono,
        color: T.t3,
        flexShrink: 0,
        background: T.bgEl,
        letterSpacing: "0.06em",
      }}
    >
      <span>Drawing List Manager v{__APP_VERSION__}</span>
      <span>ROOT3POWER ENGINEERING</span>
    </footer>
  );
}

export default function App() {
  // sessionStorage so a hot-reload during dev keeps you on the same project.
  const [activeMarkerPath, setActiveMarkerPath] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });

  // ProjectView registers a close-request gate here so the back button
  // in <Header> can route through the unsaved-changes confirmation.
  const closeGateRef = useRef(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    try {
      if (activeMarkerPath) sessionStorage.setItem(SESSION_KEY, activeMarkerPath);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [activeMarkerPath]);

  function requestClose() {
    const gate = closeGateRef.current;
    if (gate) {
      gate(() => setActiveMarkerPath(null));
    } else {
      setActiveMarkerPath(null);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: T.bg,
        color: T.t1,
      }}
    >
      <Header onClose={requestClose} hasProject={!!activeMarkerPath} />
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ErrorBoundary>
          {activeMarkerPath ? (
            <ProjectView
              key={activeMarkerPath}
              markerPath={activeMarkerPath}
              onClose={() => setActiveMarkerPath(null)}
              registerCloseGate={(fn) => {
                closeGateRef.current = fn;
              }}
            />
          ) : (
            <LandingView onOpen={setActiveMarkerPath} />
          )}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
