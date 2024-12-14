import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TopNavBar } from './top-nav-bar';
import { SpeechBubble } from './speech-bubble';
import { DefaultText } from './default-text';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import {
  Message,
  MessageStatus,
  fetchConversation,
  markDisplayed,
  onReceiveMessage,
  refreshInbox,
  sendMessage,
} from '../xmpp/xmpp';
import {
  IMAGES_URL,
} from '../env/env';
import { getRandomString } from '../random/string';
import { api } from '../api/api';
import { TopNavBarButton } from './top-nav-bar-button';
import { RotateCcw, Flag, X } from "react-native-feather";
import { setSkipped } from '../hide-and-block/hide-and-block';
import { delay, isMobile } from '../util/util';
import { ReportModalInitialData } from './report-modal';
import { listen, notify, lastEvent } from '../events/events';
import { Image, ImageBackground } from 'expo-image';
import * as StoreReview from 'expo-store-review';
import { askedForReviewBefore } from '../kv-storage/asked-for-review-before';


const propAt = (messages: Message[] | null | undefined, index: number, prop: string): string => {
  if (!messages) return '';

  const message = messages[index];

  if (!message) return '';

  return message[prop] ?? '';
};

const lastPropAt = (messages: Message[] | null | undefined, prop: string): string => {
  return propAt(messages, (messages ?? []).length - 1, prop);
}

const maybeRequestReview = async (delayMs: number = 0) => {
  if (await StoreReview.hasAction() && !await askedForReviewBefore()) {
    await delay(delayMs);
    await StoreReview.requestReview();
  }
};

const Menu = ({navigation, name, personId, personUuid, closeFn}) => {
  const [isSkipped, setIsSkipped] = useState<boolean | undefined>();
  const [isUpdating, setIsUpdating] = useState(false);

  const isLoading = (
    isSkipped === undefined ||
    name === undefined ||
    personId === undefined);

  const onPressSkip = useCallback(async () => {
    if (isSkipped === undefined) {
      return;
    }

    setIsUpdating(true);
    const nextHiddenState = !isSkipped;
    if (await setSkipped(personId, personUuid, nextHiddenState)) {
      setIsSkipped(nextHiddenState);
      setIsUpdating(false);
      closeFn();
      if (nextHiddenState) {
        navigation.popToTop();
      } else {
        refreshInbox();
      }
    }
  }, [navigation, personId, isSkipped, closeFn]);

  const onPressReport = useCallback(async () => {
    closeFn();

    const data: ReportModalInitialData = {
      name,
      personId,
      personUuid,
      context: 'Conversation Screen'
    };

    notify('open-report-modal', data);
  }, [name, personId, closeFn]);

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
        shadowOffset: {
          width: 0,
          height: 3,
        },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
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

  // There's a bug in React Native which causes `overflow: hidden` to be
  // ignored when zIndex or elevation are set.
  const menuWorkaround = showMenu && Platform.OS === 'android' ? {
    elevation: undefined,
    zIndex: undefined,
  } : {};

  return (
    <TopNavBar containerStyle={menuWorkaround} >
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
        <Image
          key={imageUuid}
          source={imageUuid && {uri: `${IMAGES_URL}/450-${imageUuid}.jpg`}}
          placeholder={imageBlurhash && { blurhash: imageBlurhash }}
          transition={150}
          style={{
            width: 30,
            height: 30,
            borderRadius: 9999,
          }}
        />
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
          personId={personId}
          personUuid={personUuid}
          closeFn={() => setShowMenu(false)}
        />
      }
    </TopNavBar>
  );
};

