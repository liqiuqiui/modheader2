import { useEffect, useRef } from "react";

/**
 * A row is mounted with `autoFocus` after "add" / "clone", but React re-applies
 * the attribute whenever the row is remounted — for example while the search
 * query is being typed. That steals the caret from the search field, so the
 * focus is consumed once per mounted row.
 */
export function useAutoFocusOnce(enabled: boolean): boolean {
  const consumedRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    consumedRef.current = true;
  }, [enabled]);
  return enabled && !consumedRef.current;
}
