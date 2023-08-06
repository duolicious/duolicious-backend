import {
  CHAT_URL,
} from '../env/env';
import { Client, client, xml } from '@xmpp/client';
import { Element } from '@xmpp/xml';
import { parse } from 'ltx';

import { DOMParser } from 'xmldom';
import xpath from 'xpath';

import { signedInUser } from '../App';
import { getRandomString } from '../random/string';

import { deviceId } from '../kv-storage/device-id';
import { api } from '../api/api';
import { deleteFromArray, withTimeout } from '../util/util';

// TODO: Catch more exceptions. If a network request fails, that shouldn't crash the app.
// TODO: Update match percentages when user answers some questions
// TODO: When someone opens two windows, display a warning. Or get multiple sessions working
// TODO: Intros should be the first tab

type MessageStatus =
  | 'sent'
  | 'not unique'
  | 'timeout'

type Message = {
  text: string
  from: string
  to: string
  fromCurrentUser: boolean
  id: string
};

type Conversation = {
  personId: number
  name: string
  matchPercentage: number
  imageUuid: string | null
  lastMessage: string
  lastMessageRead: boolean
  lastMessageTimestamp: Date
};

type ConversationsMap = { [key: string]: Conversation };
type MarkDisplayedMap = { [key: string]: number };

type Conversations = {
  conversations: Conversation[]
  conversationsMap: ConversationsMap
  numUnread: number
};

type Inbox = {
  chats: Conversations
  intros: Conversations
  numUnread: number
};

const emtpyInbox = (): Inbox => ({
  chats: {
    conversations: [], conversationsMap: {}, numUnread: 0 },
  intros: {
    conversations: [], conversationsMap: {}, numUnread: 0 },
  numUnread: 0,
});

let _xmpp: Client | undefined;

let _inbox: Inbox = emtpyInbox();
const _inboxObservers: Set<(inbox: Inbox | undefined) => void> = new Set();

const observeInbox = (callback: (inbox: Inbox | undefined) => void): void => {
  if (_inboxObservers.has(callback))
    return;

  _inboxObservers.add(callback);

  if (_inbox !== undefined)
    callback(_inbox);
};

const setInbox = async (
  setter: (inbox: Inbox) => Promise<Inbox> | Inbox
): Promise<void> => {
  _inbox = await setter(_inbox);
  _inboxObservers.forEach((observer) => observer(_inbox));
};

const conversationListToMap = (
  conversationList: Conversation[]
): ConversationsMap => {
  return conversationList.reduce<ConversationsMap>(
    (obj, item) => { obj[item.personId] = item; return obj; },
    {}
  );

};

const populateConversationList = async (
  conversationList: Conversation[]
): Promise<void> => {
  const personIds: number[] = conversationList.map(c => c.personId);

  const query = personIds.map(id => `prospect-person-id=${id}`).join('&');
  // TODO: Better error handling
  const response = conversationList.length === 0 ?
    [] :
    (await api('get', `/inbox-info?${query}`)).json;

  const personIdToInfo = response.reduce((obj, item) => {
    obj[item.person_id] = item;
    return obj;
  }, {});

  conversationList.forEach((c: Conversation) => {
    c.personId = personIdToInfo[c.personId].person_id;
    c.name = personIdToInfo[c.personId].name;
    c.matchPercentage = personIdToInfo[c.personId].match_percentage;
    c.imageUuid = personIdToInfo[c.personId].image_uuid;
  });
};

const populateConversation = async (
  conversation: Conversation
): Promise<void> => {
  await populateConversationList([conversation]);
};

const inboxToPersonIds = (inbox: Inbox): number[] => {
  const personIds = new Set<number>();

  inbox.chats .conversations.forEach((c) => personIds.add(c.personId));
  inbox.intros.conversations.forEach((c) => personIds.add(c.personId));

  return [...personIds];
};

const jidToPersonId = (jid: string): number =>
  parseInt(jid.split('@')[0]);
