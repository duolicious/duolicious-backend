import {
  useCallback,
  useState,
} from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import { longFriendlyTimestamp } from '../util/util';

type State = 'Read' | 'Delivered';

type Props = {
  fromCurrentUser: boolean,
  timestamp: Date,
  text: string,
};

const isEmojiOnly = (str: string) => {
  const emojiRegex = /^\p{Emoji_Presentation}+$/u;
  return emojiRegex.test(str);
}

const SpeechBubble = (props: Props) => {
  const [showTimestamp, setShowTimestamp] = useState(false);

  const onPress = useCallback(() => {
    setShowTimestamp(t => !t);
  }, [setShowTimestamp]);

  const backgroundColor = (() => {
    if (isEmojiOnly(props.text)) {
      return 'transparent';
    } else if (props.fromCurrentUser) {
      return '#70f';
    } else {
      return '#eee';
    }
  })();

  return (
    <View
      style={{
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 10,
        paddingRight: 10,
      }}
    >
      <Pressable
        onPress={onPress}
        style={{
          borderRadius: 10,
          backgroundColor: backgroundColor,
          alignSelf: props.fromCurrentUser ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          padding: 10,
        }}
      >
        <DefaultText
          selectable={true}
          style={{
            color: props.fromCurrentUser ? 'white' : 'black',
            fontSize: isEmojiOnly(props.text) ? 50 : 15,
          }}
        >
          {props.text}
        </DefaultText>
      </Pressable>
      {showTimestamp &&
        <DefaultText
          selectable={true}
          style={{
            fontSize: 13,
            paddingTop: 10,
            alignSelf: props.fromCurrentUser ? 'flex-end' : 'flex-start',
            color: '#666',
          }}
        >
          {longFriendlyTimestamp(props.timestamp)}
        </DefaultText>
      }
    </View>
  );
};

export {
  SpeechBubble,
};
