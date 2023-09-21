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
import { InboxItem } from './inbox-item';
import { DefaultText } from './default-text';
import { ButtonGroup } from './button-group';
import { Notice } from './notice';
import { OptionScreen } from './option-screen';
import { hideMeFromStrangersOptionGroup } from '../data/option-groups';
import { DefaultFlatList } from './default-flat-list';
import { Inbox, Conversation, observeInbox } from '../xmpp/xmpp';

// TODO: Blocking people should remove them from each others' inboxes

const Stack = createNativeStackNavigator();

const InboxItemMemo = memo(InboxItem);

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
  const listRef = useRef<any>(undefined);

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


  useEffect(() => observeInbox(setInbox), []);
  useEffect(
    () => void listRef.current?.refresh && listRef.current.refresh(),
    [listRef.current?.refresh, sectionIndex]
  );
  useEffect(
    () => void listRef.current?.refresh && listRef.current.refresh(),
    [listRef.current?.refresh, sortByIndex]
  );
  useEffect(
    () => void listRef.current?.refresh && listRef.current.refresh(),
    [listRef.current?.refresh, inbox]
  );

  const fetchInboxPage = (
    sectionName: 'chats' | 'intros'
  ) => async (
    n: number
  ): Promise<Conversation[]> => {
    if (inbox === null) {
      return [];
    }

    const section = sectionName === 'chats' ? inbox.chats : inbox.intros;

    const a = section.conversations[0];


    const pageSize = 10;
    const page = [...section.conversations]
      .sort((a, b) => {
        if (
          sectionName === 'intros' &&
          sortByIndex === 1 &&
          a.matchPercentage !== b.matchPercentage
        ) {
          return b.matchPercentage - a.matchPercentage
        } else {
          return +b.lastMessageTimestamp - +a.lastMessageTimestamp
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
            'Intros' + (inbox?.intros?.numUnread ? ` (${inbox.intros.numUnread})` : ''),
            'Chats'  + (inbox?.chats?.numUnread  ? ` (${inbox.chats.numUnread})`  : ''),
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
            buttons={['Latest First', 'Best Matches First']}
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
        {!isTooManyTapped && sectionIndex === 0 && inbox && inbox.intros.numUnread >= 5 &&
          <Notice
            onPress={onPressTooMany}
            style={{
              marginBottom: 5,
            }}
          >
            <DefaultText style={{color: '#70f', textAlign: 'center'}} >
              Getting too many intros? You can keep your profile hidden and
              message first instead 🕵️. Press here to change your privacy
              settings.
            </DefaultText>
          </Notice>
        }
      </>
    );
  };

  const renderItem = useCallback((x: ListRenderItemInfo<Conversation>) => (
    <InboxItemMemo
      wasRead={x.item.lastMessageRead}
      name={x.item.name}
      personId={x.item.personId}
      imageUuid={x.item.imageUuid}
      matchPercentage={x.item.matchPercentage}
      lastMessage={x.item.lastMessage}
      lastMessageTimestamp={x.item.lastMessageTimestamp}
      isDeletedUser={x.item.isDeletedUser}
    />
  ), []);

  return (
    <>
      <TopNavBar>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          Inbox
        </DefaultText>
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
            "No intros to show":
            "No chats to show"}
          endText="No more messages to show"
          endTextStyle={{
            marginRight: 5,
          }}
          fetchPage={sectionIndex === 0 ? fetchIntrosPage : fetchChatsPage}
          dataKey={String(sectionIndex)}
          ListHeaderComponent={ListHeaderComponent}
          renderItem={renderItem}
        />
      }
    </>
  );
};

export default InboxTab;
