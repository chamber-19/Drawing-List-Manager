// Track whether the in-memory register differs from the last-saved version.
//
// Usage:
//   const dirty = useDirtyState();
//   dirty.markDirty();           // any mutation calls this
//   dirty.markClean();           // call after successful save
//   dirty.isDirty                // boolean
//
// When dirty, a beforeunload listener warns the user before closing the
// window (Tauri respects the standard browser API).

import { useState, useCallback, useEffect } from "react";

export function useDirtyState() {
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => setIsDirty(true), []);
  const markClean = useCallback(() => setIsDirty(false), []);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  return { isDirty, markDirty, markClean };
}
