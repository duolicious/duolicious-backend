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

import { notify } from '../events/events';

import { registerForPushNotificationsAsync } from '../notifications/notifications';

const parseIntOrZero = (input: string) => {
    const parsed = parseInt(input, 10);
    return isNaN(parsed) ? 0 : parsed;
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
};

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
});

let _xmpp: Client | undefined;

let _isOnline: Promise<boolean> = new Promise(() => false);

let _inbox: Inbox | null = null;
const _inboxObservers: Set<(inbox: Inbox | null) => void> = new Set();

const observeInbox = (
  callback: (inbox: Inbox | null) => void
): (() => void) | undefined => {
  if (_inboxObservers.has(callback))
    return;

  _inboxObservers.add(callback);

  callback(_inbox);

  return () => _inboxObservers.delete(callback);
};

const setInbox = async (
  setter: (inbox: Inbox | null) => Promise<Inbox | null> | Inbox | null
): Promise<void> => {
  _inbox = await setter(_inbox);
  _inboxObservers.forEach((observer) => observer(_inbox));
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
  conversationList: Conversation[]
): Promise<void> => {
  const personUuids: string[] = conversationList.map(c => c.personUuid);

  // TODO: Better error handling
  const response = (
    await japi('post', '/inbox-info', {person_uuids: []})
  ).json;

  const personIdToInfo = response.reduce((obj, item) => {
    obj[item.person_id] = item;
    return obj;
  }, {});

  const personUuidToInfo = response.reduce((obj, item) => {
    obj[item.person_uuid] = item;
    return obj;
  }, {});

  conversationList.forEach((c: Conversation) => {
    const personUuid = c.personUuid;
    const personId = c.personId;

    const personInfo = (
      personIdToInfo[personId] ?? personUuidToInfo[personUuid]);

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
  await populateConversationList([conversation]);
};

const inboxToPersonUuids = (inbox: Inbox): string[] => {
  const personUuids = new Set<string>();

  inbox.chats .conversations.forEach((c) => personUuids.add(c.personUuid));
  inbox.intros.conversations.forEach((c) => personUuids.add(c.personUuid));

  return [...personUuids];
};

const jidToPersonUuid = (jid: string): string =>
  jid.split('@')[0];
const personUuidToJid = (personUuid: string): string =>
  `${personUuid}@duolicious.app`;

const setInboxSent = (recipientPersonUuid: string, message: string) => {
  setInbox(async (inbox) => {
    const i = inbox ?? emptyInbox();

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
    return {...i};
  });
};

const setInboxRecieved = async (
  fromPersonUuid: string,
  message: string,
) => {
  await setInbox(async (inbox: Inbox) => {
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

    // We could've returned `inbox` instead of a shallow copy. But then it
    // wouldn't trigger re-renders when passed to a useState setter.
    return {...inbox};
  });
};

const setInboxDisplayed = async (fromPersonUuid: string) => {
  await setInbox(async (inbox: Inbox) => {
    const chatsConversation =
      inbox.chats.conversationsMap[fromPersonUuid] as Conversation | undefined;
    const introsConversation =
      inbox.intros.conversationsMap[fromPersonUuid] as Conversation | undefined;

    const updatedConversation = {
      ...chatsConversation,
      ...introsConversation,
      lastMessageRead: true,
    };

    if (chatsConversation) {
      Object.assign(chatsConversation, updatedConversation);
    }
    if (introsConversation) {
      Object.assign(introsConversation, updatedConversation);
    }

    // We could've returned `inbox` instead of a shallow copy. But then it
    // wouldn't trigger re-renders when passed to a useState setter.
    return {...inbox};
  });
};

const select1 = (query: string, stanza: Element): xpath.SelectedValue => {
  const stanzaString = stanza.toString();
  const doc = new DOMParser().parseFromString(stanzaString, 'text/xml');
  return xpath.select1(query, doc);
};

const login = async (username: string, password: string) => {
  try {
    _xmpp = client({
      service: CHAT_URL,
      domain: "duolicious.app",
      username: username,
      password: password,
      resource: await deviceId(),
    });

    _isOnline = new Promise<boolean>(resolve => {
      _xmpp?.on("online", async () => {
        resolve(true);
      })
    });

    _xmpp.on("error", (err) => {
      console.error(err);
      if (err.message === "conflict - Replaced by new connection") {
        notify('stream-error');
      }
    });


    _xmpp.on("online", async () => {
      if (_xmpp) {
        await _xmpp.send(xml("presence", { type: "available" }));

        if (!_inbox) await refreshInbox();

        await registerForPushNotificationsAsync();

        // This is a hack to help figure out if the user is online. The
        // server-side notification logic relies on coarse-grained last-online
        // information to figure out if a notification should be sent.
        //
        // The XMPP server's mod_last module records the last disconnection
        // time. But other than that, I don't see an indication of online
        // status. So we periodically set users to "unavailable" to refresh the
        // last disconnection time. Caveat: Messages can't be received while
        // offline, so if someone gets a message during the split second they're
        // unavailable, they won't see it until they refresh the app. So it
        // could be better to set this to a higher number in the future.
        (async () => {
          while (true) {
            if (!_xmpp) break;
            await delay(3 * 60 * 1000); // 3 minutes
            await _xmpp.send(xml("presence", { type: "unavailable" }));
            await _xmpp.send(xml("presence", { type: "available" }));
          }
        })();
      }
    });

    onReceiveMessage(); // Updates inbox

    await _xmpp.start();
  } catch (e) {
    _xmpp = undefined;

    console.error(e);
  }
}

const markDisplayed = async (message: Message) => {
  if (!_xmpp) return;
  if (message.fromCurrentUser) return;

  const stanza = parse(`
    <message to='${message.from}' from='${message.to}'>
      <displayed xmlns='urn:xmpp:chat-markers:0' id='${message.id}'/>
    </message>
  `);

  await _xmpp.send(stanza);
  await setInboxDisplayed(jidToPersonUuid(message.from));
};

const _sendMessage = (
  recipientPersonUuid: string,
  message: string,
  callback: (messageStatus: Omit<MessageStatus, 'unsent: error'>) => void,
  checkUniqueness: boolean,
): void => {
  const id = getRandomString(40);
  const fromJid = (
      signedInUser?.personId !== undefined ?
      personUuidToJid(signedInUser.personUuid) :
      undefined
  );
  const toJid = personUuidToJid(recipientPersonUuid);

  if (!_xmpp) return;
  if (!fromJid) return;

  const messageXml = xml(
    "message",
    {
      type: "chat",
      from: fromJid,
      to: toJid,
      id: id,
      check_uniqueness: checkUniqueness ? 'true' : 'false',
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

    if (_xmpp) {
      _xmpp.removeListener("input", messageStatusListener);
    }
  };

  _xmpp.addListener("input", messageStatusListener);

  _xmpp.send(messageXml);
};

const sendMessage = async (
  recipientPersonUuid: string,
  message: string,
  checkUniqueness: boolean = false,
): Promise<MessageStatus> => {
  const __sendMessage = new Promise(
    (resolve: (messageStatus: MessageStatus) => void) =>
      _sendMessage(recipientPersonUuid, message, resolve, checkUniqueness)
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
  };

  return inbox;
};

const setConversationArchived = (personUuid: string, isArchived: boolean) => {
  setInbox((inbox) => {
    if (!inbox) {
      return inbox;
    }

    const conversationToUpdate = (
      inbox.chats .conversationsMap[personUuid] ??
      inbox.intros.conversationsMap[personUuid]) as Conversation | undefined;

    if (conversationToUpdate) {
      conversationToUpdate.location = 'archive';
    }

    return conversationsToInbox([
      ...inbox.chats.conversations,
      ...inbox.intros.conversations,
      ...inbox.archive.conversations,
    ]);
  });
};

const onReceiveMessage = (
  callback?: (message: Message) => void,
  otherPersonUuid?: string,
  doMarkDisplayed?: boolean,
): (() => void) | undefined => {
  if (!_xmpp)
    return undefined;

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
      otherPersonUuid !== jidToPersonUuid(from.toString())
    ) return;

    const message: Message = {
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
      timestamp: stamp.toString() ? new Date(stamp.toString()) : new Date(),
      fromCurrentUser: jidToPersonUuid(from.toString()) == signedInUser?.personUuid,
    };

    await setInboxRecieved(
      jidToPersonUuid(from.toString()),
      bodyText.toString(),
    );
    if (otherPersonUuid !== undefined && doMarkDisplayed !== false) {
      await markDisplayed(message);
    }

    if (callback !== undefined) {
      callback(message);
    }
  };

  const _removeListener = () => {
    if (!_xmpp) return;
    _xmpp.removeListener("stanza", _onReceiveMessage);
  };

  _xmpp.addListener("stanza", _onReceiveMessage);
  return _removeListener;
}

const _fetchConversation = async (
  withPersonUuid: string,
  callback: (messages: Message[] | 'timeout') => void,
  beforeId: string = '',
) => {
  const isOnline = await withTimeout(30000, _isOnline);

  if (isOnline !== true)
    return callback('timeout');

  if (!_xmpp)
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

    if (_xmpp) {
      _xmpp.removeListener("stanza", maybeCollect);
      _xmpp.removeListener("stanza", maybeFin);
    }
  };

  _xmpp.addListener("stanza", maybeCollect);
  _xmpp.addListener("stanza", maybeFin);

  await _xmpp.send(queryStanza);
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

const _fetchInbox = async (
  callback: (conversations: Inbox | undefined) => void,
) => {
  if (!_xmpp) {
    return callback(undefined);
  }

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='${queryId}'>
        <x xmlns='jabber:x:data' type='form'/>
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

    const fromCurrentUserByUuid = from.toString().startsWith(
      `${signedInUser?.personUuid}@`);

    const fromCurrentUserById = from.toString().startsWith(
      `${signedInUser?.personId}@`);

    // Some of these need to be fetched from via the API
    const personUuid = (fromCurrentUserByUuid ? to : from).toString().split('@')[0];
    const personId = parseIntOrZero(
      (fromCurrentUserById ? to : from).toString().split('@')[0]);
    const name = '';
    const matchPercentage = 0;
    const imageUuid = null;
    const lastMessage = bodyText.toString();
    const lastMessageRead = numUnread.toString() === '0';
    const lastMessageTimestamp = new Date(timestamp.toString());
    const isAvailableUser = true;
    const location = 'archive';

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

    await populateConversationList(conversations.conversations);

    const inbox = conversationsToInbox(conversations.conversations);

    callback(inbox);

    if (_xmpp) {
      _xmpp.removeListener("stanza", maybeCollect);
      _xmpp.removeListener("stanza", maybeFin);
    }
  };

  _xmpp.addListener("stanza", maybeCollect);
  _xmpp.addListener("stanza", maybeFin);

  await _xmpp.send(queryStanza);
};

const fetchInbox = async (): Promise<Inbox | undefined> => {
  return new Promise((resolve) => _fetchInbox(resolve));
};

const refreshInbox = async (): Promise<void> => {
  const inbox = await fetchInbox();
  if (!inbox) return;

  setInbox(() => inbox);
};

const logout = async () => {
  if (_xmpp) {
    _isOnline = false;
    await _xmpp.send(xml("presence", { type: "unavailable" })).catch(console.error);
    await _xmpp.stop().catch(console.error);
    setInbox(() => null);
  }
};

const registerPushToken = async (token: string) => {
  if (!_xmpp) return;

  const stanza = parse(`<duo_register_push_token token='${token}' />`);

  await _xmpp.send(stanza);
};

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
  observeInbox,
  onReceiveMessage,
  refreshInbox,
  registerPushToken,
  sendMessage,
  setConversationArchived,
  setInbox,
};
