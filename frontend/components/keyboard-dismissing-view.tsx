import React from 'react';
import {
  Keyboard,
  Platform,
  View,
} from 'react-native';
import { Pressable } from './pressable';

const KeyboardDismissingView = (
  {children, ...rest}: React.ComponentProps<typeof View> & {
    children?: React.ReactNode,
    enabled?: boolean,
  }
) => {
  if (Platform.OS === 'web' || rest.enabled === false) {
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
