import { getRandomString } from '../../random/string';
import { japi } from '../../api/api';
import { deleteFromArray, assert } from '../../util/util';
import { listen, notify, lastEvent } from '../../events/events';
import { registerForPushNotificationsAsync } from '../../notifications/notifications';
import * as _ from 'lodash';
import {
  EV_CHAT_WS_CLOSE,
  EV_CHAT_WS_OPEN,
  EV_CHAT_WS_RECEIVE,
  EV_CHAT_WS_SEND_CLOSE,
  send,
} from '../websocket-layer';

const AUDIO_MESSAGE = 'Audio message';

const messageTimeout = 10000;
const fetchConversationTimeout = 15000;
const fetchInboxTimeout = 30000;

let credentials: null | {
  username: string
  password: string
} = null;

notify('inbox', null);

const jidMatchesSignedInUser = (jid: string) => {
  return jidToBareJid(jid) === credentials?.username;
}

const findEarliestDate = (dates: Date[]): Date | null => {
  // Check if the dates array is empty
  if (dates.length === 0) {
    return null;
  }

  // Convert each Date object to a timestamp, find the minimum, and convert back to a Date object
  const earliestTimestamp = Math.min(...dates.map(date => date.getTime()));
  return new Date(earliestTimestamp);
};

const findEarliestDateInConversations = (conversations: Conversation[]) => {
  const timestamps = conversations.map(c => c.lastMessageTimestamp);
  return findEarliestDate(timestamps);
}

const isValidUuid = (uuid: string): boolean => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

const parseUuidOrNull = (uuid: string): string | null => {
  return isValidUuid(uuid) ? uuid : null;
}


// TODO: Catch more exceptions. If a network request fails, that shouldn't crash the app.
// TODO: Update match percentages when user answers some questions

type MessageStatus =
  | 'sending'
  | 'sent'
  | 'offensive'
  | 'rate-limited-1day'
  | 'rate-limited-1day-unverified-basics'
  | 'rate-limited-1day-unverified-photos'
  | 'voice-intro'
  | 'server-error'
  | 'spam'
  | 'blocked'
  | 'not unique'
  | 'too long'
  | 'timeout'

type ChatBaseMessage = {
  from: string
  to: string
  fromCurrentUser: boolean
  id: string
  mamId?: string | undefined
  timestamp: Date
};

type ChatAudioMessage = ChatBaseMessage & {
  type: 'chat-audio'
  audioUuid: string
};

type ChatTextMessage = ChatBaseMessage & {
  type: 'chat-text'
  text: string
};

type ChatMessage = ChatAudioMessage | ChatTextMessage;

type TypingMessage = {
  from: string
  to: string
  id: string
  type: 'typing'
};

type Message = ChatMessage | TypingMessage

type Conversation = {
  personUuid: string
  name: string
  matchPercentage: number
  imageUuid: string | null
  imageBlurhash: string | null
  lastMessage: string
  lastMessageRead: boolean
  lastMessageTimestamp: Date
  isAvailableUser: boolean
  isVerified: boolean
  location: 'chats' | 'intros' | 'archive' | 'nowhere'
};

type ConversationsMap = { [key: string]: Conversation };

type Conversations = {
  conversations: Conversation[]
  conversationsMap: ConversationsMap
};

type Inbox = {
  chats: Conversations
  intros: Conversations
  archive: Conversations
  endTimestamp: Date | null
};

const getInbox = (): Inbox | null => {
  return lastEvent<Inbox | null>('inbox') ?? null;
}

const inboxStats = (inbox: Inbox): {
  numChats: number
  numUnreadChats: number
  numIntros: number
  numUnreadIntros: number
  numArchive: number
  numUnreadArchive: number
  numChatsAndIntros: number
  numUnreadChatsAndIntros: number
} => {
  const unreadAcc = (sum: number, c: Conversation) =>
    sum + (!c.lastMessageRead ? 1 : 0);

  const unreadSum = (conversations: Conversation[]) =>
    conversations.reduce(unreadAcc, 0);

  const numChats = inbox.chats.conversations.length;
  const numIntros = inbox.intros.conversations.length;
  const numArchive = inbox.archive.conversations.length;
  const numChatsAndIntros = numChats + numIntros;

  const numUnreadChats = unreadSum(inbox.chats.conversations);
  const numUnreadIntros = unreadSum(inbox.intros.conversations);
  const numUnreadArchive = unreadSum(inbox.archive.conversations);
  const numUnreadChatsAndIntros = numUnreadChats + numUnreadIntros;

  return {
    numChats,
    numUnreadChats,
    numIntros,
    numUnreadIntros,
    numArchive,
    numUnreadArchive,
    numChatsAndIntros,
    numUnreadChatsAndIntros,
  };
};

