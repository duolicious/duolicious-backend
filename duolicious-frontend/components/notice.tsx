import {
  Pressable,
  View,
} from 'react-native';
import {
  createElement
} from 'react';

const Notice = ({children, ...rest}) => {
  const {
    onPress,
    style,
  } = rest;

  return (
    createElement(
      onPress ? Pressable : View,
      {
        style: {
          width: '100%',
        },
        onPress: onPress,
      },
      <View
        style={[
          {
            backgroundColor: '#f1e5ff',
            padding: 15,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 5,
            marginRight: 5,
          },
          style,
        ]}
      >
        {children}
      </View>
    )
  );
};

export {
  Notice,
};
