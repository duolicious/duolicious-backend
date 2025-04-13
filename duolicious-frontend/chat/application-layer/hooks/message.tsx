import {
  useLayoutEffect,
  useState,
} from 'react';
import {
  listen,
  notify,
  lastEvent,
} from '../../../events/events';

import {
  Message,
  MessageStatus,
  fetchConversation,
  onReceiveMessage,
  sendMessage,
} from '../index';
import { getRandomString } from '../../../random/string';
import { assertNever } from '../../../util/util';

type UseMessage = {
  status: MessageStatus
  message: Message
};

const eventKey = (messageId: string) => {
  return `use-message-${messageId}`;
};

const notifyMessage = (message: UseMessage) => {
  notify<UseMessage>(eventKey(message.message.id), message);
};

const getMessage = (messageId: string) => {
  return lastEvent<UseMessage>(eventKey(messageId)) ?? null;
};

const useMessage = (messageId: string): UseMessage | null => {
  const key = eventKey(messageId);

  const [message, setMessage] = useState<UseMessage | null>(lastEvent(key) ?? null);

  useLayoutEffect(() => {
    return listen<UseMessage>(
      key,
      (newMessage) => setMessage(newMessage ?? null),
      true
    );
  }, [key]);

  return message;
};

const sendMessageAndNotify = (
  recipientPersonUuid: string,
  content: {
    type: 'chat-text',
    text: string,
  } | {
    type: 'chat-audio',
    audioBase64: string,
  } | {
    type: 'typing',
  },
  config?: {
    numTries?: number,
    timeoutMs?: number,
  }
): string => {
  const id = getRandomString(40);

  const initialMessage: Message = (() => {
    switch (content.type) {
      case 'chat-text':
        return {
          type: 'chat-text',
          from: '',
          to: '',
          id,
          text: content.text,
          timestamp: new Date(),
          fromCurrentUser: true,
        };
      case 'chat-audio':
        return {
          type: 'chat-audio',
          from: '',
          to: '',
          id,
          audioUuid: '',
          timestamp: new Date(),
          fromCurrentUser: true,
        };
      case 'typing':
        return {
          type: 'typing',
          from: '',
          to: '',
          id,
        };
      default:
        return assertNever(content);
    }
  })();

  notifyMessage({ status: 'sending', message: initialMessage });

  (async () => {
    const response = await sendMessage(
      recipientPersonUuid,
      content,
      id,
      config,
    );

    const status = response.status;
    const message = response.message ?? initialMessage;

    notifyMessage({ status, message });
  })();

  return id;
};

const fetchConversationAndNotify = async (
  withPersonUuid: string,
  beforeId: string = '',
): Promise<string[] | 'timeout'> => {
  const conversation = await fetchConversation(withPersonUuid, beforeId);

  if (conversation === 'timeout') {
    return conversation;
  }

  for (const message of conversation) {
    notifyMessage({ status: 'sent', message });
  }

  return conversation.map(message => message.id);
};

const onReceiveMessageAndNotify: typeof onReceiveMessage = (
  callback?: (message: Message) => void,
  otherPersonUuid?: string,
  doMarkDisplayed?: boolean,
) => {
  return onReceiveMessage(
    (message: Message) => {
      notifyMessage({ status: 'sent', message });
      callback?.(message);
    },
    otherPersonUuid,
    doMarkDisplayed
  );
};

export {
  fetchConversationAndNotify,
  getMessage,
  onReceiveMessageAndNotify,
  sendMessageAndNotify,
  useMessage,
};
