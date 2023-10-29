import {
  Animated,
  Pressable,
} from 'react-native';
import {
  useCallback,
  useRef,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

const TopNavBarButton = ({onPress, iconName, style}) => {
  const opacity = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    opacity.setValue(0.2);
  }, []);

  const onPressOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      style={{
        position: 'absolute',
        top: 0,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <Animated.View style={{opacity: opacity}}>
        <Ionicons
          style={{
            color: '#333',
            fontSize: 26,
          }}
          name={iconName}
        />
      </Animated.View>
    </Pressable>
  );
};

export {
  TopNavBarButton,
};
