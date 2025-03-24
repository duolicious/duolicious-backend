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
  useOnline,
};
