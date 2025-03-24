import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  listen,
  notify,
} from '../../../events/events';
import {
  send,
  EV_CHAT_WS_RECEIVE,
} from '../../websocket-layer';
import { assert } from '../../../util/util';

// Global reference counts (online status) per person
const REFERENCE_COUNT_BY_PERSON_UUID: Record<string, number> = {};

// Batching mechanism state
const BATCH_WINDOW_MS = 200;
const pendingDeltas: Record<string, number> = {};
let batchTimeout: ReturnType<typeof setTimeout> | null = null;

const eventKey = (personUuid: string) => {
  return `is-online-${personUuid}`;
};

// Flush pending changes after the batch window expires.
const flushBatch = () => {
  Object.entries(pendingDeltas).forEach(([personUuid, delta]) => {
    const currentCount = REFERENCE_COUNT_BY_PERSON_UUID[personUuid] ?? 0;
    const newCount = currentCount + delta;

    // If we cross the "offline to online" boundary, send subscribe event.
    if (currentCount === 0 && newCount > 0) {
      const data = { duo_subscribe_online: { '@uuid': personUuid } };
      send({ data });
    }
    // If we cross the "online to offline" boundary, send unsubscribe event.
    else if (currentCount > 0 && newCount === 0) {
      const data = { duo_unsubscribe_online: { '@uuid': personUuid } };
      send({ data });
    }

    // Update the global reference count.
    REFERENCE_COUNT_BY_PERSON_UUID[personUuid] = newCount;
  });

  // Clear pending deltas.
  Object.keys(pendingDeltas).forEach(key => delete pendingDeltas[key]);
  batchTimeout = null;
}

// Ensure we have a scheduled flush.
const scheduleBatch = () => {
  if (!batchTimeout) {
    batchTimeout = setTimeout(flushBatch, BATCH_WINDOW_MS);
  }
}

// The subscribe function now only updates the batch.
const subscribe = (personUuid: string) => {
  pendingDeltas[personUuid] = (pendingDeltas[personUuid] ?? 0) + 1;
  scheduleBatch();

  // Return an unsubscribe function that also batches the change.
  return () => {
    pendingDeltas[personUuid] = (pendingDeltas[personUuid] ?? 0) - 1;
    scheduleBatch();
  };
};

const useOnline = (personUuid: string | null | undefined): boolean => {
  const [isOnline, setIsOnline] = useState(false);
  const xmppIsOnlineRef = useRef(false);
  const personSubRef = useRef<{
    removeSubscription: () => void;
    removeListener: () => void;
  } | null>(null);

  useEffect(() => {
    const subscribePerson = () => {
      if (!personUuid || !xmppIsOnlineRef.current || personSubRef.current) {
        return;
      }

      personSubRef.current = {
        removeSubscription: subscribe(personUuid),
        removeListener: listen(
          eventKey(personUuid),
          (data: boolean) => setIsOnline(data ?? false),
          true,
        ),
      };
    };

    const unsubscribePerson = () => {
      if (!personSubRef.current) {
        return;
      }

      personSubRef.current.removeSubscription();
      personSubRef.current.removeListener();
      personSubRef.current = null;
    };

    const removeXmppListener = listen(
      'xmpp-is-online',
      (data: boolean) => {
        const newStatus = data ?? false;
        xmppIsOnlineRef.current = newStatus;
        if (newStatus) {
          subscribePerson();
        } else {
          unsubscribePerson();
        }
      },
      true,
    );

    return () => {
      removeXmppListener();
      unsubscribePerson();
    };
  }, [personUuid]);

  return isOnline;
};

const onReceive = async (doc: any) => {
  try {
    const {
      duo_online_event: {
        '@uuid': personUuid,
        '@status': onlineStatus,
      }
    } = doc;

    assert(personUuid);

    assert(onlineStatus);

    notify<boolean>(eventKey(personUuid), onlineStatus === 'online');
  } catch { }
};

listen(EV_CHAT_WS_RECEIVE, onReceive);

export {
  subscribe,
  useOnline,
};

