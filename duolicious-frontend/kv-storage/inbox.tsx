import { storeKv } from './kv-storage';

const inboxNumber = async (key: string, value?: number) => {
  const loaded = await storeKv(
    key,
    value === undefined ? undefined : String(value));

  if (loaded === undefined || loaded === null) {
    return 0;
  }

  const loadedInt = parseInt(loaded);

  if (isNaN(loadedInt)) {
    return 0;
  }

  return loadedInt;
};

const inboxOrder = async (value?: number) => {
  return await inboxNumber('inbox_order', value);
};

const inboxSection = async (value?: number) => {
  return await inboxNumber('inbox_section', value);
};

export {
  inboxOrder,
  inboxSection,
}
