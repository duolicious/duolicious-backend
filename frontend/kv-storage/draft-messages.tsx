import { storeKv } from './kv-storage';

const DRAFT_MESSAGES_KEY = 'draft_messages' as const;

type DraftMap = Record<string, string>;

const makeConversationKey = (
  senderPersonUuid: string,
  recipientPersonUuid: string,
): string => `${senderPersonUuid}__${recipientPersonUuid}`;

const loadDraftMap = async (): Promise<DraftMap> => {
  const raw = await storeKv(DRAFT_MESSAGES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as DraftMap;
  } catch {
    // Corrupted data – reset.
    return {};
  }
};

const saveDraftMap = async (map: DraftMap): Promise<void> => {
  const serialised = Object.keys(map).length ? JSON.stringify(map) : null;
  // Passing null clears the entry.
  await storeKv(DRAFT_MESSAGES_KEY, serialised);
};

const getDraftMessage = async (
  senderPersonUuid: string,
  recipientPersonUuid: string,
): Promise<string> => {
  const map = await loadDraftMap();
  return map[makeConversationKey(senderPersonUuid, recipientPersonUuid)] ?? '';
};

const setDraftMessage = async (
  senderPersonUuid: string,
  recipientPersonUuid: string,
  draft: string,
): Promise<void> => {
  const map = await loadDraftMap();
  const key = makeConversationKey(senderPersonUuid, recipientPersonUuid);
  if (draft) {
    map[key] = draft;
  } else {
    delete map[key];
  }
  await saveDraftMap(map);
};

export {
  getDraftMessage,
  setDraftMessage,
};
