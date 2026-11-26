import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False while hydrating server HTML (which is always rendered in English), true afterwards and on client-only renders. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
