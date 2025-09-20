import {
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import {
  useRef,
} from 'react';
import { DefaultText } from '../default-text';
import { useAppTheme } from '../../app-theme/app-theme';

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

  const { appTheme } = useAppTheme();
  const isEnabledRef = useRef(true);

  const opacityLo = 0.2;
  const opacityHi = 1.0;

  const animatedOpacity = useRef(new Animated.Value(1)).current;

  const fade = (callback?: () => void) => {
    Animated.timing(animatedOpacity, {
      toValue: opacityLo,
      duration: 0,
      useNativeDriver: true,
    }).start((result) => result.finished && callback?.())
  };

  const unfade = (callback?: () => void) => {
    Animated.timing(animatedOpacity, {
      toValue: opacityHi,
      duration: 1000,
      useNativeDriver: true,
    }).start((result) => result.finished && callback?.())
  };

  class Api {
    isEnabled(value: boolean) {
      if (value === isEnabledRef.current) {
        ;
      } else if (value) {
        unfade();
      } else {
        fade();
      }

      isEnabledRef.current = value;
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
      onPressIn={() => isEnabledRef.current && fade()}
      onPressOut={() => isEnabledRef.current && unfade()}
      onPress={() => isEnabledRef.current && !loading && onPress?.()}
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
          backgroundColor: backgroundColor || (secondary ? appTheme.primaryColor : '#70f'),
          opacity: animatedOpacity,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading &&
          <ActivityIndicator size="large" color={secondary ? "#70f" : appTheme.primaryColor} />
        }
        {!loading && children &&
          <DefaultText
            style={{
              color: textColor || (secondary ? appTheme.secondaryColor : 'white'),
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
