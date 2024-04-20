import {
  Keyboard,
  Platform,
  Pressable,
  View,
} from 'react-native';

const KeyboardDismissingView = ({children, ...rest}) => {
  if (Platform.OS === 'web') {
    return <View {...rest}>{children}</View>
  } else {
    return <Pressable onPress={Keyboard.dismiss} {...rest}>
      {children}
    </Pressable>
  }
};

export {
  KeyboardDismissingView,
};
