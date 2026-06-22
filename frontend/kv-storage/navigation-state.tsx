import { storeKv } from './kv-storage';

// One-shot reader for the pre-`last_path` navigation state. We no longer
// write here - `last_path` is the source of truth - but older app versions
// stored a full navigation tree under `navigation_state`. Reading it through
// this helper migrates and discards the legacy blob in a single call so it
// doesn't sit around in storage forever (it's tens of KB of stale state).
const consumeLegacyNavigationState = async (): Promise<any | null> => {
  const result = await storeKv('navigation_state');
  if (!result) return null;

  // Only spend a write if there was actually something to discard. Fresh
  // installs and users who have already migrated will hit the early return
  // above and skip the AsyncStorage round-trip entirely.
  await storeKv('navigation_state', null);

  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
};

export {
  consumeLegacyNavigationState,
}
