import {
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import {
  useCallback,
  useRef,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultText } from '../default-text';

const ButtonForOption = (props) => {
  const {
    onPress,
    onSubmitSuccess,
    label,
    icon,
    optionGroups,
    setting,
    noSettingText = 'Unanswered',
    showSkipButton,
    navigationScreen,
    navigation,
    loading = false,
    theme,
  } = props;

  if ((label === undefined) === (optionGroups === undefined)) {
    throw Error("Exactly one of `label` and `optionGroups` must be set");
  }

  if ((onPress === undefined) === (navigationScreen === undefined)) {
    throw Error("Exactly one of `onPress` and `navigationScreen` must be set");
  }

  if ((navigation === undefined) !== (navigationScreen === undefined)) {
    throw Error("`navigation` and `navigationScreen` must be set together");
  }

  const Icon_ = icon ?? (optionGroups ? optionGroups[0]?.Icon : undefined);
  const label_ = label ?? optionGroups[0].title

  const opacity = useRef(new Animated.Value(1)).current;

  const fadeIn = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0.5,
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeOut = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, []);

  const onPress_ = useCallback(onPress ?? (() => {
    navigation.navigate(
      navigationScreen,
      {
        optionGroups: optionGroups,
        ...(onSubmitSuccess !== undefined ? {onSubmitSuccess} : {}),
        ...(showSkipButton !== undefined ? {showSkipButton} : {}),
        ...(theme !== undefined ? {theme} : {}),
      }
    )
  }), []);

  return (
    <Pressable
      style={{
        marginTop: 5,
        marginBottom: 5,
        height: 40,
      }}
      onPressIn={fadeIn}
      onPressOut={fadeOut}
      onPress={onPress_}
    >
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          borderColor: '#999',
          borderWidth: 1,
          borderBottomWidth: 2,
          borderRadius: 999,
          paddingLeft: 10,
          paddingRight: 20,
          opacity: opacity,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        {Icon_ &&
          <Icon_/>
        }
        <DefaultText
          style={{
            marginLeft: Icon_ ? 5 : 15,
            fontSize: 16,
          }}
        >
          {label_}
        </DefaultText>
        <DefaultText
          style={{
            paddingLeft: 20,
            paddingRight: 10,
            color: (setting ?? noSettingText) === noSettingText ? '#888' : 'black',
            fontStyle: (setting ?? noSettingText) === noSettingText ? 'italic' : 'normal',
            textAlign: 'right',
            flex: 1,
          }}
          numberOfLines={1}
        >
          {setting ?? noSettingText}
        </DefaultText>
        {loading &&
          <ActivityIndicator
            style={{
              position: 'absolute',
              right: 15,
            }}
            size="small"
            color="#70f"
          />
        }
        {!loading &&
          <Ionicons
            style={{
              position: 'absolute',
              right: 5,
              fontSize: 20,
            }}
            name="chevron-forward"
          />
        }
      </Animated.View>
    </Pressable>
  );
}

export {
  ButtonForOption,
};
