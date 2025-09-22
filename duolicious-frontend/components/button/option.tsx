import {
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { useCallback } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultText } from '../default-text';
import { useAppTheme } from '../../app-theme/app-theme';
import { usePressableAnimation } from '../../animation/animation';

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

  const { appTheme } = useAppTheme();
  const { backgroundColor, onPressIn, onPressOut } = usePressableAnimation();

  const onPress_ = useCallback(onPress ?? (() => {
    navigation.navigate(
      navigationScreen,
      {
        optionGroups: optionGroups,
        ...(onSubmitSuccess !== undefined ? {onSubmitSuccess} : {}),
        ...(showSkipButton !== undefined ? {showSkipButton} : {}),
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
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress_}
    >
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          backgroundColor,
          borderColor: appTheme.interactiveBorderColor,
          borderWidth: 1,
          borderBottomWidth: 2,
          borderRadius: 999,
          paddingLeft: 10,
          paddingRight: 20,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        {Icon_ &&
          <Icon_ color={appTheme.secondaryColor} />
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
            ...((setting ?? noSettingText) === noSettingText ? {
              color: '#888888',
              fontStyle: 'italic',
            } : {
            }),
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
            color={appTheme.brandColor}
          />
        }
        {!loading &&
          <Ionicons
            style={{
              position: 'absolute',
              right: 5,
              fontSize: 20,
              color: appTheme.secondaryColor,
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
