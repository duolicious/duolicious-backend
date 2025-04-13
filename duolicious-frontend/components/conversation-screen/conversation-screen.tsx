import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TopNavBar } from '../top-nav-bar';
import { SpeechBubble, TypingSpeechBubble } from './speech-bubble';
import { DefaultText } from '../default-text';
import {
  Message,
  markDisplayed,
} from '../../chat/application-layer';
import {
  fetchConversationAndNotify,
  getMessage,
  onReceiveMessageAndNotify,
  sendMessageAndNotify,
} from '../../chat/application-layer/hooks/message'
import {
  IMAGES_URL,
} from '../../env/env';
import { api } from '../../api/api';
import { TopNavBarButton } from '../top-nav-bar-button';
import { RotateCcw, Flag, X } from "react-native-feather";
import { setSkipped } from '../../hide-and-block/hide-and-block';
import { delay, getDuplicates } from '../../util/util';
import { ReportModalInitialData } from '../modal/report-modal';
import { listen, notify } from '../../events/events';
import { ImageBackground } from 'expo-image';
import * as StoreReview from 'expo-store-review';
import { askedForReviewBefore } from '../../kv-storage/asked-for-review-before';
import { MessageDivider }  from '../message-divider';
import { ONLINE_COLOR } from '../../constants/constants';
import { useOnline } from '../../chat/application-layer/hooks/online';
import * as _ from 'lodash';
import { Input } from './input';
import { GifPickedEvent } from '../../components/modal/gif-picker-modal';

const firstMamId = (messageIds: string[] | null): string => {
  if (!messageIds) {
    return ''
  }

  if (!messageIds.length) {
    return ''
  }

  const firstMessageId = messageIds[0];

  const message = getMessage(firstMessageId);

  if (!message) {
    return '';
  }

  if (message.message.type === 'chat-text') {
    return message.message.mamId ?? '';
  } else if (message.message.type === 'chat-audio') {
    return message.message.mamId ?? '';
  }

  return '';
};

const maybeRequestReview = async (delayMs: number = 0) => {
  if (await StoreReview.hasAction() && !await askedForReviewBefore()) {
    await delay(delayMs);
    await StoreReview.requestReview();
  }
};


