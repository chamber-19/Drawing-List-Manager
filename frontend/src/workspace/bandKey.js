// Shared helpers for the workspace components — keep tiny so the band-key
// derivation doesn't drift between NavTree and ProjectView.

// Compute the (typeKey, bandKey) tuple for a drawing using the precomputed
// `_parsed` field that the backend annotates at /api/project/open time.
// Drawings whose number couldn't be parsed (or whose type/band can't be
// resolved) fall through to a synthetic "??" / "_unbanded" bucket so they
// remain visible in the tree rather than vanishing.
export function bandKeyFor(drawing) {
  const p = drawing._parsed;
  if (!p) return { typeKey: "??", bandKey: "_unbanded" };
  return {
    typeKey: `${p.discipline}${p.type_digit}`,
    bandKey: p.band ? `${p.band.start}-${p.band.end}` : "_unbanded",
  };
}