const emptyInbox = (): Inbox => ({
  chats:   { conversations: [], conversationsMap: {} },
  intros:  { conversations: [], conversationsMap: {} },
  archive: { conversations: [], conversationsMap: {} },
  endTimestamp: null
});

const conversationListToMap = (
  conversationList: Conversation[]
): ConversationsMap => {
  return conversationList.reduce<ConversationsMap>(
    (obj, item) => { obj[item.personUuid] = item; return obj; },
    {}
  );
};

const populateConversationList = (
  conversationList: Conversation[],
  apiData: any,
): void => {
  const personUuidToInfo = apiData.reduce((obj, item) => {
    obj[item.person_uuid] = item;
    return obj;
  }, {});


  conversationList.forEach((c: Conversation) => {
    const personInfo = personUuidToInfo[c.personUuid];

    // Update conversation information
    c.name = personInfo?.name ?? 'Unavailable Person';
    c.matchPercentage = personInfo?.match_percentage ?? 0;
    c.imageUuid = personInfo?.image_uuid ?? null;
    c.imageBlurhash = personInfo?.image_blurhash ?? null;
    c.isAvailableUser = !!personInfo?.name;
    c.isVerified = !!personInfo?.verified;
    c.location = personInfo?.conversation_location ?? 'archive';
    c.personUuid = personInfo?.person_uuid ?? c.personUuid ?? '';
  });
};

const populateConversation = async (
  conversation: Conversation
): Promise<void> => {
  const apiData = (
    await japi('post',
    '/inbox-info',
    {person_uuids: [conversation.personUuid]})).json;
  await populateConversationList([conversation], apiData);
};

const jidToBareJid = (jid: string): string =>
  jid.split('@')[0];

const personUuidToJid = (personUuid: string): string =>
  `${personUuid}@duolicious.app`;

const setInboxSent = (recipientPersonUuid: string, message: string) => {
  const i = _.cloneDeep(getInbox() ?? emptyInbox());

  const chatsConversation =
    i.chats.conversationsMap[recipientPersonUuid] as Conversation | undefined;
  const introsConversation =
    i.intros.conversationsMap[recipientPersonUuid] as Conversation | undefined;

  const updatedConversation: Conversation = {
    personUuid: recipientPersonUuid,
    name: '',
    matchPercentage: 0,
    imageUuid: null,
    isAvailableUser: true,
    location: 'archive',
    imageBlurhash: '',
    isVerified: false,
    ...chatsConversation,
    ...introsConversation,
    lastMessage: message,
    lastMessageRead: true,
    lastMessageTimestamp: new Date(),
  };

  // It's a new conversation. It will remain hidden until someone replies
  if (!chatsConversation && !introsConversation) {
    updatedConversation.location = 'nowhere';
  }
  // It was an intro before the new message. Move it to chats
  else if (!chatsConversation) {
    updatedConversation.location = 'chats';

    i.chats.conversationsMap[recipientPersonUuid] = updatedConversation;
    i.chats.conversations = Object.values(i.chats.conversationsMap);

    // Remove conversation from intros
    deleteFromArray(i.intros.conversations, introsConversation);
    delete i.intros.conversationsMap[recipientPersonUuid];
  }
  // It was a chat before the new message. Update the chat.
  else {
    Object.assign(chatsConversation, updatedConversation);
  }

  // We could've returned `i` instead of a shallow copy. But then it
  // wouldn't trigger re-renders when passed to a useState setter.
  notify<Inbox>('inbox', {...i});
};

