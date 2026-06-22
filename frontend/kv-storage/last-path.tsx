import { storeKv } from './kv-storage';

// Stores the last visited URL path (e.g. `/inbox`, `/profile/settings`) so we
// can restore the user's last place without persisting the full navigation
// state tree.
const lastPath = async (value?: string | null) => {
  return await storeKv('last_path', value);
};

export {
  lastPath,
}
