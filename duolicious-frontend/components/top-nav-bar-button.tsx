import {
  Animated,
  Pressable,
} from 'react-native';
import {
  useCallback,
  useRef,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isMobile } from '../util/util';

const TopNavBarButton = ({
  onPress,
  iconName,
  secondary,
  position,
}: {
  onPress: any
  iconName: any
  secondary: boolean
  position: 'left' | 'right'
}) => {
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
        ...(position === 'left' ? { left: 10 } : { right: 10 }),
      }}
    >
      <Animated.View style={{
        opacity: opacity,
        borderColor: secondary || isMobile() ? undefined : '#ccc',
        borderWidth: secondary || isMobile() ? undefined : 1,
        borderRadius: 7,
        padding: secondary || isMobile() ? undefined : 4,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons
          style={{
            color: 'black',
            fontSize: secondary || isMobile() ? 28 : 22,
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