const setInboxRecieved = async (
  fromPersonUuid: string,
  message: string,
) => {
  const inbox = _.cloneDeep(getInbox() ?? emptyInbox());

  if (!inbox) {
    return;
  }

  const chatsConversation =
    inbox.chats.conversationsMap[fromPersonUuid] as Conversation | undefined;
  const introsConversation =
    inbox.intros.conversationsMap[fromPersonUuid] as Conversation | undefined;
  const archiveConversation =
    inbox.archive.conversationsMap[fromPersonUuid] as Conversation | undefined;

  const updatedConversation: Conversation = {
    personUuid: fromPersonUuid,
    name: '',
    matchPercentage: 0,
    imageUuid: null,
    isAvailableUser: true,
    location: 'archive',
    imageBlurhash: '',
    isVerified: false,
    ...chatsConversation,
    ...introsConversation,
    ...archiveConversation,
    lastMessage: message,
    lastMessageRead: false,
    lastMessageTimestamp: new Date(),
  };

  // The conversation is missing data as it's either new or from the archive
  if (!chatsConversation && !introsConversation) {
    await populateConversation(updatedConversation);
  }

  // Update the conversation in-place, in the `inbox` object
  if (chatsConversation) {
    Object.assign(chatsConversation, updatedConversation);
  } else if (introsConversation) {
    Object.assign(introsConversation, updatedConversation);
  } else if (archiveConversation) {
    Object.assign(archiveConversation, updatedConversation);
  }

  // The conversation's `.location` might have changed, so we need to update the
  // inbox
  if (!chatsConversation && !introsConversation) {
    const updatedConversationsMap = {
      [fromPersonUuid]: updatedConversation
    };

    Object.assign(updatedConversationsMap, inbox.chats.conversationsMap);
    Object.assign(updatedConversationsMap, inbox.intros.conversationsMap);
    Object.assign(updatedConversationsMap, inbox.archive.conversationsMap);

    const updatedConversations = Object.values(updatedConversationsMap);

    const updatedInbox = conversationsToInbox(updatedConversations);

    Object.assign(inbox, updatedInbox);
  }

  notify<Inbox>('inbox', {...inbox});
};

const setInboxDisplayed = (fromPersonUuid: string) => {
  const inbox = _.cloneDeep(getInbox() ?? emptyInbox());

  if (!inbox) {
    return;
  }

  const chatsConversation =
    inbox.chats.conversationsMap[fromPersonUuid] as Conversation | undefined;
  const introsConversation =
    inbox.intros.conversationsMap[fromPersonUuid] as Conversation | undefined;
  const archiveConversation =
    inbox.archive.conversationsMap[fromPersonUuid] as Conversation | undefined;

  const updatedConversation = {
    ...chatsConversation,
    ...introsConversation,
    ...archiveConversation,
    lastMessageRead: true,
  };

  if (chatsConversation) {
    Object.assign(chatsConversation, updatedConversation);
  }
  if (introsConversation) {
    Object.assign(introsConversation, updatedConversation);
  }
  if (archiveConversation) {
    Object.assign(archiveConversation, updatedConversation);
  }

  // We could've returned `inbox` instead of a shallow copy. But then it
  // wouldn't trigger re-renders when passed to a useState setter.
  notify<Inbox>('inbox', {...inbox});
};

const login = async (
  username: string,
  password: string,
) => {
  credentials = { username, password };

  authenticate();
};

const logout = async () => {
  credentials = null;
  await registerPushToken(null);
  notify(EV_CHAT_WS_SEND_CLOSE);
  notify<Inbox | null>('inbox', null);
};

const authenticate = async () => {
  if (!credentials) {
    return;
  }

  if (lastEvent('xmpp-is-online')) {
    return;
  }

  const data = {
    auth: {
      "@xmlns": "urn:ietf:params:xml:ns:xmpp-sasl",
      "@mechanism": "PLAIN",
      "#text": btoa(`\0${credentials.username}\0${credentials.password}`),
    }
  };

  const status = await send({ data });

  if (status === 'timeout') {
    return;
  }

  notify('xmpp-is-online', true);

  await Promise.all([
    refreshInbox(),
    registerForPushNotificationsAsync(),
  ]);
};

const markDisplayed = async (message: ChatMessage) => {
  if (message.fromCurrentUser) return;

  if (!isValidUuid(jidToBareJid(message.from))) return;
  if (!isValidUuid(jidToBareJid(message.to))) return;

  const data = {
    message: {
      '@to': message.from,
      '@from': message.to,
      displayed: {
        '@xmlns': 'urn:xmpp:chat-markers:0',
        '@id': message.id,
      },
    }
  };

  await send({ data });

  setInboxDisplayed(jidToBareJid(message.from));
};

