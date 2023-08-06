import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  ListRenderItemInfo,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
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
import { DefaultFlatList } from './default-flat-list';
import {
  Inbox,
  Message,
  MessageStatus,
  fetchConversation,
  onReceiveMessage,
  sendMessage,
  setInbox,
} from '../xmpp/xmpp';
import {
  IMAGES_URL,
} from '../env/env';
import { getRandomString } from '../random/string';

// TODO: Re-add the ability to load old messages past the first page

const ConversationScreen = ({navigation, route}) => {
  const [messageFetchTimeout, setMessageFetchTimeout] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [lastMessageStatus, setLastMessageStatus] = useState<
    MessageStatus | null
  >(null);

  const personId: number = route?.params?.personId;
  const name: string = route?.params?.name;
  const imageUuid: number = route?.params?.imageUuid;

  const listRef = useRef<any>(null)

  const scrollToEnd = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToEnd({animated: true});
    }
  }, [listRef.current]);

  const onPressSend = useCallback(async (text: string): Promise<MessageStatus> => {
    const message: Message = {
      text: text,
      from: '',
      to: '',
      id: getRandomString(40),
      fromCurrentUser: true,
    };
    setLastMessageStatus(null);
    const messageStatus = await sendMessage(
      personId,
      message.text,
      messages === null || messages.length === 0
    );
    if (messageStatus === 'sent') {
      setMessages(messages => [...(messages ?? []), message]);
    }
    setLastMessageStatus(messageStatus);
    return messageStatus;
  }, [personId, messages]);

  const _fetchConversation = useCallback(async () => {
    const _messages = await fetchConversation(personId);
    setMessageFetchTimeout(_messages === 'timeout');
    if (_messages !== 'timeout') {
      setMessages(existingMessages =>
        [...(existingMessages ?? []), ...(_messages ?? [])]
      );
    }
  }, []);

  const _onReceiveMessage = useCallback(
    (msg) => setMessages(msgs => [...(msgs ?? []), msg]),
    []
  );

  useEffect(() => {
    _fetchConversation();

    return onReceiveMessage(_onReceiveMessage, personId);
  }, [_onReceiveMessage, personId]);

  return (
    <>
      <TopNavBar>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            zIndex: 999,
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '100%',
            aspectRatio: 1,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 10,
          }}
        >
          <Ionicons
            style={{
              fontSize: 20,
            }}
            name="arrow-back"
          />
        </Pressable>
        <View
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
        </View>
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
            You're offline
          </DefaultText>
        </View>
      }
      {messages !== null && messages.length === 0 &&
        <View style={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'center',
        }}>
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
        </View>
      }
      {messages !== null && messages.length > 0 &&
        <ScrollView
          ref={listRef}
          onLayout={scrollToEnd}
          onContentSizeChange={scrollToEnd}
          contentContainerStyle={{
            paddingTop: 10,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {messages.map((x) =>
            <SpeechBubble
              key={x.id}
              fromCurrentUser={x.fromCurrentUser}
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
          opacity: lastMessageStatus === 'sent' || lastMessageStatus === null ? 0 : 1,
          color: lastMessageStatus === 'timeout' ? 'red' : '#70f',
          ...(lastMessageStatus === 'timeout' ? {} : { fontFamily: 'Trueno' }),
        }}
      >
        {lastMessageStatus === 'timeout' ?
          "Message not delivered. Are you online?" :
          "Someone already used that intro! Try again!"
        }
      </DefaultText>
      {!messageFetchTimeout &&
        <TextInputWithButton onPress={onPressSend}/>
      }
    </>
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
    if (e.key === 'Enter' && !e.shiftKey && !e.controlKey && !e.altKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 10,
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
      }}
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
        }}
      >
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            position: 'absolute',
            bottom: 0,
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
    </View>
  );
};

export {
  ConversationScreen
};
