import { storeKv } from './kv-storage';

const sessionPersonUuid = async (value?: string | null) => {
  return await storeKv('person_uuid', value);
};

const sessionToken = async (value?: string | null) => {
  return await storeKv('session_token', value);
};

export {
  sessionPersonUuid,
  sessionToken,
}
