import { useEffect, useState } from 'react';
import { listen, lastEvent, notify } from '../../../events/events';
import { EV_CHAT_WS_RECEIVE } from '../../websocket-layer';
import { useSignedInUser } from '../../../events/signed-in-user';

const ownLastMessageEventKey = (personUuid: string) =>
  `conversation-own-last-message-at-${personUuid}`;

const readAtEventKey = (personUuid: string) =>
  `read-receipt-at-${personUuid}`;

/**
 * Publishes the timestamp of the conversation's last message, but only when the
 * current user is the one who sent it (null otherwise — including when the other
 * person's message is last). The chat controller drives this as messages are
 * sent, received and fetched from the archive; the read-receipt model consumes
 * it to decide whether to show a receipt (or upsell) for that message.
 */
const notifyOwnLastMessageAt = (
  personUuid: string,
  timestamp: Date | null,
) => {
  notify<Date | null>(ownLastMessageEventKey(personUuid), timestamp);
};

// A live message from the other person becomes the conversation's last message,
// so our own message is no longer last and there's nothing to show a receipt
// for: clear it. Our own outgoing messages aren't echoed back on this stream
// (the controller reports them from `sendMessage` instead), and the archived
// history is reconciled whenever the conversation is fetched.
const clearOwnLastMessageOnIncoming = (doc: any) => {
  const message = doc?.message;

  if (!message || message['@type'] !== 'chat') {
    return;
  }

  const personUuid = String(message['@from'] ?? '').split('@')[0];

  if (!personUuid) {
    return;
  }

  if (lastEvent<Date | null>(ownLastMessageEventKey(personUuid)) != null) {
    notifyOwnLastMessageAt(personUuid, null);
  }
};

listen(EV_CHAT_WS_RECEIVE, clearOwnLastMessageOnIncoming);

// Resolve every read receipt to an absolute read time, retained per person.
//
// This is a module-level listener (not a hook) so it's alive before the read
// receipt UI mounts: the authoritative read time arrives, stamped, while the
// conversation is still loading from the archive — well before the element that
// displays it exists. Retaining it means the element picks it up whenever it
// mounts.
//
//  - Stamped receipts (from the archive) are the database's source of truth;
//    keep the latest.
//  - Unstamped receipts are live nudges fired the moment the other person reads.
//    We stamp them with the local clock, but only when they acknowledge a
//    message newer than what we've already recorded, so a re-open (which fires
//    another nudge) doesn't make the read time creep forward.
const resolveReadReceipt = (doc: any) => {
  const message = doc?.message;

  if (!message || message['@type'] !== 'read-receipt') {
    return;
  }

  const personUuid = String(message['@from'] ?? '').split('@')[0];

  if (!personUuid) {
    return;
  }

  const stamp = message.displayed?.['@stamp'];
  const incoming: Date | null = stamp ? new Date(stamp) : null;

  const key = readAtEventKey(personUuid);
  const prev = lastEvent<Date | null>(key) ?? null;

  let next = prev;
  if (incoming) {
    next = !prev || incoming > prev ? incoming : prev;
  } else {
    const ownLastMessageAt =
      lastEvent<Date | null>(ownLastMessageEventKey(personUuid)) ?? null;
    if (ownLastMessageAt && (!prev || ownLastMessageAt > prev)) {
      next = new Date();
    }
  }

  if (next !== prev) {
    notify<Date | null>(key, next);
  }
};

listen(EV_CHAT_WS_RECEIVE, resolveReadReceipt);

const useRetainedDate = (key: string): Date | null => {
  const [value, setValue] = useState<Date | null>(
    lastEvent<Date | null>(key) ?? null
  );

  useEffect(() => {
    setValue(lastEvent<Date | null>(key) ?? null);
    return listen<Date | null>(key, (v) => setValue(v ?? null), true);
  }, [key]);

  return value;
};

/**
 * The time the other person last read our message, but only while our message
 * is the conversation's last one. Null when there's nothing to show: they
 * haven't read it, our message isn't the last one, or we haven't sent one.
 */
const useReadReceipt = (personUuid: string): Date | null => {
  const readAt = useRetainedDate(readAtEventKey(personUuid));
  const ownLastMessageAt = useRetainedDate(ownLastMessageEventKey(personUuid));

  return readAt && ownLastMessageAt && readAt >= ownLastMessageAt
    ? readAt
    : null;
};

/**
 * Whether to offer the read-receipt upsell instead of a receipt: the user can't
 * see read receipts (they're not a gold user) but our message is the last one
 * in the conversation, so there might be a receipt for it. The server never
 * sends receipts to non-gold users, so `useReadReceipt` is always null for them
 * — the two are mutually exclusive.
 */
const useReadReceiptUpsell = (personUuid: string): boolean => {
  const [signedInUser] = useSignedInUser();
  const ownLastMessageAt = useRetainedDate(ownLastMessageEventKey(personUuid));

  return !signedInUser?.hasGold && !!ownLastMessageAt;
};

export {
  notifyOwnLastMessageAt,
  useReadReceipt,
  useReadReceiptUpsell,
};
