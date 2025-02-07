import {
  CHAT_URL,
} from '../env/env';
import { Client, client, xml } from '@xmpp/client';
import { Element } from '@xmpp/xml';
import { parse } from 'ltx';

import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

import { signedInUser } from '../App';
import { getRandomString } from '../random/string';

import { deviceId } from '../kv-storage/device-id';
import { japi } from '../api/api';
import { deleteFromArray, withTimeout, delay } from '../util/util';

import { listen, notify, lastEvent } from '../events/events';

import { registerForPushNotificationsAsync } from '../notifications/notifications';

import { AppState, AppStateStatus } from 'react-native';

import * as _ from 'lodash';

const messageTimeout = 10000;
const fetchConversationTimeout = 15000;
const fetchInboxTimeout = 30000;
const pingTimeout = 5000;

const _xmpp: {
  current: {
    client: Client
    username: string
    password: string
  } | null,
  reconnecting: boolean
} = {
  current: null,
  reconnecting: false,
};

notify('inbox', null);

const parseIntOrZero = (input: string) => {
  if (/^\d+$/.test(input)) {
    const parsed = parseInt(input, 10);
    return isNaN(parsed) ? 0 : parsed;
  } else {
    return 0;
  }
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

const parseUuidOrEmtpy = (uuid: string) => {
  return isValidUuid(uuid) ? uuid : '';
}

const safeSend = async (element: Element) => {
  if (!_xmpp.current) {
    return;
  }

  if (_xmpp.current.client.status !== 'online') {
    return;
  }

  await _xmpp.current.client.send(element).catch(console.error);
};

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

type Pong = {
  preferredInterval: number
  preferredTimeout: number
};

type Conversation = {
  personId: number
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

const mergeInbox = (i1: Inbox, i2: Inbox) => {
  const merged: Inbox = {
    chats: {
      conversations: [
        ...i1.chats.conversations,
        ...i2.chats.conversations,
      ],
      conversationsMap: {
        ...i1.chats.conversationsMap,
        ...i2.chats.conversationsMap,
      }
    },
    intros: {
      conversations: [
        ...i1.intros.conversations,
        ...i2.intros.conversations,
      ],
      conversationsMap: {
        ...i1.intros.conversationsMap,
        ...i2.intros.conversationsMap,
      }
    },
    archive: {
      conversations: [
        ...i1.archive.conversations,
        ...i2.archive.conversations,
      ],
      conversationsMap: {
        ...i1.archive.conversationsMap,
        ...i2.archive.conversationsMap,
      }
    },
    endTimestamp: null
  };

  const conversations = [
    ...merged.chats.conversations,
    ...merged.intros.conversations,
    ...merged.archive.conversations,
  ];

  merged.endTimestamp = findEarliestDateInConversations(conversations);

  return merged;
};

const conversationListToMap = (
  conversationList: Conversation[]
): ConversationsMap => {
  return conversationList.reduce<ConversationsMap>(
    (obj, item) => { obj[item.personUuid] = item; return obj; },
    {}
  );
};

const populateConversationList = async (
  conversationList: Conversation[],
  apiData: any,
): Promise<void> => {
  const personIdToInfo = apiData.reduce((obj, item) => {
    obj[item.person_id] = item;
    return obj;
  }, {});

  const personUuidToInfo = apiData.reduce((obj, item) => {
    obj[item.person_uuid] = item;
    return obj;
  }, {});

  conversationList.forEach((c: Conversation) => {
    const personUuid = c.personUuid;
    const personId = c.personId;

    const personInfo = (
      personUuidToInfo[personUuid] ?? personIdToInfo[personId]
    );

    // Update conversation information
    c.name = personInfo?.name ?? 'Unavailable Person';
    c.matchPercentage = personInfo?.match_percentage ?? 0;
    c.imageUuid = personInfo?.image_uuid ?? null;
    c.imageBlurhash = personInfo?.image_blurhash ?? null;
    c.isAvailableUser = !!personInfo?.name;
    c.isVerified = !!personInfo?.verified;
    c.location = personInfo?.conversation_location ?? 'archive';
    c.personId = personInfo?.person_id ?? c.personId ?? 0;
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
    personId: 0,
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
    personId: 0,
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
  if (_xmpp.current) {
    return; // Already logged in
  }

  try {
    const options = {
      service: CHAT_URL,
      domain: "duolicious.app",
      username: username,
      password: password,
      resource: await deviceId(),
    };

    _xmpp.current = {
      client: client(options),
      username,
      password,
    };

    // The default is 1 second. We set it to 3 seconds here, but it's a shame
    // xmpp.js doesn't support exponential backoff
    _xmpp.current.client.reconnect.delay = 3 * 1000;

    _xmpp.current.client.on("error", async (err) => {
      console.error(err);
      if (err.message === "conflict - Replaced by new connection") {
        notify('stream-error');
        await logout();
      }
    });

    _xmpp.current.client.on("offline",       () => notify('xmpp-is-online', false));
    _xmpp.current.client.on("connecting",    () => notify('xmpp-is-online', false));
    _xmpp.current.client.on("opening",       () => notify('xmpp-is-online', false));
    _xmpp.current.client.on("closing",       () => notify('xmpp-is-online', false));
    _xmpp.current.client.on("close",         () => notify('xmpp-is-online', false));
    _xmpp.current.client.on("disconnecting", () => notify('xmpp-is-online', false));
    _xmpp.current.client.on("disconnect",    () => notify('xmpp-is-online', false));

    _xmpp.current.client.on("online", async () => {
      if (!_xmpp.current) {
        return;
      }

      _xmpp.reconnecting = false;

      notify('xmpp-is-online', true);

      refreshInbox();

      await registerForPushNotificationsAsync();
    });

    _xmpp.current.client.on("input", async (input: Element) => {
      notify('xmpp-input', input);
    });

    _xmpp.current.client.on("stanza", async (stanza: Element) => {
      notify('xmpp-stanza', stanza)
    });

    await _xmpp.current.client.start();
  } catch (e) {
    console.error(e);

    await logout();
  }
};

const markDisplayed = async (message: Message) => {
  if (!_xmpp.current) return;
  if (message.fromCurrentUser) return;

  if (!isValidUuid(jidToBareJid(message.from))) return;
  if (!isValidUuid(jidToBareJid(message.to))) return;

  const stanza = parse(`
    <message to='${message.from}' from='${message.to}'>
      <displayed xmlns='urn:xmpp:chat-markers:0' id='${message.id}'/>
    </message>
  `);

  await safeSend(stanza).catch(console.warn);
  setInboxDisplayed(jidToBareJid(message.from));
};

const _sendMessage = (
  recipientPersonUuid: string,
  message: string,
  callback: (messageStatus: MessageStatus) => void,
): void => {
  const id = getRandomString(40);
  const fromJid = (
      signedInUser?.personId !== undefined ?
      personUuidToJid(signedInUser.personUuid) :
      undefined
  );
  const toJid = personUuidToJid(recipientPersonUuid);

  if (!_xmpp.current) return;
  if (!fromJid) return;

  const messageXml = xml(
    "message",
    {
      type: "chat",
      from: fromJid,
      to: toJid,
      id: id,
    },
    xml("body", {}, message),
    xml("request", { xmlns: 'urn:xmpp:receipts' }),
  );

  const messageStatusListener = (input: Element) => {
    const doc = (() => {
      try {
        return new DOMParser().parseFromString(input.toString(), 'text/xml');
      } catch {}
    })();

    if (!doc) return;

    const tooLongNode = xpath.select1(
      `/*[name()='duo_message_too_long'][@id='${id}']`,
      doc
    );

    const notUniqueNode = xpath.select1(
      `/*[name()='duo_message_not_unique'][@id='${id}']`,
      doc
    );

    const rateLimitedUnverifiedBasicsNode = xpath.select1(
      "/*[name()='duo_message_blocked']" +
      "[@reason='rate-limited-1day']" +
      "[@subreason='unverified-basics']" +
      `[@id='${id}']`,
      doc
    );

    const rateLimitedUnverifiedPhotosNode = xpath.select1(
      "/*[name()='duo_message_blocked']" +
      "[@reason='rate-limited-1day']" +
      "[@subreason='unverified-photos']" +
      `[@id='${id}']`,
      doc
    );

    const rateLimitedNode = xpath.select1(
      "/*[name()='duo_message_blocked']" +
      "[@reason='rate-limited-1day']" +
      `[@id='${id}']`,
      doc
    );

    const offensiveNode = xpath.select1(
      `/*[name()='duo_message_blocked'][@reason='offensive'][@id='${id}']`,
      doc
    );

    const spamNode = xpath.select1(
      `/*[name()='duo_message_blocked'][@reason='spam'][@id='${id}']`,
      doc
    );

    const blockedNode = xpath.select1(
      `/*[name()='duo_message_blocked'][@id='${id}']`,
      doc
    );

    const messageDeliveredNode = xpath.select1(
      `/*[name()='duo_message_delivered'][@id='${id}']`,
      doc
    );

    if (rateLimitedUnverifiedBasicsNode) {
      callback('rate-limited-1day-unverified-basics');
    } else if (rateLimitedUnverifiedPhotosNode) {
      callback('rate-limited-1day-unverified-photos');
    } else if (rateLimitedNode) {
      callback('rate-limited-1day');
    } else if (spamNode) {
      callback('spam');
    } else if (offensiveNode) {
      callback('offensive');
    } else if (blockedNode) {
      callback('blocked');
    } else if (notUniqueNode) {
      callback('not unique');
    } else if (tooLongNode) {
      callback('too long');
    } else if (messageDeliveredNode) {
      setInboxSent(recipientPersonUuid, message);
      notify(`message-to-${recipientPersonUuid}`);
      callback('sent');
    }

    removeListener();
  };

  const removeListener = listen<Element>('xmpp-input', messageStatusListener);

  setTimeout(removeListener, messageTimeout);

  safeSend(messageXml).catch(console.warn);
};

const sendMessage = async (
  recipientPersonUuid: string,
  message: string,
): Promise<MessageStatus> => {
  const __sendMessage = new Promise(
    (resolve: (messageStatus: MessageStatus) => void) =>
      _sendMessage(recipientPersonUuid, message, resolve)
  );

  return await withReconnectOnTimeout(messageTimeout, __sendMessage);
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
  const _onReceiveMessage = async (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='message'][@type='chat']/*[name()='body']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const from = xpath.select1(`string(./parent::*/@from)`, node);
    const to = xpath.select1(`string(./parent::*/@to)`, node);
    const id = xpath.select1(`string(./parent::*/@id)`, node);
    const stamp = xpath.select1(
      `string(./preceding-sibling::*/@stamp | ./following-sibling::*/@stamp)`,
      node
    );
    const bodyText = xpath.select1(`string(./text())`, node);

    if (from === null) return;
    if (to === null) return;
    if (id === null) return;
    if (stamp === null) return;
    if (bodyText === null) return;

    const bareFrom = jidToBareJid(from.toString())

    if (
      otherPersonUuid !== undefined &&
      otherPersonUuid !== bareFrom
    ) return;

    const message: Message = {
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
      timestamp: stamp.toString() ? new Date(stamp.toString()) : new Date(),
      fromCurrentUser: bareFrom === signedInUser?.personUuid,
    };

    await setInboxRecieved(
      bareFrom,
      bodyText.toString(),
    );

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

  return listen<Element>('xmpp-stanza', _onReceiveMessage);
};

const _fetchConversation = async (
  withPersonUuid: string,
  callback: (messages: Message[] | 'timeout') => void,
  beforeId: string = '',
) => {
  if (!_xmpp.current)
    return callback('timeout');

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <query xmlns='urn:xmpp:mam:2' queryid='${queryId}'>
        <x xmlns='jabber:x:data' type='submit'>
          <field var='FORM_TYPE'>
            <value>urn:xmpp:mam:2</value>
          </field>
          <field var='with'>
            <value>${personUuidToJid(withPersonUuid)}</value>
          </field>
        </x>
        <set xmlns='http://jabber.org/protocol/rsm'>
          <max>50</max>
          <before>${beforeId}</before>
        </set>
      </query>
    </iq>
  `);

  const collected: Message[] = [];

  const maybeCollect = (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='message']` +
      `/*[name()='result'][@queryid='${queryId}']` +
      `/*[name()='forwarded']` +
      `/*[name()='message'][@type='chat']` +
      `/*[name()='body']` +
      `/parent::*[not(.//*[name()='stanza-id'])]`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const from = xpath.select1(`string(./@from)`, node);
    const to = xpath.select1(`string(./@to)`, node);
    const id = xpath.select1(`string(./@id)`, node);
    const mamId = xpath.select1(
      `string(.//ancestor::*[name()='result']/@id)`,
      node
    );
    const stamp = xpath.select1(
      `string(./preceding-sibling::*/@stamp | ./following-sibling::*/@stamp)`,
      node
    );
    const bodyText = xpath.select1(`string(./*[name()='body']/text())`, node);

    if (from === null) return;
    if (to === null) return;
    if (id === null) return;
    if (mamId === null) return;
    if (stamp === null) return;
    if (bodyText === null) return;

    const fromCurrentUser = from.toString().startsWith(
        `${signedInUser?.personUuid}@`);

    collected.push({
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
      mamId: mamId ? mamId.toString() : undefined,
      timestamp: new Date(stamp.toString()),
      fromCurrentUser: fromCurrentUser,
    });
  };

  const maybeFin = async (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='iq'][@type='result'][@id='${queryId}']` +
      `/*[name()='fin']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    callback(collected);

    const lastMessage = collected[collected.length - 1];
    if (lastMessage) {
      await markDisplayed(lastMessage);
    }

    removeListener1();
    removeListener2();
  };

  const removeListener1 = listen<Element>('xmpp-stanza', maybeCollect);
  const removeListener2 = listen<Element>('xmpp-stanza', maybeFin);

  setTimeout(removeListener1, fetchConversationTimeout);
  setTimeout(removeListener2, fetchConversationTimeout);

  await safeSend(queryStanza).catch(console.warn);
};

const fetchConversation = async (
  withPersonUuid: string,
  beforeId: string = '',
): Promise<Message[] | undefined | 'timeout'> => {
  const __fetchConversation = new Promise(
    (resolve: (messages: Message[] | undefined | 'timeout') => void) =>
      _fetchConversation(withPersonUuid, resolve, beforeId)
    );

  return await withReconnectOnTimeout(fetchConversationTimeout, __fetchConversation);
};

const _fetchInboxPage = async (
  callback: (conversations: Inbox | undefined) => void,
  endTimestamp: Date | null,
  pageSize: number | null,
) => {
  if (!_xmpp.current) {
    return callback(undefined);
  }

  const apiDataPromise = japi('post', '/inbox-info', {person_uuids: []});

  const queryId = getRandomString(10);

  const endTimestampFragment = !endTimestamp ? '' : `
        <x xmlns='jabber:x:data' type='form'>
          <field type='text-single' var='end'>
            <value>${endTimestamp.toISOString()}</value>
          </field>
        </x>`.trim();

  const maxPageSizeFragment = !pageSize ? '' : `
        <set xmlns='http://jabber.org/protocol/rsm'>
          <max>${pageSize}</max>
        </set>
  `.trim();

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='${queryId}'>
        ${endTimestampFragment}

        ${maxPageSizeFragment}
      </inbox>
    </iq>
  `);

  const conversationList: Conversation[] = [];

  const maybeCollect = (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='message']` +
      `/*[name()='result'][@queryid='${queryId}']` +
      `/*[name()='forwarded']` +
      `/*[name()='message'][@type='chat']` +
      `/*[name()='body']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const from = xpath.select1(`string(./parent::*/@from)`, node);
    const to = xpath.select1(`string(./parent::*/@to)`, node);
    const bodyText = xpath.select1(`string(./text())`, node);
    const numUnread = xpath.select1(`string(.//ancestor::*/@unread)`, node);
    const timestamp = xpath.select1(`string(//*/@stamp)`, node);

    if (from === null) return;
    if (to === null) return;
    if (bodyText === null) return;
    if (numUnread === null) return;
    if (timestamp === null) return;

    const bareFrom = jidToBareJid(from.toString());
    const bareTo = jidToBareJid(to.toString());

    const fromCurrentUserByUuid = bareFrom === signedInUser?.personUuid;
    const fromCurrentUserById = bareFrom === String(signedInUser?.personId);

    const fromCurrentUser = fromCurrentUserByUuid || fromCurrentUserById;

    const bareJid = fromCurrentUser ? bareTo : bareFrom;

    // Some of these need to be fetched from the REST API instead of the XMPP
    // server
    const personUuid = parseUuidOrEmtpy(bareJid)
    const personId = parseIntOrZero(bareJid)
    const name = '';
    const matchPercentage = 0;
    const imageUuid = null;
    const lastMessage = bodyText.toString();
    const lastMessageRead = numUnread.toString() === '0';
    const lastMessageTimestamp = new Date(timestamp.toString());
    const isAvailableUser = true;
    const location = 'archive';
    const imageBlurhash = '';
    const isVerified = false;

    const conversation: Conversation = {
      personId,
      personUuid,
      name,
      matchPercentage,
      imageUuid,
      lastMessage,
      lastMessageRead,
      lastMessageTimestamp,
      isAvailableUser,
      location,
      imageBlurhash,
      isVerified,
    };

    conversationList.push(conversation);
  };

  const maybeFin = async (stanza: Element) => {
    const doc = new DOMParser().parseFromString(stanza.toString(), 'text/xml');

    const node = xpath.select1(
      `/*[name()='iq'][@type='result'][@id='${queryId}']` +
      `/*[name()='fin']`,
      doc,
    );

    if (!xpath.isNodeLike(node)) return;

    const conversations: Conversations = {
      conversations: conversationList,
      conversationsMap: conversationListToMap(conversationList),
    };

    const apiData = (await apiDataPromise).json;
    await populateConversationList(conversations.conversations, apiData);

    const inbox = conversationsToInbox(conversations.conversations);

    callback(inbox);

    removeListener1();
    removeListener2();
  };

  const removeListener1 = listen<Element>('xmpp-stanza', maybeCollect);
  const removeListener2 = listen<Element>('xmpp-stanza', maybeFin);

  setTimeout(removeListener1, fetchInboxTimeout);
  setTimeout(removeListener2, fetchInboxTimeout);

  await safeSend(queryStanza).catch(console.warn);
};

const fetchInboxPage = async (
  endTimestamp: Date | null = null,
  pageSize: number | null = null,
): Promise<Inbox | undefined | 'timeout'> => {
  const __fetchInboxPage = new Promise(
    (resolve: (inbox: Inbox | undefined) => void) =>
      _fetchInboxPage(resolve, endTimestamp, pageSize)
  );

  return await withReconnectOnTimeout(fetchInboxTimeout, __fetchInboxPage);
};

const refreshInbox = async (): Promise<void> => {
  let inbox = emptyInbox();

  while (true) {
    const page = await fetchInboxPage(inbox.endTimestamp);

    if (page === 'timeout') {
      continue;
    }

    const isEmptyPage = (
      !page ||
      !page.archive.conversations.length &&
      !page.chats.conversations.length &&
      !page.intros.conversations.length
    );

    if (isEmptyPage) {
      notify<Inbox>('inbox', inbox);
      break;
    } else {
      inbox = mergeInbox(inbox, page);
      notify<Inbox>('inbox', inbox);
    }

    // This code was originally intended to speed up fetching the inbox in the
    // hope this would be faster, though it's actually slower, so we can stop at
    // the first (very big) page.
    break;
  }
};

const logout = async () => {
  if (!_xmpp.current) {
    return;
  }

  await registerPushToken(null);

  _xmpp.current.client.reconnect.stop();
  await _xmpp.current.client.stop().catch(console.warn);

  notify('xmpp-is-online', false);
  notify('inbox', null);

  _xmpp.current =  null;
};

const registerPushToken = async (token: string | null) => {
  if (!_xmpp.current) return;

  const xmlStr = token ?
    `<duo_register_push_token token='${token}' />` :
    `<duo_register_push_token />`;

  const stanza = parse(xmlStr);

  await safeSend(stanza).catch(console.warn);
};

const _pingServer = (resolve: (result: Pong | null | 'timeout') => void) => {
  if (!_xmpp.current) {
    resolve(null);
    return;
  }

  if (_xmpp.current.client.status !== 'online') {
    resolve(null);
    return;
  }

  if (_xmpp.reconnecting) {
    resolve(null);
    return;
  }

  const listenerRemovers: (() => void)[] = [];

  const removeListeners = () => listenerRemovers.forEach(lr => lr());

  const stanza = parse('<duo_ping />');

  const resolveTimeout = () => {
    resolve('timeout');
    removeListeners();
  };

  const timeout = setTimeout(resolveTimeout, pingTimeout);

  const maybeClearPingTimeout = (input: string) => {
    let stanza: Element | null = null;

    try {
      stanza = parse(input);
    } catch (_) {
      return;
    }

    if (stanza.name !== 'duo_pong') {
      return;
    }

    const duo_pong: Pong = {
      preferredInterval: parseInt(stanza.getAttr('preferred_interval')),
      preferredTimeout: parseInt(stanza.getAttr('preferred_timeout')),
    };

    clearTimeout(timeout);
    resolve(duo_pong);
    removeListeners();
  };

  listenerRemovers.push(listen<string>('xmpp-input', maybeClearPingTimeout));

  safeSend(stanza).catch(console.warn);
};

const pingServer = async (timeout?: number): Promise<Pong | null | 'timeout'> => {
  const __pingServer = new Promise(
    (resolve: (result: Pong | null | 'timeout') => void) =>
      _pingServer(resolve)
  );

  return await withReconnectOnTimeout(timeout ?? pingTimeout, __pingServer);
};


const pingServerForever = async () => {
  let pong: Pong = {
    preferredInterval: 10000,
    preferredTimeout: pingTimeout,
  };

  while (true) {
    const maybePong = await pingServer(pong.preferredTimeout);

    if (maybePong !== 'timeout' && maybePong !== null) {
      pong = maybePong;
    }

    await delay(pong.preferredInterval);
  };
};

const recreateChatClient = async () => {
  if (!_xmpp.current) {
    return; // No current session to recreate
  };

  if (_xmpp.reconnecting) {
    // If we're already attempting to reconnect, we don't want to interrupt that
    // attempt, otherwise we risk creating two streams at once and triggering
    // the exception "conflict - Replaced by new connection"
    return;
  }

  _xmpp.reconnecting = true;

  const { username, password } = _xmpp.current;

  await logout();
  await login(username, password);
};

const withReconnectOnTimeout = async <T,>(ms: number, promise: Promise<T>): Promise<T | 'timeout'> => {
  // If we received other traffic during the time this promise timed-out, we're
  // still connected, we we'd rather not call `recreateChatClient`.
  var recievedAnyInput = false;

  const removeInputListener = listen<string>(
    'xmpp-input',
    () => recievedAnyInput = true,
  );

  const result = await withTimeout(ms, promise);

  removeInputListener();

  if (result === 'timeout' && !recievedAnyInput) {
    recreateChatClient();
  }

  return result;
};

const onChangeAppState = (state: AppStateStatus) => {
  if (state === 'active') {
    pingServer();
  }
};

// Update the inbox when resuming from an inactive state
AppState.addEventListener('change', onChangeAppState);

// Update the inbox upon receiving a message
onReceiveMessage();

// Triggers reconnection if the server goes away. This should be handled by
// xmpp.js, though I think we're affected by this bug:
// https://github.com/xmppjs/xmpp.js/issues/902
pingServerForever();

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
