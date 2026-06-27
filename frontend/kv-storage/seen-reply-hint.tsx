import { storeKv } from './kv-storage';

const seenReplyHint = async (value?: boolean): Promise<boolean> => {
  const result = await storeKv(
    'seen_reply_hint',
    value === undefined ? undefined : 'true',
  );

  return result === 'true';
};

export {
  seenReplyHint,
};