const sendMessage = async (
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
  id: string,
  config?: {
    numTries?: number,
    timeoutMs?: number,
  },
): Promise<
  | { message: Message, status: 'sent' }
  | { message: null, status: Exclude<MessageStatus, 'sent' | 'sending'>}
> => {
  const {
    numTries = 3,
    timeoutMs = messageTimeout,
  } = config ?? {};

  if (numTries <= 0) {
    return { message: null, status: 'timeout' };
  }

  if (!credentials) {
    return { message: null, status: 'blocked' };
  }

  const data = (() => {
    if (content.type === 'typing') {
      return {
        message: {
          '@xmlns': 'jabber:client',
          '@type': 'typing',
          '@from': personUuidToJid(credentials.username),
          '@to': personUuidToJid(recipientPersonUuid),
          '@id': id,
        }
      };
    } else if (content.type === 'chat-text') {
      return {
        message: {
          '@xmlns': 'jabber:client',
          '@type': 'chat',
          '@from': personUuidToJid(credentials.username),
          '@to': personUuidToJid(recipientPersonUuid),
          '@id': id,
          body: content.text,
        },
      };
    } else if (content.type === 'chat-audio') {
      return {
        message: {
          '@xmlns': 'jabber:client',
          '@type': 'chat',
          '@from': personUuidToJid(credentials.username),
          '@to': personUuidToJid(recipientPersonUuid),
          '@id': id,
          '@audio_base64': content.audioBase64,
        },
      };
    } else {
      throw new Error('Unhandled content type');
    }
  })();

  const responseDetector = (doc: any):
    | { status: Exclude<MessageStatus, 'sent' | 'sending' | 'timeout'> }
    | { status: Extract<MessageStatus, 'sent'>, audioUuid?: string }
    | null =>
  {
    type MappingInput = Exclude<MessageStatus, 'sending' | 'timeout'>;

    const messageStatusMapping: Record<
      MappingInput,
      (doc: any) => false | { audioUuid?: string }
    > = {
      'sent': (doc) =>
        doc.duo_message_delivered?.['@id'] === id &&
        { audioUuid: doc.duo_message_delivered?.['@audio_uuid'] },
      'offensive': (doc) =>
        doc.duo_message_blocked?.['@reason'] === 'offensive' &&
        {},
      'rate-limited-1day': (doc) =>
        doc.duo_message_blocked?.['@id'] === id &&
        doc.duo_message_blocked?.['@reason'] === 'rate-limited-1day' &&
        !doc.duo_message_blocked?.['@subreason'] &&
        {},
      'rate-limited-1day-unverified-basics': (doc) =>
        doc.duo_message_blocked?.['@id'] === id &&
        doc.duo_message_blocked?.['@reason'] === 'rate-limited-1day' &&
        doc.duo_message_blocked?.['@subreason'] === 'unverified-basics' &&
        {},
      'rate-limited-1day-unverified-photos': (doc) =>
        doc.duo_message_blocked?.['@id'] === id &&
        doc.duo_message_blocked?.['@reason'] === 'rate-limited-1day' &&
        doc.duo_message_blocked?.['@subreason'] === 'unverified-photos' &&
        {},
      'voice-intro': (doc) =>
        doc.duo_message_blocked?.['@id'] === id &&
        doc.duo_message_blocked?.['@reason'] === 'voice-intro' &&
        {},
      'spam': (doc) =>
        doc.duo_message_blocked?.['@id'] === id &&
        doc.duo_message_blocked?.['@reason'] === 'spam' &&
        {},
      'blocked': (doc) =>
        // Fallback for any blocked case not caught above.
        doc.duo_message_blocked?.['@id'] === id &&
        doc.duo_message_blocked !== undefined &&
        {},
      'not unique': (doc) =>
        doc.duo_message_not_unique?.['@id'] === id &&
        doc.duo_message_not_unique !== undefined &&
        {},
      'too long': (doc) =>
        doc.duo_message_too_long?.['@id'] === id &&
        doc.duo_message_too_long !== undefined &&
        {},
      'server-error': (doc) =>
        doc.duo_server_error?.['@id'] === id &&
        doc.duo_server_error !== undefined &&
        {},
    };

    for (const [status, subDetector] of Object.entries(messageStatusMapping)) {
      const detectedContent = subDetector(doc);
      if (detectedContent) {
        return {
          status: status as MappingInput,
          ...detectedContent
        };
      }
    }

    return null;
  };

  if (content.type === 'typing') {
    await send({ data, timeoutMs });

    return {
      message: {
        type: 'typing',
        from: personUuidToJid(credentials.username),
        to: personUuidToJid(recipientPersonUuid),
        id,
      },
      status: 'sent', // Deliberately ignore timeouts for typing indicators
    };
  }

  const response = await send({ data, responseDetector, timeoutMs });

  if (response === 'timeout') {
    ;
  } else if (response.status === 'sent' && response.audioUuid) {
    setInboxSent(recipientPersonUuid, AUDIO_MESSAGE);

    notify(`message-to-${recipientPersonUuid}`);

    return {
      message: {
        type: 'chat-audio',
        from: personUuidToJid(credentials.username),
        to: personUuidToJid(recipientPersonUuid),
        id,
        audioUuid: response.audioUuid,
        timestamp: new Date(),
        fromCurrentUser: true,
      },
      status: response.status,
    };
  } else if (response.status === 'sent') {
    const text = content.type === 'chat-text' ? content.text : '';

    setInboxSent(recipientPersonUuid, text);

    notify(`message-to-${recipientPersonUuid}`);

    return {
      message: {
        type: 'chat-text',
        from: personUuidToJid(credentials.username),
        to: personUuidToJid(recipientPersonUuid),
        id,
        text,
        timestamp: new Date(),
        fromCurrentUser: true,
      },
      status: response.status
    };
  } else {
    return { message: null, status: response.status };
  }

  // Deal with timeouts. To stop ourselves from sending the same message
  // multiple times, we fetch the conversation history and see if the message
  // we're trying to send is already there. If not, we try to send it again.
  const conversation = await fetchConversation(recipientPersonUuid);

  if (
    conversation === 'timeout' ||
    conversation[conversation.length - 1]?.id !== id
  ) {
    return sendMessage(
      recipientPersonUuid,
      content,
      id,
      {
        numTries: numTries - 1,
        timeoutMs,
      }
    );
  } else {
    return { message: null, status: 'timeout' };
  }
};

