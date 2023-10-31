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
  fromCurrentUser?: boolean,
  state?: State,
  timestamp: Date,
  children?: string | string[],
  style?: Object,
};

const SpeechBubble = (props: Props) => {
  const [showTimestamp, setShowTimestamp] = useState(false);

  const onPress = useCallback(() => {
    setShowTimestamp(t => !t);
  }, [setShowTimestamp]);

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
          backgroundColor: props.fromCurrentUser ? '#70f' : '#eee',
          alignSelf: props.fromCurrentUser ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          padding: 10,
          ...props.style,
        }}
      >
        <DefaultText
          selectable={true}
          style={{
            color: props.fromCurrentUser ? 'white' : 'black',
            fontSize: 15,
          }}
        >
          {props.children}
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
      {props.state &&
        <DefaultText
          selectable={true}
          style={{
            fontSize: 13,
            paddingTop: 10,
            alignSelf: props.fromCurrentUser ? 'flex-end' : 'flex-start',
            color: '#666',
          }}
        >
          {props.state}
        </DefaultText>
      }
    </View>
  );
};

export {
  SpeechBubble,
};
