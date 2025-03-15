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
  | 'sent'
  | 'offensive'
  | 'rate-limited-1day'
  | 'rate-limited-1day-unverified-basics'
  | 'rate-limited-1day-unverified-photos'
  | 'spam'
  | 'blocked'
  | 'not unique'
  | 'too long'
  | 'timeout'

type Message = {
  text: string
  from: string
  to: string
  fromCurrentUser: boolean
  id: string
  mamId?: string | undefined
  timestamp: Date
};

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
    lastMessage: message,
    lastMessageRead: false,
    lastMessageTimestamp: new Date(),
  };

  if (!chatsConversation && !introsConversation) {
    await populateConversation(updatedConversation);

    if (updatedConversation.location === 'chats') {
      inbox.chats.conversationsMap[fromPersonUuid] = updatedConversation;
      inbox.chats.conversations = Object.values(inbox.chats.conversationsMap);
    }
    if (updatedConversation.location === 'intros') {
      inbox.intros.conversationsMap[fromPersonUuid] = updatedConversation;
      inbox.intros.conversations = Object.values(inbox.intros.conversationsMap);
    }
  } else if (chatsConversation) {
    Object.assign(chatsConversation, updatedConversation);
  } else if (introsConversation) {
    Object.assign(introsConversation, updatedConversation);
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

const markDisplayed = async (message: Message) => {
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
  messageBody: string,
  numTries: number = 3,
): Promise<
  | { message: Message, status: 'sent' }
  | { message: null, status: Exclude<MessageStatus, 'sent'>}
> => {
  if (numTries <= 0) {
    return { message: null, status: 'timeout' };
  }

  if (!credentials) {
    return { message: null, status: 'blocked' };
  }

  const id = getRandomString(40);

  const message: Message = {
    text: messageBody,
    from: personUuidToJid(credentials.username),
    to: personUuidToJid(recipientPersonUuid),
    id,
    timestamp: new Date(),
    fromCurrentUser: true,
  };

  const fromJid = personUuidToJid(credentials.username);

  const toJid = personUuidToJid(recipientPersonUuid);

  const data = {
    message: {
      '@xmlns': 'jabber:client',
      '@type': "chat",
      '@from': fromJid,
      '@to': toJid,
      '@id': id,
      body: messageBody,
    },
  };

  const responseDetector = (doc: any): MessageStatus | null => {
    // Check duo_message_too_long
    try {
      const { duo_message_too_long: v } = doc;
      assert(v !== undefined);
      return 'too long';
    } catch { }

    // Check duo_message_not_unique
    try {
      const {
        duo_message_not_unique: {
          '@id': receivedQueryId,
        },
      } = doc;
      assert(receivedQueryId === id);
      return 'not unique';
    } catch { }

    // Check duo_message_blocked for rate-limited unverified basics
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
          '@subreason': subreason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'rate-limited-1day');
      assert(subreason === 'unverified-basics');
      return 'rate-limited-1day-unverified-basics';
    } catch { }

    // Check duo_message_blocked for rate-limited unverified photos
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
          '@subreason': subreason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'rate-limited-1day');
      assert(subreason === 'unverified-photos');
      return 'rate-limited-1day-unverified-photos';
    } catch { }

    // Check duo_message_blocked for generic rate-limited (no specific subreason)
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'rate-limited-1day');
      return 'rate-limited-1day';
    } catch { }

    // Check duo_message_blocked for spam
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'spam');
      return 'spam';
    } catch { }

    // Check duo_message_blocked for offensive
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
          '@reason': reason,
        },
      } = doc;
      assert(receivedQueryId === id);
      assert(reason === 'offensive');
      return 'offensive';
    } catch { }

    // Fallback for any duo_message_blocked case
    try {
      const {
        duo_message_blocked: {
          '@id': receivedQueryId,
        },
      } = doc;
      assert(receivedQueryId === id);
      return 'blocked';
    } catch { }

    // Check duo_message_delivered
    try {
      const {
        duo_message_delivered: {
          '@id': receivedQueryId,
        },
      } = doc;
      assert(receivedQueryId === id);
      return 'sent';
    } catch { }

    return null;
  };

  const status = await send<MessageStatus>({
    data,
    responseDetector,
    timeoutMs: messageTimeout,
  });

  if (status === 'sent') {
    setInboxSent(recipientPersonUuid, messageBody);
    notify(`message-to-${recipientPersonUuid}`);
    return { message, status };
  }

  if (status !== 'timeout') {
    return { message: null, status };
  }

  // Deal with timeouts. To stop ourselves from sending the same message
  // multiple times, we fetch the conversation history and see if the message
  // we're trying to send is already there. If not, we try to send it again.
  const conversation = await fetchConversation(recipientPersonUuid);

  if (
    conversation === 'timeout' ||
    conversation[conversation.length - 1]?.id !== id
  ) {
    return sendMessage(recipientPersonUuid, messageBody, numTries - 1);
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
  const _onReceiveMessage = async (doc: any) => {
    try {
      const {
        message: {
          '@type': receivedType,
          '@from': from,
          '@to': to,
          '@id': id,
          body: bodyText,
        }
      } = doc;

      assert(receivedType === 'chat');

      const bareFrom = jidToBareJid(from)

      if (
        otherPersonUuid !== undefined &&
        otherPersonUuid !== bareFrom
      ) {
        return;
      }

      const message: Message = {
        text: bodyText,
        from: from,
        to: to,
        id: id,
        timestamp: new Date(),
        fromCurrentUser: jidMatchesSignedInUser(from)
      };

      await setInboxRecieved(bareFrom, bodyText);

      if (otherPersonUuid === undefined) {
        notify(`message-from-${bareFrom}`);
      }

      if (otherPersonUuid !== undefined && doMarkDisplayed !== false) {
        await markDisplayed(message);
      }

      if (callback !== undefined) {
        callback(message);
      }

    } catch { }

  };

  return listen(EV_CHAT_WS_RECEIVE, _onReceiveMessage);
};

const fetchConversation = async (
  withPersonUuid: string,
  beforeId: string = '',
): Promise<Message[] | 'timeout'> => {
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

  const responseDetector = (doc: any): Message | null => {
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
                'body': bodyText,
              }
            }
          }
        }
      } = doc;

      assert(receivedQueryId === queryId);

      return {
        text: bodyText,
        from: from,
        to: to,
        id: id,
        mamId: mamId ? mamId : undefined,
        timestamp: new Date(timestamp),
        fromCurrentUser: jidMatchesSignedInUser(from),
      };
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

  const response = await send<Message>({
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
                'body': bodyText,
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
        lastMessage: bodyText,
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

  const response = await send<Conversation>({
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
