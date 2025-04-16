import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { DefaultText } from '../default-text';
import { friendlyDate } from '../../util/util';
import {
  Message,
} from '../../chat/application-layer';
import { isSameDay } from 'date-fns';
import { useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
  previousMessage: Message
  message: Message
};

const MessageDivider = ({ previousMessage, message }: Props) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1.0);
  }, []);

  if (previousMessage.type === 'typing') {
    return null;
  }

  if (message.type === 'typing') {
    return null;
  }

  if (isSameDay(previousMessage.timestamp, message.timestamp)) {
    return null;
  }

  return (
    <DefaultText style={styles.text} animated={true}>
      {friendlyDate(message.timestamp)}
    </DefaultText>
  );
};

const styles = StyleSheet.create({
  text: {
    alignSelf: 'center',
    paddingTop: 58,
    paddingBottom: 12,
    fontSize: 12,
    color: '#999',
    fontWeight: '700',
    marginHorizontal: 8,
    textTransform: 'uppercase',
  },
});

export {
  MessageDivider,
}
