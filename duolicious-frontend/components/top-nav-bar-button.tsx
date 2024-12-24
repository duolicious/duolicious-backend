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
import { DefaultText } from '../components/default-text';

const TopNavBarButton = ({
  onPress,
  iconName,
  secondary,
  position,
  label
}: {
  onPress: any
  iconName: any
  secondary: boolean
  position: 'left' | 'right'
  label?: string,
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
        borderColor: secondary || isMobile() ? undefined : 'black',
        borderWidth: secondary || isMobile() ? undefined : 1,
        borderRadius: 7,
        padding: secondary || isMobile() ? undefined : 4,
        paddingHorizontal: !isMobile() && label ? 10 : undefined,
        aspectRatio: !isMobile() && label ? undefined : 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 5,
      }}>
        <Ionicons
          style={{
            color: 'black',
            fontSize: secondary || isMobile() ? 28 : 22,
          }}
          name={iconName}
        />
        {!isMobile() && label &&
          <DefaultText style={{ fontWeight: '700' }}>
            {label}
          </DefaultText>
        }
      </Animated.View>
    </Pressable>
  );
};

export {
  TopNavBarButton,
};