const conversationsToInbox = (conversations: Conversation[]): Inbox => {
  const chats = conversations
    .filter((c) => c.location === 'chats');
  const intros = conversations
    .filter((c) => c.location === 'intros');
  const archive = conversations
    .filter((c) => c.location === 'archive');

  const inbox: Inbox = {
    chats: {
      conversations: chats,
      conversationsMap: conversationListToMap(chats),
    },
    intros: {
      conversations: intros,
      conversationsMap: conversationListToMap(intros),
    },
    archive: {
      conversations: archive,
      conversationsMap: conversationListToMap(archive),
    },
    endTimestamp: findEarliestDateInConversations(conversations),
  };

  return inbox;
};

const setConversationArchived = (personUuid: string, isSkipped: boolean) => {
  const inbox = _.cloneDeep(getInbox() ?? emptyInbox());

  if (!inbox) {
    return inbox;
  }

  const conversationToUpdate = (
    inbox.chats .conversationsMap[personUuid] ??
    inbox.intros.conversationsMap[personUuid] ??
    inbox.archive.conversationsMap[personUuid]
  ) as Conversation | undefined;

  if (!conversationToUpdate) {
    return;
  }

  if (!isSkipped) {
    refreshInbox();
    return;
  }

  conversationToUpdate.location = 'archive';

  const inbox_ = conversationsToInbox([
    ...inbox.chats.conversations,
    ...inbox.intros.conversations,
    ...inbox.archive.conversations,
  ]);

  notify<Inbox>('inbox', inbox_);
};