const Menu = ({navigation, name, personUuid, closeFn}) => {
  const [isSkipped, setIsSkipped] = useState<boolean | undefined>();
  const [isUpdating, setIsUpdating] = useState(false);

  const isLoading = (
    isSkipped === undefined ||
    name === undefined);

  const onPressSkip = useCallback(async () => {
    if (isSkipped === undefined) {
      return;
    }

    setIsUpdating(true);
    const nextHiddenState = !isSkipped;
    if (await setSkipped(personUuid, nextHiddenState)) {
      setIsSkipped(nextHiddenState);
      setIsUpdating(false);
      closeFn();
      if (nextHiddenState) {
        navigation.popToTop();
      }
    }
  }, [navigation, isSkipped, closeFn]);

  const onPressReport = useCallback(async () => {
    closeFn();

    const data: ReportModalInitialData = {
      name,
      personUuid,
      context: 'Conversation Screen'
    };

    notify('open-report-modal', data);
  }, [name, closeFn]);

  useEffect(() => {
    (async () => {
      const response = await api('get', `/prospect-profile/${personUuid}`);
      if (response.ok) {
        setIsSkipped(response.json.is_skipped);
      }
    })();
  }, [personUuid]);

  const pressableStyle: ViewStyle = {
    flexDirection: 'row',
    gap: 10,
  };

  const iconContainerStyle: ViewStyle = {
    flexGrow: 1,
  };

  const iconStyle = {
    backgroundColor: isLoading ? '#ddd' : 'transparent',
    borderRadius: 3,
  };

  const labelContainerStyle: ViewStyle = {
    gap: 5,
    flexShrink: 1,
  };

  const labelStyle: TextStyle = {
    fontSize: 16,
    fontWeight: '600',
    color: isLoading ? '#ddd' : '#777',
    backgroundColor: isLoading ? '#ddd' : undefined,
    borderRadius: 3,
  };

  const subLabelStyle: TextStyle = {
    color: isLoading ? '#ddd' : '#aaa',
    backgroundColor: isLoading ? '#ddd' : undefined,
    borderRadius: 3,
  };

  const iconStroke = isLoading ? "transparent" : "black";

  const borderRadius = 10;

  return (
    <View
      style={{
        position: 'absolute',
        top: 45,
        right: 5,
        padding: 25,
        gap: 40,
        flexDirection: 'column',
        backgroundColor: 'white',
        borderRadius: borderRadius,
        borderWidth: 1,
        borderColor: '#999',
        zIndex: 999,
        overflow: 'visible',
        maxWidth: 350,
      }}
    >
      <Pressable style={pressableStyle} onPress={isLoading ? undefined : onPressSkip}>
        {isSkipped &&
          <View style={iconContainerStyle}>
            <RotateCcw
              style={iconStyle}
              stroke={iconStroke}
              strokeWidth={4}
              height={18}
              width={18}
            />
          </View>
        }
        {!isSkipped &&
          <View style={iconContainerStyle}>
            <X
              style={iconStyle}
              stroke={iconStroke}
              strokeWidth={4}
              height={18}
              width={18}
            />
          </View>
        }
        <View style={labelContainerStyle}>
          <DefaultText style={labelStyle}>
            {isSkipped ? 'Undo skip' : 'Skip'}
          </DefaultText>
          <DefaultText style={subLabelStyle}>
            {isSkipped ?
              'Moves the conversation out of your archive' :
              'Ends the conversation and moves it to your archive'
            }
          </DefaultText>
        </View>
      </Pressable>
      {!isSkipped &&
        <Pressable style={pressableStyle} onPress={isLoading ? undefined : onPressReport}>
          <View style={iconContainerStyle}>
            <Flag
              style={iconStyle}
              stroke={iconStroke}
              strokeWidth={3}
              height={18}
              width={18}
            />
          </View>
          <View style={labelContainerStyle}>
            <DefaultText style={labelStyle}>
              Report
            </DefaultText>
            <DefaultText style={subLabelStyle}>
              Ends the conversation, moves it to your archive, and notifies
              moderators
            </DefaultText>
          </View>
        </Pressable>
      }
      {isUpdating &&
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            borderRadius: 10,
          }}
        >
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
    </View>
  );
};

const ConversationScreenNavBar = ({
  navigation,
  personId,
  personUuid,
  isAvailableUser,
  imageUuid,
  imageBlurhash,
  name,
  isOnline,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const onPressName = useCallback(() => {
    if (isAvailableUser) {
      navigation.navigate(
        'Prospect Profile Screen',
        {
          screen: 'Prospect Profile',
          params: { personId, personUuid, showBottomButtons: false },
        }
      );
    }
  }, [isAvailableUser, personId, name]);

  const toggleMenu = useCallback(() => {
    setShowMenu(x => !x);
  }, []);

  const isOtherPersonOnline = useOnline(personUuid);

  return (
    <TopNavBar>
      <TopNavBarButton
        onPress={() => navigation.goBack()}
        iconName="arrow-back"
        position="left"
        secondary={true}
      />
      <Pressable
        onPress={onPressName}
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 220,
          overflow: 'visible',
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
          }}
        >
          <ImageBackground
            source={imageUuid && {
              uri: `${IMAGES_URL}/450-${imageUuid}.jpg`,
              height: 30,
              width: 30,
            }}
            placeholder={imageBlurhash && { blurhash: imageBlurhash }}
            transition={150}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              backgroundColor: imageUuid ? 'white' : '#f1e5ff',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            {!imageUuid &&
              <Ionicons
                style={{fontSize: 14, color: 'rgba(119, 0, 255, 0.2)'}}
                name={'person'}
              />
            }
          </ImageBackground>
          {isOtherPersonOnline && <>
            <View
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,

                borderRadius: 999,

                backgroundColor: 'white',
                justifyContent: 'center',
                alignItems: 'center',
                width: 16,
                height: 16,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                backgroundColor: ONLINE_COLOR,
                borderRadius: 999,
                width: 10,
                height: 10,
              }}
            />
          </>}
        </View>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
          numberOfLines={1}
        >
          {name ?? '...'}
        </DefaultText>
        <ActivityIndicator
          size="small"
          color="#70f"
          style={{
            opacity: isOnline ? 0 : 1,
          }}
        />
      </Pressable>
      {isAvailableUser &&
        <TopNavBarButton
          onPress={toggleMenu}
          iconName="ellipsis-vertical"
          position="right"
          secondary={true}
        />
      }
      {showMenu &&
        <Menu
          navigation={navigation}
          name={name}
          personUuid={personUuid}
          closeFn={() => setShowMenu(false)}
        />
      }
    </TopNavBar>
  );
};

