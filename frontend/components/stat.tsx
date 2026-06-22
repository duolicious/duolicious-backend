import { Basic, Basics } from './basic';

const Stat = ({
  children,
  style,
  textStyle,
}: {
  children: any,
  style?: any,
  textStyle?: any,
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
