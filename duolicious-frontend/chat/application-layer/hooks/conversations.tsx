import { useCallback, useEffect, useState } from 'react';
import { compareArrays } from '../../../util/util';
import { Inbox, Conversation, getInbox } from '../index';
import { listen } from '../../../events/events';
import * as _ from 'lodash';


const getSection = (sectionIndex: number, showArchive: boolean) => {
  if (showArchive) {
    return 'archive';
  } else if (sectionIndex === 0) {
    return 'intros';
  } else {
    return 'chats';
  }
};

const getSortBy = (sortByIndex: number) => {
  if (sortByIndex === 0) {
    return 'match';
  } else {
    return 'latest'
  }
};

/**
 * React hook that returns the list of `personUuid`s for the conversations
 * that belong to the requested inbox section. The list is memoised so that
 * the reference will only change when the ordering or membership actually
 * changes – this helps to minimise re-renders of parent components that pass
 * the list directly to a `FlatList`.
 *
 * @param section   Which sub-section of the inbox to return ("intros",
 *                  "chats" or "archive").
 * @param sortBy    Sorting preference index; mirrors the logic from the
 *                  original implementation in `components/inbox-tab.tsx`.
 */
const getSectionConversations = (
  inbox: Inbox | null,
  section: 'intros' | 'chats' | 'archive',
): Conversation[] => {
  if (!inbox) return [];

  switch (section) {
    case 'intros':  return inbox.intros.conversations;
    case 'chats':   return inbox.chats.conversations;
    case 'archive': return inbox.archive.conversations;
    default:        return [];
  }
};

const sortConversations = (
  conversations: Conversation[],
  section: 'intros' | 'chats' | 'archive',
  sortBy: 'latest' | 'match',
): Conversation[] => {
  if (conversations.length === 0) return conversations;

  return [...conversations].sort((a, b) => {
    if (section === 'archive') {
      return compareArrays([
        +b.lastMessageTimestamp,
      ], [
        +a.lastMessageTimestamp,
      ]);
    } else if (section === 'intros' && sortBy === 'match') {
      return compareArrays(
        [b.matchPercentage, +b.lastMessageTimestamp],
        [a.matchPercentage, +a.lastMessageTimestamp],
      );
    } else {
      return compareArrays(
        [+b.lastMessageTimestamp, b.matchPercentage],
        [+a.lastMessageTimestamp, a.matchPercentage],
      );
    }
  });
};

const computeConversationIds = (
  inbox: Inbox | null,
  section: 'intros' | 'chats' | 'archive',
  sortBy: 'latest' | 'match'
): string[] | null => {
  if (inbox === null) {
    return null;
  }

  const conversations = getSectionConversations(inbox, section);
  const sorted = sortConversations(conversations, section, sortBy);
  return sorted.map((c) => c.personUuid);
};

const useConversations = () => {
  const [state, setState] = useState<{
    conversations: string[] | null,
    sectionIndex: number,
    sortByIndex: number,
    showArchive: boolean,
  }>({
    conversations: null,
    sectionIndex: 0,
    sortByIndex: 0,
    showArchive: false,
  });

  // Subscribe to inbox updates and update only when the derived list changes.
  useEffect(() => {
    const onUpdate = (newInbox?: Inbox | null) => {
      console.log('onUpdate', newInbox);
      setState((oldState) => {
        const { sectionIndex, sortByIndex, showArchive } = oldState;

        const section = getSection(sectionIndex, showArchive);
        const sortBy = getSortBy(sortByIndex);

        const newIds = computeConversationIds(newInbox ?? null, section, sortBy);

        return _.isEqual(oldState.conversations, newIds)
          ? oldState
          : { ...oldState, conversations: newIds }
      });
    };

    return listen<Inbox | null>('inbox', onUpdate, true);
  }, []);

  const setSectionIndex = useCallback((sectionIndex: number) => {
    setState((oldState) => {
      if (oldState.sectionIndex === sectionIndex) {
        return oldState;
      }

      const { sortByIndex, showArchive } = oldState;

      const section = getSection(sectionIndex, showArchive);
      const sortBy = getSortBy(sortByIndex);

      const inbox = getInbox();
      const conversations = computeConversationIds(inbox, section, sortBy);

      return { ...oldState, conversations, sectionIndex };
    });
  }, []);

  const setSortByIndex = useCallback((sortByIndex: number) => {
    setState((oldState) => {
      if (oldState.sortByIndex === sortByIndex) {
        return oldState;
      }

      const { sectionIndex, showArchive } = oldState;

      const section = getSection(sectionIndex, showArchive);
      const sortBy = getSortBy(sortByIndex);

      const inbox = getInbox();
      const conversations = computeConversationIds(inbox, section, sortBy);

      return { ...oldState, conversations, sortByIndex };
    });
  }, []);

  const setShowArchive = useCallback((f: (showArchive: boolean) => boolean) => {
    setState((oldState) => {
      const showArchive = f(oldState.showArchive);

      if (oldState.showArchive === showArchive) {
        return oldState;
      }

      const { sectionIndex, sortByIndex } = oldState;

      const section = getSection(sectionIndex, showArchive);
      const sortBy = getSortBy(sortByIndex);

      const inbox = getInbox();
      const conversations = computeConversationIds(inbox, section, sortBy);

      return { ...oldState, conversations, showArchive };
    });
  }, []);

  return {
    ...state,
    setSectionIndex,
    setSortByIndex,
    setShowArchive,
  }
};

export { useConversations };
