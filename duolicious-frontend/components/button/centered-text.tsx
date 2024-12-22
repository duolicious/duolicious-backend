import {
  ActivityIndicator,
  Animated,
  Pressable,
  View,
} from 'react-native';
import {
  useRef,
} from 'react';
import { DefaultText } from '../default-text';

const ButtonWithCenteredText = (props) => {
  const {
    children,
    extraChildren,
    innerRef,
    backgroundColor,
    borderColor,
    borderWidth,
    containerStyle,
    textStyle,
    onPress,
    secondary,
    textColor,
    fontSize,
    loading = false,
  } = props;

  const isEnabledRef = useRef(true);

  const opacityLo = 0.2;
  const opacityHi = 1.0;

  const animatedOpacity = useRef(new Animated.Value(1)).current;

  const fade = (callback?: () => void) => {
    animatedOpacity.stopAnimation();
    animatedOpacity.setValue(opacityLo);
    callback && callback();
  };

  const unfade = (callback?: () => void) => {
    animatedOpacity.stopAnimation();
    Animated.timing(animatedOpacity, {
      toValue: opacityHi,
      duration: 1000,
      useNativeDriver: true,
    }).start((result) => result.finished && callback && callback());
  };

  class Api {
    isEnabled(value: boolean) {
      const previousValue = isEnabledRef.current;

      isEnabledRef.current = value;

      if (value === previousValue) return;
      if (value) {
        unfade();
      } else {
        fade();
      }
    }

    doPressAnimation() {
      fade(() => unfade());
    }
  };

  if (innerRef !== undefined) {
    innerRef.current = new Api();
  }

  return (
    <Pressable
      style={{
        outline: 'none',
        marginTop: 10,
        marginBottom: 10,
        height: 50,
        ...containerStyle,
      }}
      onPressIn={
        () => isEnabledRef.current && fade()}
      onPressOut={
        () => isEnabledRef.current && unfade()}
      onPress={
        () => isEnabledRef.current && !loading && onPress && onPress()}
    >
      <Animated.View
        style={{
          width: '100%',
          height: (
            'height' in (containerStyle ?? {}) &&
            containerStyle?.height === undefined
          ) ? undefined : '100%',
          borderRadius: 999,
          borderColor: borderColor === undefined ? 'black' : borderColor,
          borderWidth: borderWidth === undefined ? (secondary ? 1 : 0) : borderWidth,
          backgroundColor: backgroundColor || (secondary ? 'white' : '#70f'),
          opacity: animatedOpacity,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading &&
          <ActivityIndicator size="large" color={secondary ? "#70f" : 'white'} />
        }
        {!loading && children &&
          <DefaultText
            style={{
              color: textColor || (secondary ? 'black' : 'white'),
              fontSize: fontSize || 16,
              textAlign: 'center',
              ...textStyle,
            }}
          >
            {children}
          </DefaultText>
        }
        {!loading && extraChildren}
      </Animated.View>
    </Pressable>
  );
}

export {
  ButtonWithCenteredText,
}
