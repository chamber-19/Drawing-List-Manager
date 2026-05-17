// Design tokens for the Drawing List Manager workspace UI.
//
// All 395 T.<key> call sites in the workspace read from this object. The six
// tokens that map cleanly onto desktop-toolkit's --ch-* palette contract
// (bg, acc, bd, fBody, fMono, fDisp) now resolve via CSS var() with the
// original hex literals as fallbacks. The toolkit's ToolkitThemeProvider
// (registered in main.jsx) writes the --ch-* tokens onto :root at mount, so
// a palette swap or font-mode change flows through every component without
// touching call sites.
//
// The remaining tokens (text variants, surface variants, status colors,
// radii) stay as direct hex / px values because the toolkit does not yet
// ship matching variables -- they are local DLM-only refinements of the
// design system table.

export const T = {
  // Base palette -- mapped to --ch-* with hex fallback for initial paint.
  bg:   "var(--ch-bg, #1C1B19)",
  acc:  "var(--ch-accent, #C4884D)",
  bd:   "var(--ch-border, #3E3D38)",

  // Surface ramp -- DLM-local refinements above --ch-bg.
  bgEl:        "#252420",
  bgCard:      "#2C2B27",
  bgCardHover: "#34322D",
  bgDeep:      "#161513",

  // Border variants -- DLM-local refinements above --ch-border.
  bdSoft:   "#2F2E29",
  bdStrong: "#4E4C46",

  // Text ramp.
  t1:  "#F0ECE4",
  t2:  "#A39E93",
  t3:  "#736E64",
  t4:  "#4F4B43",
  tOn: "#1C1B19",

  // Accent variants -- color-mix-eligible from --ch-accent.
  accBright: "#D69960",
  accSoft:   "#C4884D22",
  accGlow:   "#C4884D11",
  accDim:    "#8B5E33",

  // Status colors.
  ok:   "#6B9E6B",
  warn: "#C4A24D",
  err:  "#B85C5C",
  info: "#5C8EB8",

  // Font stacks -- mapped to --ch-font-* so font modes flow through.
  fBody: "var(--ch-font-ui, 'DM Sans'), system-ui, sans-serif",
  fMono: "var(--ch-font-mono, 'JetBrains Mono'), 'SF Mono', monospace",
  fDisp: "var(--ch-font-display, 'Instrument Serif'), Georgia, serif",

  // Radii.
  rSm: "4px",
  r:   "6px",
  rLg: "10px",
};