const onReceiveMessage = (
  callback?: (message: Message) => void,
  otherPersonUuid?: string,
  doMarkDisplayed?: boolean,
): (() => void) | undefined => {
  const unpackDoc = (doc: any) => {
    try {
      const {
        message: {
          '@type': type,
          '@from': from,
          '@to': to,
          '@id': id,
          '@audioUuid': audioUuid,
          body: text,
        }
      } = doc;

      const base = {
        from: from as string,
        to: to as string,
        id: id as string,
      };

      if (type === 'chat' && audioUuid) {
        return {
          ...base,
          type: 'chat-audio' as 'chat-audio',
          audioUuid: audioUuid,
        };
      }

      if (type === 'chat' && text){
        return {
          ...base,
          type: 'chat-text' as 'chat-text',
          text: text as string,
        };
      }

      if (type === 'typing') {
        return {
          ...base,
          type: 'typing' as 'typing',
        };
      }
    } catch { }

    return null;
  };

  const _onReceiveMessage = async (doc: any) => {
    const unpacked = unpackDoc(doc);

    if (!unpacked) {
      return;
    }

    const bareFrom = jidToBareJid(unpacked.from)

    if (otherPersonUuid !== undefined && otherPersonUuid !== bareFrom) {
      return;
    }

    if (unpacked.type === 'typing' && callback !== undefined) {
      const message: TypingMessage = unpacked;

      callback(message);
    }

    if (unpacked.type === 'typing') {
      return;
    }


    const message: ChatMessage = unpacked.type === 'chat-text' ? {
      ...unpacked,
      type: 'chat-text',
      timestamp: new Date(),
      fromCurrentUser: jidMatchesSignedInUser(unpacked.from),
    } : {
      ...unpacked,
      type: 'chat-audio',
      timestamp: new Date(),
      fromCurrentUser: jidMatchesSignedInUser(unpacked.from),
    };

    if (unpacked.type === 'chat-text') {
      await setInboxRecieved(bareFrom, unpacked.text);
    } else if (unpacked.type === 'chat-audio') {
      await setInboxRecieved(bareFrom, AUDIO_MESSAGE);
    }

    if (otherPersonUuid === undefined) {
      notify(`message-from-${bareFrom}`);
    }

    if (otherPersonUuid !== undefined && doMarkDisplayed !== false) {
      await markDisplayed(message);
    }

    if (callback !== undefined) {
      callback(message);
    }

  };

  return listen(EV_CHAT_WS_RECEIVE, _onReceiveMessage);
};

const fetchConversation = async (
  withPersonUuid: string,
  beforeId: string = '',
): Promise<ChatMessage[] | 'timeout'> => {
  const queryId = getRandomString(10);

  const data = {
    iq: {
      '@type': 'set',
      '@id': queryId,
      query: {
        '@xmlns': 'urn:xmpp:mam:2',
        '@queryid': queryId,
        x: {
          '@xmlns': 'jabber:x:data',
          '@type': 'submit',
          field: [
            { '@var': 'FORM_TYPE', value: 'urn:xmpp:mam:2' },
            { '@var': 'with', value: personUuidToJid(withPersonUuid) },
          ]
        },
        set: {
          '@xmlns': 'http://jabber.org/protocol/rsm',
          'max': '50',
          'before': beforeId
        }
      }
    }
  };

  const responseDetector = (doc: any): ChatMessage | null => {
    try {
      const {
        message: {
          result: {
            '@queryid': receivedQueryId,
            '@id': mamId,
            forwarded: {
              delay: {
                '@stamp': timestamp,
              },
              message: {
                '@id': id,
                '@from': from,
                '@to': to,
                '@audio_uuid': audioUuid,
                'body': text,
              }
            }
          }
        }
      } = doc;

      assert(receivedQueryId === queryId);

      if (audioUuid) {
        return {
          type: 'chat-audio',
          audioUuid: audioUuid,
          from: from,
          to: to,
          id: id,
          mamId: mamId ? mamId : undefined,
          timestamp: new Date(timestamp),
          fromCurrentUser: jidMatchesSignedInUser(from),
        };
      } else {
        return {
          type: 'chat-text',
          text: text,
          from: from,
          to: to,
          id: id,
          mamId: mamId ? mamId : undefined,
          timestamp: new Date(timestamp),
          fromCurrentUser: jidMatchesSignedInUser(from),
        };
      }
    } catch {
      return null;
    }
  };

  const sentinelDetector = (doc: any) => {
    if (!credentials) {
      return false;
    }

    const expectedDoc = {
      iq: {
        "@xmlns": "jabber:client",
        "@from": `${credentials.username}@duolicious.app`,
        "@to": `${credentials.username}@duolicious.app`,
        "@id": queryId,
        "@type": "result",
        fin: {
          "@xmlns": "urn:xmpp:mam:2"
        }
      }
    }

    return _.isEqual(doc, expectedDoc);
  };

  const response = await send({
    data,
    responseDetector,
    sentinelDetector,
    timeoutMs: fetchConversationTimeout,
  });

  if (response !== 'timeout' && response.length > 0) {
    const lastMessage = response[response.length - 1];
    await markDisplayed(lastMessage);
  }

  return response;
};

