import {
  Animated,
  Easing,
} from 'react-native';
import {
  useCallback,
  useRef,
} from 'react';
import { useAppTheme } from '../app-theme/app-theme';


const useShake = (): [Animated.Value, () => void] => {
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const startShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: -25,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: 20,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: -15,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
        easing: Easing.linear
      })
    ]).start();
  }, [shakeAnimation]);

  return [shakeAnimation, startShake];
};

const usePressableAnimation = () => {
  const { appTheme } = useAppTheme();

  const animatedBackgroundColor = useRef(new Animated.Value(0)).current;

  const backgroundColor = animatedBackgroundColor.interpolate({
    inputRange: [0, 1],
    outputRange: [`${appTheme.primaryColor}ff`, `${appTheme.interactiveBorderColor}80`],
    extrapolate: 'clamp',
  });

  const onPressIn = useCallback(() => {
    Animated.timing(animatedBackgroundColor, {
      toValue: 1,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, []);

  const onPressOut = useCallback(() => {
    Animated.timing(animatedBackgroundColor, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, []);

  return { backgroundColor, onPressIn, onPressOut };
};

export {
  useShake,
  usePressableAnimation,
};
