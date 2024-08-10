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

import {
  AppState,
  AppStateStatus,
  Platform,
} from 'react-native';

const _xmpp: {
  current: Client | undefined;
} = {
  current: undefined
};

notify('inbox', null);

const parseIntOrZero = (input: string) => {
  const parsed = parseInt(input, 10);
  return isNaN(parsed) ? 0 : parsed;
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

// TODO: Catch more exceptions. If a network request fails, that shouldn't crash the app.
// TODO: Update match percentages when user answers some questions

type MessageStatus =
  | 'sent'
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
  const personUuids: string[] = conversationList
    .map(c => c.personUuid)
    .filter(isValidUuid);

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
    c.isAvailableUser = !!personInfo?.name;
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

const inboxToPersonUuids = (inbox: Inbox): string[] => {
  const personUuids = new Set<string>();

  inbox.chats .conversations.forEach((c) => personUuids.add(c.personUuid));
  inbox.intros.conversations.forEach((c) => personUuids.add(c.personUuid));

  return [...personUuids];
};

const jidToBareJid = (jid: string): string =>
  jid.split('@')[0];

const personUuidToJid = (personUuid: string): string =>
  `${personUuid}@duolicious.app`;

const setInboxSent = (recipientPersonUuid: string, message: string) => {
  const i = getInbox() ?? emptyInbox();

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

    i.chats.conversations.push(updatedConversation);
    i.chats.conversationsMap[recipientPersonUuid] = updatedConversation;

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
  const inbox = getInbox();

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
    ...chatsConversation,
    ...introsConversation,
    lastMessage: message,
    lastMessageRead: false,
    lastMessageTimestamp: new Date(),
  };

  if (!chatsConversation && !introsConversation) {
    await populateConversation(updatedConversation);
    if (updatedConversation.location === 'chats') {
      inbox.chats.conversations.push(updatedConversation);
      inbox.chats.conversationsMap[fromPersonUuid] = updatedConversation;
    }
    if (updatedConversation.location === 'intros') {
      inbox.intros.conversations.push(updatedConversation);
      inbox.intros.conversationsMap[fromPersonUuid] = updatedConversation;
    }
  } else if (chatsConversation) {
    Object.assign(chatsConversation, updatedConversation);
  } else if (introsConversation) {
    Object.assign(introsConversation, updatedConversation);
  }

  notify(`message-to-${fromPersonUuid}`);

  notify<Inbox>('inbox', {...inbox});
};

const setInboxDisplayed = (fromPersonUuid: string) => {
  const inbox = getInbox();

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

const select1 = (query: string, stanza: Element): xpath.SelectedValue => {
  const stanzaString = stanza.toString();
  const doc = new DOMParser().parseFromString(stanzaString, 'text/xml');
  return xpath.select1(query, doc);
};

const login = async (username: string, password: string) => {
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

    _xmpp.current = client(options);

    _xmpp.current.on("error", (err) => {
      console.error(err);
      if (err.message === "conflict - Replaced by new connection") {
        notify('stream-error');
      }
    });

    _xmpp.current.on("offline",       () => notify('xmpp-is-online', false));
    _xmpp.current.on("connecting",    () => notify('xmpp-is-online', false));
    _xmpp.current.on("opening",       () => notify('xmpp-is-online', false));
    _xmpp.current.on("closing",       () => notify('xmpp-is-online', false));
    _xmpp.current.on("close",         () => notify('xmpp-is-online', false));
    _xmpp.current.on("disconnecting", () => notify('xmpp-is-online', false));
    _xmpp.current.on("disconnect",    () => notify('xmpp-is-online', false));

    _xmpp.current.on("online", async () => {
      if (_xmpp.current) {
        notify('xmpp-is-online', true);

        refreshInbox();

        await registerForPushNotificationsAsync();
      }
    });

    _xmpp.current.on("input", async (input: Element) => {
      notify('xmpp-input', input);
    });

    _xmpp.current.on("stanza", async (stanza: Element) => {
      notify('xmpp-stanza', stanza)
    });

    await _xmpp.current.start();
  } catch (e) {
    _xmpp.current = undefined;
    notify('xmpp-is-online', false);

    console.error(e);
  }
};

