import { Basic, Basics } from './basic';

const Club = ({
  name,
  isMutual,
  style,
  textStyle,
}: {
  name: string,
  isMutual: boolean,
  style?: any,
  textStyle?: any,
}) => {
  return (
    <Basic
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