const refreshInbox = async (
  endTimestamp?: Date,
  pageSize?: number,
): Promise<void> => {
  const apiDataPromise = japi('post', '/inbox-info', {person_uuids: []});

  const queryId = getRandomString(10);

  const endTimestampFragment = !endTimestamp ? {} : {
    x: {
      '@xmlns': 'jabber:x:data',
      '@type': 'form',
      field: {
        '@type': 'text-single',
        '@var': 'end',
        value: {
          '#text': endTimestamp.toISOString()
        }
      }
    }
  };

  const maxPageSizeFragment = !pageSize ? {} : {
    set: {
      '@xmlns': 'http://jabber.org/protocol/rsm',
      max: {
        '#text': pageSize
      }
    }
  };

  const data = {
    iq: {
      '@type': 'set',
      '@id': queryId,
      inbox: {
        '@xmlns': 'erlang-solutions.com:xmpp:inbox:0',
        '@queryid': queryId,
        ...endTimestampFragment,
        ...maxPageSizeFragment,
      }
    }
  };

  const responseDetector = (doc: any): Conversation | null => {
    try {
      const {
        message: {
          result: {
            '@unread': numUnread,
            '@queryid': receivedQueryId,
            forwarded: {
              delay: {
                '@stamp': timestamp,
              },
              message: {
                '@from': from,
                '@to': to,
                'body': text,
              }
            }
          }
        }
      } = doc;

      assert(receivedQueryId === queryId);

      const fromCurrentUser = jidMatchesSignedInUser(from);
      const bareTo = jidToBareJid(to);
      const bareFrom = jidToBareJid(from);
      const bareJid = fromCurrentUser ? bareTo : bareFrom;
      const personUuid = parseUuidOrNull(bareJid);

      if (!personUuid) {
        return null;
      }

      // Some of these need to be fetched from the REST API instead of the XMPP
      // server
      return {
        personUuid,
        name: '',
        matchPercentage: 0,
        imageUuid: null,
        lastMessage: text,
        lastMessageRead: numUnread === '0',
        lastMessageTimestamp: new Date(timestamp),
        isAvailableUser: true,
        location: 'archive',
        imageBlurhash: '',
        isVerified: false,
      };
    } catch {
      return null;
    }
  };

  const sentinelDetector = (doc: any): boolean => {
    const expectedDoc = {
      iq: {
        '@id': queryId,
        '@type': 'result',
        fin: null
      }
    };

    return _.isEqual(doc, expectedDoc);
  };

  const response = await send({
    data,
    responseDetector,
    sentinelDetector,
    timeoutMs: fetchInboxTimeout,
  });

  if (response === 'timeout') {
    return;
  }

  const conversations: Conversations = {
    conversations: response,
    conversationsMap: conversationListToMap(response),
  };

  const apiData = (await apiDataPromise).json;
  populateConversationList(conversations.conversations, apiData);

  const inbox = conversationsToInbox(conversations.conversations);

  notify<Inbox>('inbox', {...inbox});
};

const registerPushToken = async (token: string | null) => {
  const data = token ?
    { duo_register_push_token: { '@token': token } } :
    { duo_register_push_token: null };

  const responseDetector = (doc: any): true | null => {
    if (_.isEqual(doc, { duo_registration_successful: null })) {
      return true;
    } else {
      return null;
    }
  };

  // Retry once then give up
  const doTry = async () => send({ data, responseDetector });
  if (await doTry() === 'timeout') {
    await doTry();
  }
};

// Update the inbox upon receiving a message
onReceiveMessage();

listen(EV_CHAT_WS_OPEN, authenticate);
listen(EV_CHAT_WS_CLOSE, () => notify('xmpp-is-online', false));

export {
  Conversation,
  Conversations,
  Inbox,
  Message,
  ChatMessage,
  TypingMessage,
  MessageStatus,
  fetchConversation,
  inboxStats,
  login,
  logout,
  markDisplayed,
  onReceiveMessage,
  refreshInbox,
  registerPushToken,
  sendMessage,
  setConversationArchived,
};