const markDisplayed = async (message: Message) => {
  if (!_xmpp.current) return;
  if (message.fromCurrentUser) return;

  const stanza = parse(`
    <message to='${message.from}' from='${message.to}'>
      <displayed xmlns='urn:xmpp:chat-markers:0' id='${message.id}'/>
    </message>
  `);

  await _xmpp.current.send(stanza);
  setInboxDisplayed(jidToBareJid(message.from));
};

const _sendMessage = (
  recipientPersonUuid: string,
  message: string,
  callback: (messageStatus: Omit<MessageStatus, 'unsent: error'>) => void,
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

    const blockedNode = xpath.select1(
      `/*[name()='duo_message_blocked'][@id='${id}']`,
      doc
    );

    const messageDeliveredNode = xpath.select1(
      `/*[name()='duo_message_delivered'][@id='${id}']`,
      doc
    );

    if (blockedNode) {
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

  _xmpp.current.send(messageXml);
};

const sendMessage = async (
  recipientPersonUuid: string,
  message: string,
): Promise<MessageStatus> => {
  const __sendMessage = new Promise(
    (resolve: (messageStatus: MessageStatus) => void) =>
      _sendMessage(recipientPersonUuid, message, resolve)
  );

  return await withTimeout(30000, __sendMessage);
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

const setConversationArchived = (personUuid: string, isArchived: boolean) => {
  const inbox = getInbox();

  if (!inbox) {
    return inbox;
  }

  const conversationToUpdate = (
    inbox.chats .conversationsMap[personUuid] ??
    inbox.intros.conversationsMap[personUuid]) as Conversation | undefined;

  if (conversationToUpdate) {
    conversationToUpdate.location = 'archive';
  }

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

    if (
      otherPersonUuid !== undefined &&
      otherPersonUuid !== jidToBareJid(from.toString())
    ) return;

    const message: Message = {
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
      timestamp: stamp.toString() ? new Date(stamp.toString()) : new Date(),
      fromCurrentUser: jidToBareJid(from.toString()) == signedInUser?.personUuid,
    };

    await setInboxRecieved(
      jidToBareJid(from.toString()),
      bodyText.toString(),
    );
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

  await _xmpp.current.send(queryStanza).catch(console.warn);
};

const fetchConversation = async (
  withPersonUuid: string,
  beforeId: string = '',
): Promise<Message[] | undefined | 'timeout'> => {
  const __fetchConversation = new Promise(
    (resolve: (messages: Message[] | undefined | 'timeout') => void) =>
      _fetchConversation(withPersonUuid, resolve, beforeId)
    );

  return await withTimeout(30000, __fetchConversation);
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

  await _xmpp.current.send(queryStanza).catch(console.warn);
};

const fetchInboxPage = async (
  endTimestamp: Date | null = null,
  pageSize: number | null = null,
): Promise<Inbox | undefined> => {
  return new Promise((resolve) =>
    _fetchInboxPage(resolve, endTimestamp, pageSize));
};

const refreshInbox = async (): Promise<void> => {
  let inbox = emptyInbox();

  while (true) {
    const page = await fetchInboxPage(inbox.endTimestamp);

    const isLastPage = (
      !page ||
      !page.archive.conversations.length &&
      !page.chats.conversations.length &&
      !page.intros.conversations.length
    );

    if (isLastPage) {
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
  if (_xmpp.current) {
    notify('xmpp-is-online', false);
    await _xmpp.current.stop().catch(console.error);
    notify('inbox', null);
    _xmpp.current = undefined;
  }
};

const registerPushToken = async (token: string) => {
  if (!_xmpp.current) return;

  const stanza = parse(`<duo_register_push_token token='${token}' />`);

  await _xmpp.current.send(stanza);
};

const onChangeAppState = (state: AppStateStatus) => {
  if (Platform.OS !== 'web' && state === 'active') {
    refreshInbox();
  }
};

// Update the inbox when resuming from an inactive state
AppState.addEventListener('change', onChangeAppState);

// Update the inbox upon receiving a message
onReceiveMessage();

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
