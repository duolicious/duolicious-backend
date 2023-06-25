import {
  TextInput,
} from 'react-native';

const DefaultTextInput = (props) => {
  const {style, innerRef, ...rest} = props;

  return (
    <TextInput
      ref={innerRef}
      placeholderTextColor="#888"
      cursorColor="#70f"
      inputMode="numeric"
      keyboardType="number-pad"
      style={{
        backgroundColor: 'white',
        padding: 10,
        marginLeft: 20,
        marginRight: 20,
        textAlignVertical: 'center',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 10,
        height: 50,
        fontFamily: 'MontserratRegular',
        ...style,
      }}
      {...rest}
    />
  );
};

export {
  DefaultTextInput,
};
