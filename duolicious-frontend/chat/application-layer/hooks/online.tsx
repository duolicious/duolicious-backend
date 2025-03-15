import {
  useEffect,
  useLayoutEffect,
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

// TODO: Might need to reset this during logout or when connections are lost
const REFERENCE_COUNT_BY_PERSON_UUID: Record<string, number> = {};

const eventKey = (personUuid: string) => {
  return `is-online-${personUuid}`;
};

const unsubscribe = async (personUuid: string) => {
  const oldReferenceCount = REFERENCE_COUNT_BY_PERSON_UUID[personUuid] ?? 0;
  const newReferenceCount = oldReferenceCount - 1;

  REFERENCE_COUNT_BY_PERSON_UUID[personUuid] = newReferenceCount;

  if (oldReferenceCount === 1 && newReferenceCount === 0) {
    const data = { duo_unsubscribe_online: { '@uuid': personUuid } };

    send({ data });
  }
};

const subscribe = (personUuid: string) => {
  const oldReferenceCount = REFERENCE_COUNT_BY_PERSON_UUID[personUuid] ?? 0;
  const newReferenceCount = oldReferenceCount + 1;

  REFERENCE_COUNT_BY_PERSON_UUID[personUuid] = newReferenceCount;

  if (oldReferenceCount === 0 && newReferenceCount === 1) {
    const data = { duo_subscribe_online: { '@uuid': personUuid } };

    send({ data });
  }

  return () => unsubscribe(personUuid);
};

const useOnline = (personUuid: string | null | undefined): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [xmppIsOnline, setXmppIsOnline] = useState<boolean>(false);

  useLayoutEffect(() => {
    return listen(
      'xmpp-is-online',
      (data) => setXmppIsOnline(data ?? false),
      true,
    );
  }, []);

  useEffect(() => {
    if (!personUuid) {
      return;
    }

    if (!xmppIsOnline) {
      return;
    }

    const removeSubscription = subscribe(personUuid);

    const removeListener = listen<boolean>(
      eventKey(personUuid),
      (data) => setIsOnline(data ?? false),
      true
    );

    return () => {
      removeSubscription();
      removeListener();
    };
  }, [personUuid, xmppIsOnline]);

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
  useOnline,
};
