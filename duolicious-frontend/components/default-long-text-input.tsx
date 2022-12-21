import { DefaultTextInput } from './default-text-input';

const DefaultLongTextInput = (props) => {
  const {style, ...rest} = props;

  return (
    <DefaultTextInput
      placeholder="Write here..."
      placeholderTextColor="#888888"
      multiline={true}
      numberOfLines={4}
      style={{
        textAlignVertical: 'top',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        marginLeft: undefined,
        marginRight: undefined,
        height: undefined,
        ...style,
      }}
      {...rest}
    />
  );
};

export {
  DefaultLongTextInput,
};
