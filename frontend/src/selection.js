// Selection state hook for the workspace work pane.
//
// - `ids` is a Set of drawing_number strings.
// - `toggle(id, opts)` adds/removes one drawing.
//   - opts.shift: extend to range from anchor to id (using opts.orderedIds)
//   - opts.cmd:   toggle membership without clearing others
//   - default:    replace selection with [id]
// - `clear()` empties the selection.
//
// `orderedIds` is the current visible drawing list in display order — used
// for shift-click range selection. Pass it on every call where it matters.

import { useCallback, useState } from "react";

export function useSelection() {
  const [ids, setIds] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);

  const toggle = useCallback(
    (id, opts = {}) => {
      setIds((prev) => {
        if (opts.shift && anchor && opts.orderedIds) {
          const oi = opts.orderedIds;
          const a = oi.indexOf(anchor);
          const b = oi.indexOf(id);
          if (a !== -1 && b !== -1) {
            const [from, to] = a < b ? [a, b] : [b, a];
            return new Set(oi.slice(from, to + 1));
          }
        }
        if (opts.cmd) {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }
        return new Set([id]);
      });
      if (!opts.shift) setAnchor(id);
    },
    [anchor],
  );

  const clear = useCallback(() => {
    setIds(new Set());
    setAnchor(null);
  }, []);

  return { ids, toggle, clear, anchor };
}
