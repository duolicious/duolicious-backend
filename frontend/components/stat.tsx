import { ReactNode } from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Basic, Basics } from './basic';

const Stat = ({
  children,
  style,
  textStyle,
}: {
  children: ReactNode,
  style?: StyleProp<ViewStyle>,
  textStyle?: StyleProp<TextStyle>,
}) => {
  return (
    <Basic
      style={[
        {
          borderRadius: 5,
        },
        style,
      ]}
      textStyle={textStyle}
    >
      {children}
    </Basic>
  );
};

const Stats = Basics;

export {
  Stat,
  Stats,
};