const personIdToJid = (personId: number): string =>
  `${personId}@duolicious.app`;

const setInboxSent = (recipientPersonId: number, message: string) => {
  setInbox(async (inbox) => {
    const chatsConversation =
      inbox.chats.conversationsMap[recipientPersonId] as Conversation | undefined;
    const introsConversation =
      inbox.intros.conversationsMap[recipientPersonId] as Conversation | undefined;

    inbox.chats.numUnread  -= (
      chatsConversation ?.lastMessageRead ?? true) ? 0 : 1;
    inbox.intros.numUnread -= (
      introsConversation?.lastMessageRead ?? true) ? 0 : 1;

    inbox.numUnread = (
      inbox.chats.numUnread +
      inbox.intros.numUnread);

    const updatedConversation: Conversation = {
      personId: recipientPersonId,
      name: '',
      matchPercentage: 0,
      imageUuid: null,
      ...chatsConversation,
      ...introsConversation,
      lastMessage: message,
      lastMessageRead: true,
      lastMessageTimestamp: new Date(),
    };

    // It's a new conversation!
    if (!chatsConversation && !introsConversation) {
      await populateConversation(updatedConversation);
    }

    // Add it to chats if it wasn't already there
    if (!chatsConversation) {
      // Add conversation into chats
      await moveToChats(recipientPersonId);

      inbox.chats.conversations.push(updatedConversation);
      inbox.chats.conversationsMap[recipientPersonId] = updatedConversation;

      // Remove conversation from intros
      deleteFromArray(inbox.intros.conversations, introsConversation);
      delete inbox.intros.conversationsMap[recipientPersonId];
    }
    // Update existing chat otherwise
    else {
      Object.assign(chatsConversation, updatedConversation);
    }

    // We could've returned `inbox` instead of a shallow copy. But then it
    // wouldn't trigger re-renders when passed to a useState setter.
    return {...inbox};
  });
};

const setInboxRecieved = async (
  fromPersonId: number,
  message: string,
) => {
  await setInbox(async (inbox: Inbox) => {
    const chatsConversation =
      inbox.chats.conversationsMap[fromPersonId] as Conversation | undefined;
    const introsConversation =
      inbox.intros.conversationsMap[fromPersonId] as Conversation | undefined;

    inbox.chats.numUnread += (
        // The received message is the continuation of a 'chats' conversation
        // whose last message was read
        chatsConversation && chatsConversation.lastMessageRead
      ) ? 1 : 0;

    inbox.intros.numUnread += (
        // The received message is the continuation of an 'intro' conversation
        // whose last message was read
        introsConversation && introsConversation.lastMessageRead ||
        // The received message is new
        !introsConversation && !chatsConversation
      ) ? 1 : 0;

    inbox.numUnread = inbox.chats.numUnread + inbox.intros.numUnread;

    const updatedConversation: Conversation = {
      personId: fromPersonId,
      name: '',
      matchPercentage: 0,
      imageUuid: null,
      ...chatsConversation,
      ...introsConversation,
      lastMessage: message,
      lastMessageRead: false,
      lastMessageTimestamp: new Date(),
    };

    if (!chatsConversation && !introsConversation) {
      // It's a new conversation! Put 'er in the intros!
      await populateConversation(updatedConversation);

      inbox.intros.conversations.push(updatedConversation);
      inbox.intros.conversationsMap[fromPersonId] = updatedConversation;
    } else if (chatsConversation) {
      Object.assign(chatsConversation, updatedConversation);
    } else if (introsConversation) {
      Object.assign(introsConversation, updatedConversation);
    }

    // We could've returned `inbox` instead of a shallow copy. But then it
    // wouldn't trigger re-renders when passed to a useState setter.
    return {...inbox};
  });
};

