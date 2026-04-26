// Shared CSS injected once at App mount. Holds font import, scrollbar
// styling, and a small set of utility classes used across the workspace.
// Most styling lives inline on components; this stylesheet covers what
// inline styles can't (pseudo-elements, hover, scrollbars, fonts).

import { T } from "./tokens.js";

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  background: ${T.bg};
  color: ${T.t1};
  font-family: ${T.fBody};
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
::selection { background: ${T.acc}; color: ${T.tOn}; }
input, select, textarea, button { font-family: inherit; font-size: inherit; color: inherit; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${T.bd}; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: ${T.t3}; }

/* Disabled affordances render but don't react. */
.dlm-disabled {
  opacity: 0.45;
  cursor: not-allowed !important;
}
.dlm-disabled:hover { background: inherit !important; }

/* Subtle hover affordance shared by interactive rows. */
.dlm-hoverable:hover { background: ${T.bgCardHover}; }

/* Active selection ring used on band-card highlight + nav-row selection. */
.dlm-active {
  background: ${T.accGlow};
  border-color: ${T.acc} !important;
}

@keyframes modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dlm-row-flash {
  0%   { background: ${T.accSoft}; }
  100% { background: transparent; }
}

.dlm-row-flash {
  animation: dlm-row-flash 1.2s ease-out;
}
`;
