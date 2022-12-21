import { DefaultText } from './default-text';

const Title = ({children, ...rest}) => {
  return (
    <DefaultText
      style={{
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 5,
        marginTop: 20,
        ...rest.style,
      }}
    >
      {children}
    </DefaultText>
  );
};

export {
  Title,
};
