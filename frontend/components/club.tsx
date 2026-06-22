import { TextStyle, ViewStyle } from 'react-native';
import { Basic, Basics } from './basic';

const Club = ({
  name,
  isMutual,
  style,
  textStyle,
  onPress,
}: {
  name: string,
  isMutual: boolean,
  style?: ViewStyle,
  textStyle?: TextStyle,
  onPress?: () => void,
}) => {
  return (
    <Basic
      onPress={onPress}
      style={{
        borderBottomWidth: 3,
        ...style
      }}
      textStyle={{
        fontFamily: isMutual ? 'TruenoBold' : 'Trueno',
        fontWeight: isMutual ? '900' : '400',
        fontSize: 15,
        ...textStyle,
      }}
    >
      {name}
    </Basic>
  );
};

const Clubs = Basics;

export {
  Club,
  Clubs,
};
