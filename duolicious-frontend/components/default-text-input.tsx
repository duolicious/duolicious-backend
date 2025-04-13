import {
  Keyboard,
  StyleSheet,
  TextInput,
} from 'react-native';

const DefaultTextInput = (props) => {
  const {style, innerRef, ...rest} = props;

  return (
    <TextInput
      ref={innerRef}
      placeholder="Write here..."
      placeholderTextColor="#888"
      cursorColor="#70f"
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
      style={{
        ...styles.textInput,
        ...style,
      }}
      {...rest}
    />
  );
};

const styles = StyleSheet.create({
  textInput: {
    backgroundColor: 'white',
    padding: 10,
    marginLeft: 20,
    marginRight: 20,
    textAlignVertical: 'center',
    borderColor: '#999',
    borderWidth: 1,
    borderRadius: 10,
    height: 50,
    fontFamily: 'MontserratRegular',
    fontSize: 16,
  },
});

export {
  DefaultTextInput,
  styles,
};
