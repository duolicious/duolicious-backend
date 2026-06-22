import { TextStyle } from 'react-native';
import { DefaultText } from './default-text';

const Title = ({children, style}: {children?: React.ReactNode, style?: TextStyle}) => {
  return (
    <DefaultText
      style={{
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 5,
        marginTop: 20,
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
