import {
  ListRenderItemInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TopNavBar } from './top-nav-bar';
import { IntrosItem, ChatsItem } from './inbox-item';
import { DefaultText } from './default-text';
import { ButtonGroup } from './button-group';
import { Notice } from './notice';
import { OptionScreen } from './option-screen';
import { hideMeFromStrangersOptionGroup } from '../data/option-groups';
import { DefaultFlatList } from './default-flat-list';
import { Inbox, Conversation, inboxStats, observeInbox } from '../xmpp/xmpp';
import { compareArrays } from '../util/util';
import { TopNavBarButton } from './top-nav-bar-button';
import { listen, unlisten } from '../events/events';

const Stack = createNativeStackNavigator();

const IntrosItemMemo = memo(IntrosItem);
const ChatsItemMemo = memo(ChatsItem);

const InboxTab = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Inbox Tab" component={InboxTab_} />
      <Stack.Screen name="Inbox Option Screen" component={OptionScreen} />
    </Stack.Navigator>
  );
};

const InboxTab_ = ({navigation}) => {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [sortByIndex, setSortByIndex] = useState(0);
  const [isTooManyTapped, setIsTooManyTapped] = useState(false);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const listRef = useRef<any>(undefined);

  const _inboxStats = inbox ? inboxStats(inbox) : null;

  const numUnreadChats = (() => {
    if (!_inboxStats) {
      return 0;
    }

    return showArchive ?
      _inboxStats.chats.numUnreadArchive :
      _inboxStats.chats.numUnreadInbox;
  })();

  const numUnreadIntros = (() => {
    if (!_inboxStats) {
      return 0;
    }

    return showArchive ?
      _inboxStats.intros.numUnreadArchive :
      _inboxStats.intros.numUnreadInbox;
  })();

  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const fadeOut = useCallback(() => {
    Animated.timing(buttonOpacity, {
      toValue: 0.0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeIn = useCallback(() => {
    Animated.timing(buttonOpacity, {
      toValue: 1.0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const setSectionIndex_ = useCallback((value) => setSectionIndex(value), []);
  const setSortByIndex_  = useCallback((value) => setSortByIndex(value), []);

  const onPressTooMany = useCallback(() => {
    navigation.navigate(
      'Inbox Option Screen',
      {
        optionGroups: [hideMeFromStrangersOptionGroup],
      }
    );
    setIsTooManyTapped(true);
  }, []);

  const onPressArchiveButton = useCallback(() => {
    setShowArchive(x => !x);
  }, []);

  const maybeRefresh = useCallback(() => {
    listRef.current?.refresh && listRef.current.refresh()
  }, [listRef]);

  useEffect(() => observeInbox(setInbox), []);

  useEffect(maybeRefresh, [maybeRefresh, sectionIndex]);
  useEffect(maybeRefresh, [maybeRefresh, sortByIndex]);
  useEffect(maybeRefresh, [maybeRefresh, inbox]);
  useEffect(maybeRefresh, [maybeRefresh, showArchive]);


  const personIds = inbox ? [
    ...(inbox ? inbox .chats.conversations.map(c => c.personId).sort() : []),
    ...(inbox ? inbox.intros.conversations.map(c => c.personId).sort() : []),
  ] : [];

  useEffect(() => {
    personIds.forEach((personId) =>
      listen(`hide-profile-${personId}`, maybeRefresh));
    return () =>
      personIds.forEach((personId) =>
        unlisten(`hide-profile-${personId}`, maybeRefresh));
  }, [personIds.toString()]);

  const fetchInboxPage = (
    sectionName: 'chats' | 'intros'
  ) => async (
    n: number
  ): Promise<Conversation[]> => {
    if (inbox === null) {
      return [];
    }

    const section = sectionName === 'chats' ? inbox.chats : inbox.intros;

    const pageSize = 10;
    const page = [...section.conversations]
      .filter((c) => (!c.isAvailableUser || c.wasArchivedByMe) === showArchive)
      .sort((a, b) => {
        if (sectionName === 'intros' && sortByIndex === 0) {
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
      })
      .slice(
        pageSize * (n - 1),
        pageSize * n
      );

    return page;
  };

  const fetchChatsPage  = fetchInboxPage('chats');
  const fetchIntrosPage = fetchInboxPage('intros');

  const ListHeaderComponent = () => {
    useEffect(() => {
      if (sectionIndex === 0) {
        fadeIn();
      } else {
        fadeOut();
      }
    }, [sectionIndex]);

    return (
      <>
        <ButtonGroup
          buttons={[
            'Intros' + (numUnreadIntros ? ` (${numUnreadIntros})` : ''),
            'Chats'  + (numUnreadChats  ? ` (${numUnreadChats})`  : ''),
          ]}
          selectedIndex={sectionIndex}
          onPress={setSectionIndex_}
          containerStyle={{
            marginTop: 5,
            marginLeft: 20,
            marginRight: 20,
          }}
        />
        <Animated.View
          style={{
            opacity: buttonOpacity,
          }}
          pointerEvents={sectionIndex === 1 ? 'none' : 'auto'}
        >
          <ButtonGroup
            buttons={['Best Matches First', 'Latest First']}
            selectedIndex={sortByIndex}
            onPress={setSortByIndex_}
            secondary={true}
            containerStyle={{
              flexGrow: 1,
              marginLeft: 20,
              marginRight: 20,
            }}
          />
        </Animated.View>
      </>
    );
  };

  const renderItem = useCallback((x: ListRenderItemInfo<Conversation>) => {
    if (sectionIndex === 0 && !showArchive) {
      return <IntrosItemMemo
        wasRead={x.item.lastMessageRead}
        name={x.item.name}
        personId={x.item.personId}
        imageUuid={x.item.imageUuid}
        matchPercentage={x.item.matchPercentage}
        lastMessage={x.item.lastMessage}
        lastMessageTimestamp={x.item.lastMessageTimestamp}
        isAvailableUser={x.item.isAvailableUser}
      />
    } else {
      return <ChatsItemMemo
        wasRead={x.item.lastMessageRead}
        name={x.item.name}
        personId={x.item.personId}
        imageUuid={x.item.imageUuid}
        matchPercentage={x.item.matchPercentage}
        lastMessage={x.item.lastMessage}
        lastMessageTimestamp={x.item.lastMessageTimestamp}
        isAvailableUser={x.item.isAvailableUser}
      />
    }
  }, [sectionIndex, showArchive]);

  return (
    <>
      <TopNavBar>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          {'Inbox' + (showArchive ? ' (Archive)' : '')}
        </DefaultText>
        <TopNavBarButton
          onPress={onPressArchiveButton}
          iconName={showArchive ? 'chatbubbles-outline' : 'file-tray-full-outline'}
          style={{right: 15}}
        />
      </TopNavBar>
      {inbox === null &&
        <View style={{height: '100%', justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {inbox !== null &&
        <DefaultFlatList
          ref={listRef}
          emptyText={
            sectionIndex === 0 ?
            `No${showArchive ? ' archived ' : ' '}intros to show`:
            `No${showArchive ? ' archived ' : ' '}chats to show`}
          endText={
            `No more${showArchive ? ' archived ' : ' '}messages to show`
          }
          endTextStyle={{
            marginRight: 5,
          }}
          fetchPage={sectionIndex === 0 ? fetchIntrosPage : fetchChatsPage}
          dataKey={String(sectionIndex)}
          ListHeaderComponent={ListHeaderComponent}
          renderItem={renderItem}
          disableRefresh={true}
        />
      }
    </>
  );
};

export default InboxTab;
