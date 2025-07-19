import {
  ListRenderItemInfo,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import Animated from 'react-native-reanimated';
import { useConversation } from '../chat/application-layer/hooks/conversation';
import { TopNavBar } from './top-nav-bar';
import { IntrosItem, ChatsItem } from './inbox-item';
import { DefaultText } from './default-text';
import { ButtonGroup } from './button-group';
import { useInboxStats } from '../chat/application-layer/hooks/inbox-stats';
import { useConversations } from '../chat/application-layer/hooks/conversations';
import { TopNavBarButton } from './top-nav-bar-button';
import { inboxOrder, inboxSection } from '../kv-storage/inbox';
import { listen } from '../events/events';
import { useScrollbar } from './navigation/scroll-bar-hooks';


const IntrosItemMemo = memo(IntrosItem);
const ChatsItemMemo = memo(ChatsItem);

const RenderItem = ({ item }: { item: string }) => {
  const conversation = useConversation(item);

  if (!conversation) {
    return <></>;
  } else if (conversation.location === 'intros') {
    return <IntrosItemMemo
      wasRead={conversation.lastMessageRead}
      name={conversation.name}
      personUuid={conversation.personUuid}
      photoUuid={conversation.photoUuid}
      photoBlurhash={conversation.photoBlurhash}
      matchPercentage={conversation.matchPercentage}
      lastMessage={conversation.lastMessage}
      lastMessageTimestamp={conversation.lastMessageTimestamp}
      isAvailableUser={conversation.isAvailableUser}
      isVerified={conversation.isVerified}
    />
  } else {
    return <ChatsItemMemo
      wasRead={conversation.lastMessageRead}
      name={conversation.name}
      personUuid={conversation.personUuid}
      photoUuid={conversation.photoUuid}
      photoBlurhash={conversation.photoBlurhash}
      matchPercentage={conversation.matchPercentage}
      lastMessage={conversation.lastMessage}
      lastMessageTimestamp={conversation.lastMessageTimestamp}
      isAvailableUser={conversation.isAvailableUser}
      isVerified={conversation.isVerified}
    />
  }
};

const renderItem = ({ item }: ListRenderItemInfo<string>) =>
  <RenderItem item={item} />;

const keyExtractor = (id: string) => id;

const InboxTab = () => {
  const {
    conversations,
    sectionIndex,
    sortByIndex,
    showArchive,
    setSectionIndex,
    setSortByIndex,
    setShowArchive,
  } = useConversations();

  const stats = useInboxStats();

  const numUnreadIntros = stats?.numUnreadIntros ?? 0;
  const numUnreadChats  = stats?.numUnreadChats  ?? 0;

  const introsNumericalLabel = (
    numUnreadIntros ?
      ` (${numUnreadIntros})` :
      '');
  const chatsNumericalLabel = (
    numUnreadChats  ?
    ` (${numUnreadChats})` :
    '');

  const setSectionIndex_ = useCallback((value: number) => {
    setSectionIndex(value);
    inboxSection(value);
  }, []);

  const setSortByIndex_  = useCallback((value: number) => {
    setSortByIndex(value);
    inboxOrder(value);
  }, []);

  const onPressArchiveButton = useCallback(() => {
    setShowArchive(x => !x);
  }, []);

  useEffect(() => {
    (async () => {
      const _inboxOrder = await inboxOrder();
      const _inboxSection = await inboxSection();

      setSectionIndex(_inboxSection);
      setSortByIndex(_inboxOrder);
    })();
  }, []);

  const emptyText = (() => {
    if (!showArchive && sectionIndex === 0)
      return (
        'This is where you’ll see messages from people who’ve reached out ' +
        'to you first – Once you reply, they’ll move to your Chats\xa0💬'
      );
    if (!showArchive && sectionIndex === 1)
      return (
        'This is where you’ll see active conversations – Chats start once ' +
        'both people have exchanged messages\xa0💬'
      );
    if (showArchive)
      return 'No archived conversations to show';
    throw Error('Unhandled inbox section');
  })();

  const endText = (() => {
    if (showArchive) {
      return 'No more archived conversations to show';
    } else {
      if (sectionIndex === 0) {
        return 'Those are all the intros you have for now';
      } else {
        return 'No more chats to show';
      }
    }
  })();

  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('inbox');

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <InboxTabNavBar
        showArchive={showArchive}
        onPressArchiveButton={onPressArchiveButton}
      />
      {conversations === null &&
        <View style={{height: '100%', justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {conversations !== null &&
        <View style={styles.flatListContainer} onLayout={onLayout}>
          <Animated.FlatList<string>
            ref={observeListRef}
            data={conversations}
            ListHeaderComponent={<>{
              !showArchive && <>
                <ButtonGroup
                  buttons={[
                    'Intros' + introsNumericalLabel,
                    'Chats'  + chatsNumericalLabel
                  ]}
                  selectedIndex={sectionIndex}
                  onPress={setSectionIndex_}
                  containerStyle={{
                    marginTop: 5,
                    marginLeft: 20,
                    marginRight: 20,
                  }}
                />
                <ButtonGroup
                  buttons={['Best Matches First', 'Latest First']}
                  selectedIndex={sortByIndex}
                  onPress={setSortByIndex_}
                  secondary={true}
                  disabled={sectionIndex === 1}
                  containerStyle={{
                    flexGrow: 1,
                    marginLeft: 20,
                    marginRight: 20,
                  }}
                />
              </>
            }</>}
            ListEmptyComponent={
              <DefaultText style={styles.emptyText}>
                {emptyText}
              </DefaultText>
            }
            ListFooterComponent={
              conversations.length > 0 ?
                <DefaultText style={styles.endText}>{endText}</DefaultText> :
                null
            }
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            contentContainerStyle={styles.flatList}
          />
        </View>
      }
    </SafeAreaView>
  );
};

const InboxTabNavBar = ({
  showArchive,
  onPressArchiveButton,
}) => {
  const [isOnline, setIsOnline] = useState(false);

  useLayoutEffect(() => {
    return listen(
      'xmpp-is-online',
      (data) => setIsOnline(data ?? false),
      true,
    );
  }, []);

  return (
    <TopNavBar>
      <View>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          {'Inbox' + (showArchive ? ' (Archive)' : '')}
        </DefaultText>
        {!isOnline &&
          <ActivityIndicator
            size="small"
            color="#70f"
            style={{
              position: 'absolute',
              right: -40,
              top: 3,
            }}
          />
        }
      </View>
      <TopNavBarButton
        onPress={onPressArchiveButton}
        iconName={showArchive ? 'chatbubbles-outline' : 'file-tray-full-outline'}
        position="right"
        secondary={false}
        label={showArchive ? "Inbox" : "Archive"}
      />
    </TopNavBar>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  },
  flatList: {
    paddingTop: 10,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  flatListContainer: {
    flex: 1,
  },
  emptyText: {
    fontFamily: 'Trueno',
    margin: '20%',
    textAlign: 'center',
  },
  endText: {
    fontFamily: 'TruenoBold',
    color: '#000',
    fontSize: 16,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 30,
    marginBottom: 30,
    marginLeft: '15%',
    marginRight: '15%',
  }
});

export { InboxTab };
