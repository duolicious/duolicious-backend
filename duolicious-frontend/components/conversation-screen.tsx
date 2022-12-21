import {
  Animated,
  Image,
  Pressable,
  ScrollView,
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

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

type Message = {
  text: string;
  fromCurrentUser: boolean;
  state?: "Read" | "Delivered"
};

const messages: Message[] = [
  {text: "hey bb, do u want fuk? 😊", fromCurrentUser: false},
  {text:
    "Certainly, my good fellow! I, indeed, would like what you colloquially " +
    "refer to as \"fuk\". For clarity, I would like to engage with sexual " +
    "intercourse with you, for this is a dating site! And that's what we " +
    "good men on dating sites do! Yes indeed! ",
    fromCurrentUser: true
  },
  {
    text: "ur place or mine? 😊",
    fromCurrentUser: true
  },
  {
    text: "Let us perform the act in public!",
    fromCurrentUser: true,
  },
  {text: "omggosshh",
  fromCurrentUser: false
  },
  {
    text: "ur a sicko !",
    fromCurrentUser: false
  },
  {text: "blocked!",
    fromCurrentUser: false
  },
  {
    text: 
      "My good man, please do not block me! I must confess that I am " +
      "currently on the brink of suicide. I am taking several quite strong " +
      "anti-depressants and my dog has a rare form of cancer. " +
      "\n\n" +
      "My penis is a paltry 4.5 inches. What is arguably saddest about this " +
      "is that I have measured its length using the imperial system. I know " +
      "that ending it all would be kindest on *me*, but sometimes I wonder if " +
      "ending it all would be kindest on others too. What keeps me alive is " +
      "the hope that my presence may be a burden towards others. I hate " +
      "others even more than I hate myself. The thought that my existence may " +
      "trouble others emboldens me to get out of bed. ",
    fromCurrentUser: true
  },
  {text: 
    "ur so weird, but ur pics are cute. Hm.",
    fromCurrentUser: false,
  },
  {text: 
    "fuck it. meet you in the park near the lake 😊",
    fromCurrentUser: false,
  },
  {
    text: "hoorah",
    fromCurrentUser: true,
    // state: "Read"
  },
];

// TODO
const delay = async (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fetchPage = async (n: number): Promise<Message[]> => {
  await delay(500);

  if (n <= 0)
    return [];

  return messages;
};

const ConversationScreen = ({navigation}) => {
  const listRef = useRef(null);

  const onPressSend = useCallback((text: string) => {
    const message: Message = {
      text: text,
      fromCurrentUser: true,
    };
    listRef.current.append(message);
  }, []);

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
            source={{uri: `https://randomuser.me/api/portraits/men/${getRandomInt(99)}.jpg`}}
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
            Rahim
          </DefaultText>
        </View>
      </TopNavBar>
      <DefaultFlatList
        innerRef={listRef}
        emptyText="This is the start of your conversation with Rahim."
        fetchPage={fetchPage}
        renderItem={(x) =>
          <SpeechBubble
            fromCurrentUser={x.item.fromCurrentUser}
            state={x.item.state}
          >
            {x.item.text}
          </SpeechBubble>
        }
        disableRefresh={true}
        inverted={true}
        firstPage={10}
      />
      <TextInputWithButton onPress={onPressSend}/>
    </>
  );
};

const TextInputWithButton = ({onPress}) => {
  const opacity = useRef(new Animated.Value(1)).current;

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

  const sendMessage = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed) {
      onPress(trimmed)
      setText("");
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
                paddingRight: 5,
                paddingBottom: 5,
              }}
            >
              <FontAwesomeIcon
                icon={faPaperPlane}
                size={20}
                color="#70f"
              />
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
