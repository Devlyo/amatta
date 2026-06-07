import { useEffect } from 'react';

// Modal-route shell sync — see .omc/plans/ralplan-drawer-route-modal.md §2.
//
// A route that presents a sheet calls this so the ui-store visibility flag
// stays in lockstep with the route's presence: open on mount, close on unmount.
// ui-store remains the single source of truth; the route only owns native
// presentation (formSheet card-recede + swipe-to-dismiss).
//
// INVARIANT: callers navigate only (router.push); the SHELL owns open/close;
// bodies never call open/close except the sibling-swap setParams path.
//
// `deps` MUST list any scalar route params the `open` call depends on
// (scheduleId / mode / occurrenceDate) so an in-place `router.setParams`
// re-drives the store — NOT a bare []. Param-less routes (calendar/search)
// pass []. The close fires exactly once on real unmount, never on dep change,
// so a param swap re-opens without an intermediate closed flicker.
export function useModalRouteShell(
  open: () => void,
  close: () => void,
  deps: readonly unknown[],
): void {
  // Re-open when scalar identity changes (router.setParams in-place).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { open(); }, deps);

  // Close exactly once on route unmount (swipe-dismiss or router.back).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { close(); }, []);
}
