import { useEffect, useState } from 'react';
import { Conversation, Inbox } from '../index';
import { listen, lastEvent } from '../../../events/events';
import * as _ from 'lodash';


const getConversationFromInbox = (
  personUuid: string,
  inbox: Inbox | null,
): Conversation | null => {
  if (!inbox) return null;

  return (
    inbox.chats.conversationsMap[personUuid] ??
    inbox.intros.conversationsMap[personUuid] ??
    inbox.archive.conversationsMap[personUuid] ??
    null
  );
};

/**
 * Returns the up-to-date Conversation object for the given personUuid.
 */
const useConversation = (personUuid: string): Conversation | null => {
  const initialConversation = getConversationFromInbox(
    personUuid,
    lastEvent<Inbox | null>('inbox') ?? null
  );

  const [conversation, setConversation] = useState<Conversation | null>(
    initialConversation
  );

  // Subscribe to inbox updates and only update local state when the specific
  // conversation actually changes (reference equality).
  useEffect(() => {
    return listen<Inbox | null>(
      'inbox',
      (newInbox) => {
        const newConv = getConversationFromInbox(personUuid, newInbox ?? null);

        setConversation((prevConv) =>
          _.isEqual(newConv, prevConv) ? prevConv : newConv
        );
      },
      true,
    );
  }, [personUuid]);

  return conversation;
};

export {
  useConversation,
};
