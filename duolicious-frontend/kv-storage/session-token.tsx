import { storeKv } from './kv-storage';

const sessionToken = async (value?: string | null) => {
  return await storeKv('session_token', value);
};

export {
  sessionToken,
}
