import { TextStyle } from 'react-native';
import { DefaultText } from './default-text';

const Title = ({children, style}: {children?: React.ReactNode, style?: TextStyle}) => {
  return (
    <DefaultText
      style={{
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.2,
        marginBottom: 8,
        marginTop: 24,
        ...style,
      }}
    >
      {children}
    </DefaultText>
  );
};

export {
  Title,
};