const setInboxDisplayed = async (fromPersonId: number) => {
  await setInbox(async (inbox: Inbox) => {
    const chatsConversation =
      inbox.chats.conversationsMap[fromPersonId] as Conversation | undefined;
    const introsConversation =
      inbox.intros.conversationsMap[fromPersonId] as Conversation | undefined;

    inbox.chats.numUnread -=
        (chatsConversation?.lastMessageRead ?? true) ?
        0 :
        1;

    inbox.intros.numUnread -=
        (introsConversation?.lastMessageRead ?? true) ?
        0 :
        1;

    inbox.numUnread = inbox.chats.numUnread + inbox.intros.numUnread;

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

    _xmpp.on("error", (err) => {
      console.error(err);
    });


    _xmpp.on("online", async () => {
      if (_xmpp) {
        await _xmpp.send(xml("presence", { type: "available" }));
        await refreshInbox();
      }
    });

    onReceiveMessage(); // Updates inbox

    await _xmpp.start();
  } catch (e) {
    _xmpp = undefined;

    console.error(e);
  }
}

const _markDisplayed = async (message: Message) => {
  if (!_xmpp) return;
  if (message.fromCurrentUser) return;

  const stanza = parse(`
    <message to='${message.from}' from='${message.to}'>
      <displayed xmlns='urn:xmpp:chat-markers:0' id='${message.id}'/>
    </message>
  `);

  await _xmpp.send(stanza);
  await setInboxDisplayed(jidToPersonId(message.from));
};

const _sendMessage = async (
  recipientPersonId: number,
  message: string,
  callback: (messageStatus: Omit<MessageStatus, 'unsent: error'>) => void,
  checkUniqueness: boolean,
): Promise<void> => {
  if (!_xmpp) return;

  const id = getRandomString(40);
  const jid = personIdToJid(recipientPersonId);

  const messageXml = xml(
    "message",
    {
      type: "chat",
      to: jid,
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

    const notUniqueNode = xpath.select1(
      `/*[name()='duo_message_not_unique'][@id='${id}']`,
      doc
    );

    const messageDeliveredNode = xpath.select1(
      `/*[name()='duo_message_delivered'][@id='${id}']`,
      doc
    );

    if (notUniqueNode) {
      callback('unsent: not unique');
    } else if (messageDeliveredNode) {
      setInboxSent(recipientPersonId, message);
      callback('sent');
    }

    if (_xmpp) {
      _xmpp.removeListener("input", messageStatusListener);
    }
  };

  _xmpp.addListener("input", messageStatusListener);

  try {
    await _xmpp.send(messageXml);
  } catch {}
};

const sendMessage = async (
  recipientPersonId: number,
  message: string,
  checkUniqueness: boolean = false,
): Promise<MessageStatus> => {
  const __sendMessage = new Promise(
    (resolve: (messageStatus: MessageStatus) => void) =>
      _sendMessage(recipientPersonId, message, resolve, checkUniqueness)
  );

  return await withTimeout(5000, __sendMessage);
};

const onReceiveMessage = (
  callback?: (message: Message) => void,
  otherPersonId?: number,
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
    const bodyText = xpath.select1(`string(./text())`, node);

    if (from === null) return;
    if (to === null) return;
    if (id === null) return;
    if (bodyText === null) return;

    if (
      otherPersonId !== undefined &&
      otherPersonId !== jidToPersonId(from.toString())
    ) return;

    const message: Message = {
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
      fromCurrentUser: jidToPersonId(from.toString()) == signedInUser?.personId,
    };

    await setInboxRecieved(
      jidToPersonId(from.toString()),
      bodyText.toString(),
    );
    if (otherPersonId !== undefined) {
      await _markDisplayed(message);
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

const moveToChats = async (personId: number) => {
  if (!_xmpp) return;

  const jid = personIdToJid(personId);

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq id='${queryId}' type='set'>
      <query xmlns='erlang-solutions.com:xmpp:inbox:0#conversation' jid='${jid}'>
        <box>chats</box>
      </query>
    </iq>
  `);

  return await _xmpp.send(queryStanza);
};

const _fetchConversation = async (
  withPersonId: number,
  callback: (messages: Message[] | 'timeout') => void,
) => {
  if (!_xmpp) return callback('timeout');

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <query xmlns='urn:xmpp:mam:2' queryid='${queryId}'>
        <x xmlns='jabber:x:data' type='submit'>
          <field var='FORM_TYPE'>
            <value>urn:xmpp:mam:2</value>
          </field>
          <field var='with'>
            <value>${personIdToJid(withPersonId)}</value>
          </field>
        </x>
        <set xmlns='http://jabber.org/protocol/rsm'>
          <max>50</max>
          <before/>
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
    const bodyText = xpath.select1(`string(./*[name()='body']/text())`, node);

    if (from === null) return;
    if (to === null) return;
    if (id === null) return;
    if (bodyText === null) return;

    const fromCurrentUser = from.toString().startsWith(
        `${signedInUser?.personId}@`);

    collected.push({
      text: bodyText.toString(),
      from: from.toString(),
      to: to.toString(),
      id: id.toString(),
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
      await _markDisplayed(lastMessage);
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
  withPersonId: number
): Promise<Message[] | undefined | 'timeout'> => {
  const __fetchConversation = new Promise(
    (resolve: (messages: Message[] | undefined | 'timeout') => void) =>
      _fetchConversation(withPersonId, resolve)
    );

  return await withTimeout(5000, __fetchConversation);
};

const _fetchBox = async (
  box: string,
  callback: (conversations: Conversations | undefined) => void,
) => {
  if (!_xmpp) {
    return callback(undefined);
  }

  const queryId = getRandomString(10);

  const queryStanza = parse(`
    <iq type='set' id='${queryId}'>
      <inbox xmlns='erlang-solutions.com:xmpp:inbox:0' queryid='${queryId}'>
        <x xmlns='jabber:x:data' type='form'>
          <field type='text-single' var='box'><value>${box}</value></field>
        </x>
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

    const fromCurrentUser = from.toString().startsWith(
      `${signedInUser?.personId}@`);

    // Some of these need to be fetched from via the API
    const personId = parseInt(
      (fromCurrentUser ? to : from).toString().split('@')[0]);
    const name = '';
    const matchPercentage = 0;
    const imageUuid = null;
    const lastMessage = bodyText.toString();
    const lastMessageRead = numUnread.toString() === '0';
    const lastMessageTimestamp = new Date(timestamp.toString());

    const conversation: Conversation = {
      personId,
      name,
      matchPercentage,
      imageUuid,
      lastMessage,
      lastMessageRead,
      lastMessageTimestamp,
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
      numUnread: conversationList.reduce(
        (acc, conversation) => acc + (conversation.lastMessageRead ? 0 : 1),
        0
      ),
    };

    await populateConversationList(conversations.conversations);

    callback(conversations);

    if (_xmpp) {
      _xmpp.removeListener("stanza", maybeCollect);
      _xmpp.removeListener("stanza", maybeFin);
    }
  };

  _xmpp.addListener("stanza", maybeCollect);
  _xmpp.addListener("stanza", maybeFin);

  await _xmpp.send(queryStanza);
};

const fetchBox = async (box: string): Promise<Conversations | undefined> => {
  return new Promise((resolve) => _fetchBox(box, resolve));
};

const refreshInbox = async (): Promise<void> => {
  const chats  = await fetchBox('chats'); if (!chats)  return;
  const intros = await fetchBox('inbox'); if (!intros) return;
  const numUnread = chats.numUnread + intros.numUnread;

  setInbox((inbox: Inbox) => ({
    chats,
    intros,
    numUnread,
  }));
};

const logout = async () => {
  if (_xmpp) {
    await _xmpp.send(xml("presence", { type: "unavailable" }));
    await _xmpp.stop().catch(console.error);
    setInbox(emtpyInbox);
  }
};

export {
  Conversation,
  Conversations,
  Inbox,
  Message,
  MessageStatus,
  fetchConversation,
  login,
  logout,
  observeInbox,
  onReceiveMessage,
  sendMessage,
  setInbox,
};
