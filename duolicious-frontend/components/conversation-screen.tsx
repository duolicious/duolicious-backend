import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
  SafeAreaView,
  StyleSheet,
  KeyboardAvoidingView,
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
import { listen, notify } from '../events/events';

const Menu = ({navigation, name, personId, personUuid, messages, closeFn}) => {
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
  }, [name, personId, messages, closeFn]);

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

const ConversationScreen = ({navigation, route}) => {
  const [showMenu, setShowMenu] = useState(false);
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
  const imageUuid: number = route?.params?.imageUuid;
  const isAvailableUser: boolean = route?.params?.isAvailableUser ?? true;
  const lastMessage = (messages && messages.length) ?
    messages[messages.length - 1] :
    null;

  const listRef = useRef<ScrollView>(null)

  const lastMamId = (() => {
    if (!messages) return '';
    if (!messages.length) return '';

    const mamId = messages[0].mamId;

    if (!mamId) return '';

    return mamId;
  })();

  const onPressSend = useCallback(async (text: string): Promise<MessageStatus> => {
    const isFirstMessage = messages === null || messages.length === 0;

    const message: Message = {
      text: text,
      from: '',
      to: '',
      id: getRandomString(40),
      timestamp: new Date(),
      fromCurrentUser: true,
    };

    setLastMessageStatus(null);

    const messageStatus = await sendMessage(
      personUuid,
      message.text,
      isFirstMessage,
    );

    if (messageStatus === 'sent') {
      hasScrolled.current = false;
      setMessages(messages => [...(messages ?? []), message]);
    }

    setLastMessageStatus(messageStatus);

    return messageStatus;
  }, [personId, messages]);

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

  const maybeLoadNextPage = useCallback(async () => {
    if (hasFetchedAll.current) {
      return;
    }

    if (isFetchingNextPage.current) {
      return;
    }
    isFetchingNextPage.current = true;

    const fetchedMessages = await fetchConversation(personUuid, lastMamId);

    isFetchingNextPage.current = false;

    setMessageFetchTimeout(fetchedMessages === 'timeout');
    if (fetchedMessages !== 'timeout') {
      // Prevents the list from moving up to the newly added speech bubbles and
      // triggering another fetch
      if (listRef.current) listRef.current.scrollTo({y: 1, animated: false});

      setMessages([...(fetchedMessages ?? []), ...(messages ?? [])]);

      hasFetchedAll.current = !(fetchedMessages && fetchedMessages.length);
    }
  }, [messages, lastMamId]);

  const _onReceiveMessage = useCallback((msg) => {
    hasScrolled.current = false;
    setMessages(msgs => [...(msgs ?? []), msg]);
  }, []);

  const isCloseToTop = ({contentOffset}) => contentOffset.y === 0;

  const isAtBottom = ({layoutMeasurement, contentOffset, contentSize}) =>
    layoutMeasurement.height + contentOffset.y >= contentSize.height;

  const onScroll = useCallback(({nativeEvent}) => {
    if (isCloseToTop(nativeEvent) && hasFinishedFirstLoad.current) {
      maybeLoadNextPage();
    }

    if (messages !== null && isAtBottom(nativeEvent)) {
      hasFinishedFirstLoad.current = true;
    }
  }, [maybeLoadNextPage]);

  const toggleMenu = useCallback(() => {
    setShowMenu(x => !x);
  }, []);

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

  // Fetch the first page of messages when the conversation first loads
  useEffect(() => {
    fetchConversation(personUuid, lastMamId)
      .then((fetchedMessages) => {
        if (fetchedMessages === 'timeout') {
          setMessageFetchTimeout(true);
        } else {
          setMessages(fetchedMessages ?? []);
        }
      });
  }, []);

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
      <TopNavBar>
        <TopNavBarButton
          onPress={() => navigation.goBack()}
          iconName="arrow-back"
          style={{left: 15}}
        />
        <Pressable
          onPress={onPressName}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Image
            source={imageUuid && {uri: `${IMAGES_URL}/450-${imageUuid}.jpg`}}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              position: 'absolute',
              left: -40,
              top: -3,
            }}
          />
          <DefaultText
            style={{
              fontWeight: '700',
              fontSize: 20,
            }}
          >
            {name ?? '...'}
          </DefaultText>
        </Pressable>
        {isAvailableUser &&
          <TopNavBarButton
            onPress={toggleMenu}
            iconName="ellipsis-vertical"
            style={{right: 10}}
          />
        }
        {showMenu &&
          <Menu
            navigation={navigation}
            name={name}
            personId={personId}
            personUuid={personUuid}
            messages={(messages ?? []).slice(-10)}
            closeFn={() => setShowMenu(false)}
          />
        }
      </TopNavBar>
      {messages === null && !messageFetchTimeout &&
        <View style={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {messages === null && messageFetchTimeout &&
        <View style={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
          <DefaultText
            style={{fontFamily: 'Trueno'}}
          >
            You’re offline
          </DefaultText>
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
                source={imageUuid && {uri: `${IMAGES_URL}/450-${imageUuid}.jpg`}}
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
            >
              {x.text}
            </SpeechBubble>
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
        {lastMessageStatus === 'blocked' ?  name + ' is unavailable right now. Try messaging someone else!' : '' }
        {lastMessageStatus === 'not unique' ? `Someone already sent that intro! Try sending ${name} a different message...` : '' }
        {lastMessageStatus === 'too long' ? 'That message is too big! 😩' : '' }
      </DefaultText>
      {!messageFetchTimeout && isAvailableUser &&
        <TextInputWithButton onPress={onPressSend}/>
      }
      {!messageFetchTimeout && !isAvailableUser &&
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
      style={{
        flexDirection: 'row',
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
      }}
      enabled={Platform.OS === 'ios'}
    >
      <TextInput
        style={{
          textAlignVertical: 'top',
          backgroundColor: '#eeeeee',
          borderRadius: 10,
          padding: 10,
          fontSize: 16,
          flex: 1,
          flexGrow: 1,
          margin: 10,
          marginRight: 5,
        }}
        readOnly={isLoading}
        value={text}
        onChangeText={setText}
        onKeyPress={onKeyPress}
        placeholder="Type a message"
        placeholderTextColor="#888888"
        multiline={true}
        numberOfLines={2}
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
                <ActivityIndicator size="large" color="#70f" />
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
  }
});

export {
  ConversationScreen
};