const ConversationScreen = ({navigation, route}) => {
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const [isOnline, setIsOnline] = useState(false);

  const [messageIds, setMessageIds] = useState<string[] | null>(null);
  const hasFetchedAll = useRef(false);
  const hasFinishedFirstLoad = useRef(false);
  const isFetchingNextPage = useRef(false);
  const [isFocused, setIsFocused] = useState(true);

  const scrollOffsetRef = useRef(0);
  const layoutMeasurementRef = useRef({ height: 0 });

  const duplicatedMessageIds = getDuplicates(messageIds ?? []);

  const personId: number = route?.params?.personId;
  const personUuid: string = route?.params?.personUuid;
  const name: string = route?.params?.name;
  const imageUuid: string = route?.params?.imageUuid;
  const imageBlurhash: string = route?.params?.imageBlurhash;
  const isAvailableUser: boolean = route?.params?.isAvailableUser ?? true;

  const listRef = useRef<ScrollView>(null);

  const onPressSend = useCallback((messageBody: string): void => {
    const messageId = sendMessageAndNotify(
      personUuid,
      { type: 'chat-text', text: messageBody }
    );

    setMessageIds(messageIds => [...(messageIds ?? []), messageId]);

    if (
      messageBody.toLowerCase().includes('hahaha') &&
      messageIds &&
      messageIds.length > 40
    ) {
      maybeRequestReview(1000);
    }
  }, [personUuid, messageIds]);

  const onChange = useCallback(
    _.debounce(
      () => sendMessageAndNotify(personUuid, { type: 'typing' }),
      1000,
      {
        leading: true,
        trailing: false,
        maxWait: 1000,
      },
    ),
    [personUuid]
  );

  const onPressGif = useCallback(() => {
    notify('show-gif-picker');
  }, []);

  useEffect(() => {
    return listen<GifPickedEvent>('gif-picked', onPressSend);
  }, [onPressSend]);

  const onAudioComplete = useCallback((audioBase64: string) => {
    const messageId = sendMessageAndNotify(
      personUuid,
      { type: 'chat-audio', audioBase64 },
      { timeoutMs: 2 * 60 * 1000 }
    );

    setMessageIds(messageIds => [...(messageIds ?? []), messageId]);
  }, []);

  const onFocus = useCallback(async () => {
    if (listRef.current) {
      await delay(200);
      listRef.current.scrollToEnd({ animated: true });
    }
  }, []);

  const maybeLoadNextPage = useCallback(async () => {
    if (hasFetchedAll.current) {
      return;
    }

    if (isFetchingNextPage.current) {
      return;
    }
    isFetchingNextPage.current = true;

    const fetchedMessageIds = await fetchConversationAndNotify(
      personUuid,
      firstMamId(messageIds),
    );

    isFetchingNextPage.current = false;

    if (fetchedMessageIds !== 'timeout') {
      // Prevents the list from moving up to the newly added speech bubbles and
      // triggering another fetch
      if (listRef.current) listRef.current.scrollTo({ y: 2, animated: false });

      setMessageIds([...(fetchedMessageIds ?? []), ...(messageIds ?? [])]);

      hasFetchedAll.current = !(fetchedMessageIds && fetchedMessageIds.length);
    }
  }, [messageIds]);

  const isCloseToTop = ({contentOffset}) => contentOffset.y < 1;

  const isAtBottom = ({layoutMeasurement, contentOffset, contentSize}) => {
    const epsilon = 1;

    return Math.abs(
      layoutMeasurement.height + contentOffset.y -
      contentSize.height
    ) >= epsilon;
  };

  const onScroll = useCallback(({nativeEvent}) => {
    scrollOffsetRef.current = nativeEvent.contentOffset.y;
    layoutMeasurementRef.current = nativeEvent.layoutMeasurement;

    if (isCloseToTop(nativeEvent) && hasFinishedFirstLoad.current) {
      maybeLoadNextPage();
    }

    if (messageIds !== null && isAtBottom(nativeEvent)) {
      hasFinishedFirstLoad.current = true;
    }
  }, [maybeLoadNextPage]);

  const markLastMessageRead = useCallback(async () => {
    const lastMessageId = _.last(messageIds);

    if (!lastMessageId) {
      return;
    }

    const lastMessage = getMessage(lastMessageId);

    if (!lastMessage) {
      return;
    }

    if (lastMessage.message.type === 'typing') {
      return;
    }

    await markDisplayed(lastMessage.message);
  }, [_.last(messageIds)]);

  useEffect(() => {
    return listen(`skip-profile-${personUuid}`, () => {
      navigation.popToTop();
    });
  }, [navigation, personUuid]);

  // Fetch the first page of messages when the conversation is first opened
  // while online
  const fetchFirstPage = useCallback(async (personUuid) => {
    const fetchedMessageIds = await fetchConversationAndNotify(personUuid);

    if (fetchedMessageIds === 'timeout') {
      return;
    }

    setMessageIds((messageIds) => {
      const lastIdOfPage = _.last(fetchedMessageIds);

      if (
        messageIds === null ||
        lastIdOfPage && !messageIds.includes(lastIdOfPage)
      ) {
        return fetchedMessageIds;
      } else {
        return messageIds;
      }
    });

  }, []);

  useEffect(() => {
    const onChangeAppState = (state: AppStateStatus) => {
      setIsActive(state === 'active');
    };

    const subscription = AppState.addEventListener('change', onChangeAppState);

    return () => subscription.remove();
  }, []);

  useLayoutEffect(() => {
    return listen(
      'xmpp-is-online',
      (data) => setIsOnline(data ?? false),
      true,
    );
  }, []);

  useEffect(() => {
    // If the user navigates to the conversation screen via a deep link, but the
    // conversation screen was already open on a conversation with a different
    // person, then the screen should be cleared.
    setMessageIds(null);
  }, [personUuid, personId]);

  useEffect(() => {
    if (isActive && isOnline) {
      fetchFirstPage(personUuid)
    }
  }, [personUuid, isActive && isOnline]);

  // Scroll to end when last message changes
  useEffect(() => {
    (async () => {
      await delay(500);
      if (listRef.current) {
        listRef.current.scrollToEnd({ animated: true });
      }
    })();
  }, [_.last(messageIds)]);


  // Listen for new messages
  useEffect(() => {
    return onReceiveMessageAndNotify(
      (message: Message) => {
        if (message.type === 'chat-text' || message.type === 'chat-audio') {
          setMessageIds(messageIds => [...(messageIds ?? []), message.id]);
        }
      },
      personUuid,
      isFocused
    );
  }, [personUuid, isFocused]);

  if (Platform.OS === 'web') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const handleFocus = () => {
        markLastMessageRead();
        setIsFocused(true);
      };

      const handleBlur = () => {
        setIsFocused(false);
      };

      // Add event listeners
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      // Clean up
      return () => {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      };
    }, [markLastMessageRead]);
  }

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <ConversationScreenNavBar
        navigation={navigation}
        personId={personId}
        personUuid={personUuid}
        isAvailableUser={isAvailableUser}
        imageUuid={imageUuid}
        imageBlurhash={imageBlurhash}
        name={name}
        isOnline={isOnline}
      />
      {messageIds === null &&
        <View style={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {messageIds !== null &&
        <ScrollView
          ref={listRef}
          onScroll={onScroll}
          onContentSizeChange={(_, contentHeight) => {
            const distanceToBottom = (
              contentHeight - (
                scrollOffsetRef.current + layoutMeasurementRef.current.height
              )
            );

            if (listRef.current && distanceToBottom < 100) {
              listRef.current.scrollToEnd({ animated: true });
            }
          }}
          scrollEventThrottle={0}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0
          }}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: 20,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
            ...(messageIds.length === 0 ? {
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
            } : {}),
            gap: 10,
          }}
        >
          {messageIds.length === 0 &&
            <>
              <ImageBackground
                source={imageUuid && {
                  uri: `${IMAGES_URL}/450-${imageUuid}.jpg`,
                  height: 450,
                  width: 450,
                }}
                placeholder={imageBlurhash && { blurhash: imageBlurhash }}
                transition={150}
                style={{
                  height: 200,
                  width: 200,
                  margin: 2,
                  borderRadius: 999,
                  borderColor: 'white',
                  backgroundColor: imageUuid ? 'white' : '#f1e5ff',
                  overflow: 'hidden',
                  justifyContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}
              >
                {!imageUuid &&
                  <Ionicons
                    style={{fontSize: 40, color: 'rgba(119, 0, 255, 0.2)'}}
                    name={'person'}
                  />
                }
              </ImageBackground>
              <Text
                style={{
                  marginTop: 20,
                  marginBottom: 10,
                  fontFamily: 'Trueno',
                  textAlign: 'center',
                  marginLeft: '15%',
                  marginRight: '15%',
                }}
              >
                This is the start of your conversation with {name}
              </Text>
              <DefaultText
                style={{
                  textAlign: 'center',
                  marginLeft: '10%',
                  marginRight: '10%',
                }}
              >
                Intros on Duolicious have to be totally unique! Try
                asking {name} about something interesting on their profile...
              </DefaultText>
            </>
          }
          {messageIds.length > 0 && messageIds.map((messageId, i) => {
            const [previousMessage, message] = [
              getMessage(messageIds[i - 1]),
              getMessage(messageId)];

            // TODO: This is a workaround for the fact the server doesn't
            // enforce the uniqueness of message IDs (yet). Using XMPP was a
            // mistake.
            const key =
              duplicatedMessageIds.has(messageId)
                ? `${messageId}-${Math.random()}`
                : `${messageId}`;

            return (
              <Fragment key={key}>
                {previousMessage && message &&
                  <MessageDivider
                    previousMessage={previousMessage.message}
                    message={message.message}
                  />
                }
                <SpeechBubble
                  messageId={messageId}
                  name={name}
                  avatarUuid={imageUuid}
                />
              </Fragment>
            );
          })}
          <TypingSpeechBubble
            personUuid={personUuid}
            avatarUuid={imageUuid}
          />
        </ScrollView>
      }
      {isAvailableUser &&
        <Input
          onPressSend={onPressSend}
          onChange={onChange}
          onPressGif={onPressGif}
          onAudioComplete={onAudioComplete}
          onFocus={onFocus}
        />
      }
      {!isAvailableUser &&
        <DefaultText
          style={{
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
            textAlign: 'center',
            padding: 5,
            paddingTop: 10,
            paddingBottom: 10,
            backgroundColor: '#eee',
            fontFamily: 'Trueno',
          }}
        >
          This person isn't available right now. This often means their account
          is inactive or was deleted.
        </DefaultText>
      }
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  },
});

export {
  ConversationScreen
};
