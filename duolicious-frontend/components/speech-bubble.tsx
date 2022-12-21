import {
  View,
} from 'react-native';
import { DefaultText } from './default-text';

type State = 'Read' | 'Delivered';

type Props = {
  fromCurrentUser?: boolean,
  state?: State,
  children?: string | string[],
  style?: Object,
};

const SpeechBubble = (props: Props) => {
  return (
    <View
      style={{
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 10,
        paddingRight: 10,
      }}
    >
      <View
        style={{
          borderRadius: 10,
          backgroundColor: props.fromCurrentUser ? '#70f' : '#dddddd',
          alignSelf: props.fromCurrentUser ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          padding: 10,
          ...props.style,
        }}
      >
        <DefaultText
          style={{
            color: props.fromCurrentUser ? 'white' : 'black',
            fontSize: 15,
          }}
        >
          {props.children}
        </DefaultText>
      </View>
      {props.state &&
        <DefaultText
          style={{
            fontSize: 13,
            paddingTop: 10,
            alignSelf: 'flex-end',
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