const ConversationScreen = ({navigation, route}) => {
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  const [isOnline, setIsOnline] = useState(lastEvent('xmpp-is-online') ?? false);

  const [messageFetchTimeout, setMessageFetchTimeout] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [lastMessageStatus, setLastMessageStatus] = useState<
    MessageStatus | null
  >(null);
  const hasScrolled = useRef(false);
  const hasFetchedAll = useRef(false);
  const hasFinishedFirstLoad = useRef(false);
  const isFetchingNextPage = useRef(false);
  const [isFocused, setIsFocused] = useState(true);

  const personId: number = route?.params?.personId;
  const personUuid: string = route?.params?.personUuid;
  const name: string = route?.params?.name;
  const imageUuid: string = route?.params?.imageUuid;
  const imageBlurhash: string = route?.params?.imageBlurhash;
  const isAvailableUser: boolean = route?.params?.isAvailableUser ?? true;
  const lastMessage = (messages && messages.length) ?
    messages[messages.length - 1] :
    null;

  const listRef = useRef<ScrollView>(null);

  const onPressSend = useCallback(async (text: string): Promise<MessageStatus> => {
    const message: Message = {
      text: text,
      from: '',
      to: '',
      id: getRandomString(40),
      timestamp: new Date(),
      fromCurrentUser: true,
    };

    setLastMessageStatus(null);

    const messageStatus = await sendMessage(personUuid, message.text);

    if (messageStatus === 'sent') {
      hasScrolled.current = false;
      setMessages(messages => [...(messages ?? []), message]);
    }

    if (
      messageStatus === 'sent' &&
      text.toLowerCase().includes('hahaha') &&
      messages &&
      messages.length > 40
    ) {
      maybeRequestReview(1000);
    }

    setLastMessageStatus(messageStatus);

    return messageStatus;
  }, [personId, messages]);

  const maybeLoadNextPage = useCallback(async () => {
    if (hasFetchedAll.current) {
      return;
    }

    if (isFetchingNextPage.current) {
      return;
    }
    isFetchingNextPage.current = true;

    const fetchedMessages = await fetchConversation(
      personUuid || String(personId),
      propAt(messages, 0, 'mamId')
    );

    isFetchingNextPage.current = false;

    setMessageFetchTimeout(fetchedMessages === 'timeout');
    if (fetchedMessages !== 'timeout') {
      // Prevents the list from moving up to the newly added speech bubbles and
      // triggering another fetch
      if (listRef.current) listRef.current.scrollTo({y: 2, animated: false});

      setMessages([...(fetchedMessages ?? []), ...(messages ?? [])]);

      hasFetchedAll.current = !(fetchedMessages && fetchedMessages.length);
    }
  }, [messages]);

  const _onReceiveMessage = useCallback((msg) => {
    hasScrolled.current = false;
    setMessages(msgs => [...(msgs ?? []), msg]);
  }, []);

  const isCloseToTop = ({contentOffset}) => contentOffset.y < 1;

  const isAtBottom = ({layoutMeasurement, contentOffset, contentSize}) => {
    const epsilon = 1;

    return Math.abs(
      layoutMeasurement.height + contentOffset.y -
      contentSize.height
    ) >= epsilon;
  };

  const onScroll = useCallback(({nativeEvent}) => {
    if (isCloseToTop(nativeEvent) && hasFinishedFirstLoad.current) {
      maybeLoadNextPage();
    }

    if (messages !== null && isAtBottom(nativeEvent)) {
      hasFinishedFirstLoad.current = true;
    }
  }, [maybeLoadNextPage]);

  const markLastMessageRead = useCallback(async () => {
    if (!lastMessage) {
      return;
    }

    await markDisplayed(lastMessage);
  }, [lastMessage]);

  useEffect(() => {
    return listen(`skip-profile-${personId}`, () => {
      navigation.popToTop();
    });
  }, [navigation, personId]);

  // Fetch the first page of messages when the conversation is first opened
  // while online
  const fetchFirstPage = useCallback(async (personUuid, personId) => {
    const fetchedMessages = await fetchConversation(
      personUuid || String(personId)
    );

    setMessageFetchTimeout(fetchedMessages === 'timeout');

    if (fetchedMessages === 'timeout') {
      return;
    }

    if (fetchedMessages === undefined) {
      return;
    }

    setMessages((messages) => {
      const lastIdOfPage = lastPropAt(fetchedMessages, 'id');
      const lastIdOfConversation = lastPropAt(messages, 'id');

      if (messages === null || lastIdOfPage !== lastIdOfConversation) {
        return fetchedMessages;
      } else {
        return messages;
      }
    });

  }, [messages]);

  useEffect(() => {
    const onChangeAppState = (state: AppStateStatus) => {
      setIsActive(state === 'active');
    };

    const subscription = AppState.addEventListener('change', onChangeAppState);

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return listen('xmpp-is-online', setIsOnline);
  }, []);

  useEffect(() => {
    // If the user navigates to the conversation screen via a deep link, but the
    // conversation screen was already open on a conversation with a different
    // person, then the screen should be cleared.
    setMessageFetchTimeout(false);
    setMessages(null);
    setLastMessageStatus(null);
  }, [personUuid, personId]);

  useEffect(() => {
    if (isActive && isOnline) {
      fetchFirstPage(personUuid, personId)
    }
  }, [personUuid, personId, isActive && isOnline]);

  // Scroll to end when last message changes
  useEffect(() => {
    (async () => {
      await delay(500);
      if (listRef.current) {
        listRef.current.scrollToEnd({animated: true});
      }
    })();
  }, [lastMessage?.id]);


  // Listen for new messages
  useEffect(() => {
    return onReceiveMessage(_onReceiveMessage, personUuid, isFocused);
  }, [
    onReceiveMessage,
    _onReceiveMessage,
    personUuid,
    isFocused,
  ]);

  if (Platform.OS === 'web') {
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
      {messages === null &&
        <View style={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {messages !== null &&
        <ScrollView
          ref={listRef}
          onScroll={onScroll}
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
            ...(messages.length === 0 ? {
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
            } : {}),
          }}
        >
          {messages.length === 0 &&
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
          {messages.length > 0 && messages.map((x) =>
            <SpeechBubble
              key={x.id}
              fromCurrentUser={x.fromCurrentUser}
              timestamp={x.timestamp}
              text={x.text}
              imageUuid={x.fromCurrentUser ? null : imageUuid}
            />
          )}
        </ScrollView>
      }
      <DefaultText
        style={{
          maxWidth: 600,
          width: '100%',
          alignSelf: 'center',
          textAlign: 'center',
          paddingLeft: 5,
          paddingRight: 5,
          opacity: lastMessageStatus === 'sent' || lastMessageStatus === null ? 0 : 1,
          color: lastMessageStatus === 'timeout' ? 'red' : '#70f',
          ...(lastMessageStatus === 'timeout' ? {} : { fontFamily: 'Trueno' }),
        }}
      >
        {lastMessageStatus === 'timeout' ?  "Message not delivered. Are you online?" : '' }
        {lastMessageStatus === 'spam' ?  `We think that might be spam. Try sending ${name} a different message...` : '' }
        {lastMessageStatus === 'offensive' ?  `Intros can’t be too rude. Try sending ${name} a different message...` : '' }
        {lastMessageStatus === 'blocked' ?  name + ' is unavailable right now. Try messaging someone else!' : '' }
        {lastMessageStatus === 'not unique' ? `Someone already sent that intro! Try sending ${name} a different message...` : '' }
        {lastMessageStatus === 'too long' ? 'That message is too big! 😩' : '' }
      </DefaultText>
      {isAvailableUser &&
        <TextInputWithButton onPress={onPressSend}/>
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

const TextInputWithButton = ({
  onPress,
}: {
  onPress: (text: string) => Promise<MessageStatus>,
}) => {
  const { height } = useWindowDimensions();

  const opacity = useRef(new Animated.Value(1)).current;
  const [isLoading, setIsLoading] = useState(false);

  const fadeIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0.5,
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, []);

  const [text, setText] = useState("");

  const maybeSetText = useCallback((t: string) => {
    if (!isLoading) {
      setText(t);
    }
  }, [isLoading]);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed) {
      setIsLoading(true);
      const messageStatus = await onPress(trimmed);
      if (messageStatus === 'sent') {
        setText("");
      }
      setIsLoading(false);
    }
  }, [text]);

  const onKeyPress = useCallback((e) => {
    if (
      !isMobile() &&
      e.key === 'Enter' &&
      (e.ctrlKey || e.altKey)
    ) {
      e.preventDefault();
      setText((text) => text + "\n");
    } else if (
      !isMobile() &&
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.keyboardAvoidingView}
      enabled={Platform.OS === 'ios'}
    >
      <TextInput
        style={[
          styles.textInput,
          { maxHeight: height * 0.4 },
        ]}
        value={text}
        onChangeText={maybeSetText}
        onKeyPress={onKeyPress}
        placeholder="Type a message"
        placeholderTextColor="#888888"
        multiline={true}
      />
      <View
        style={{
          width: 50,
          marginLeft: 0,
          margin: 10,
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
        }}
      >
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
          }}
        >
          <Pressable
            style={{
              height: '100%',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPressIn={fadeIn}
            onPressOut={fadeOut}
            onPress={sendMessage}
          >
            <Animated.View
              style={{
                height: '100%',
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgb(228, 204, 255)',
                borderRadius: 999,
                opacity: opacity,
              }}
            >
              {isLoading &&
                <ActivityIndicator size="small" color="#70f" />
              }
              {!isLoading &&
                <FontAwesomeIcon
                  icon={faPaperPlane}
                  size={20}
                  color="#70f"
                  style={{
                    marginRight: 5,
                    marginBottom: 5,
                  }}
                />
              }
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  },
  keyboardAvoidingView: {
    flexDirection: 'row',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  textInput: {
    textAlignVertical: 'top',
    backgroundColor: '#eeeeee',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    flex: 1,
    flexGrow: 1,
    margin: 10,
    marginRight: 5,
  }
});

export {
  ConversationScreen
};
