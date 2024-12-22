import {
  Animated,
  Pressable,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useShake } from '../animation/animation';

const isIconDefinition = (x: any): x is IconDefinition => {
  return x.iconName !== undefined;
};

const Icon = ({icon, textStyle}) => {
  if (isIconDefinition(icon)) {
    return <FontAwesomeIcon
      icon={icon}
      size={16}
      style={{
        marginRight: 5,
        ...textStyle,
      }}
    />
  } else {
    return <Ionicons
      style={{
        fontSize: 16,
        marginRight: 5,
        ...textStyle,
      }}
      name={icon}
    />
  }
};

const Basic = ({children, ...rest}) => {
  const {
    icon,
    style = {},
    textStyle = {},
    onPress,
  } = rest;

  const [shakeAnimation, startShake] = useShake();

  return (
    <Animated.View
      style={[
        {
          borderColor: 'rgba(0, 0, 0, 0.4)',
          borderWidth: 1,
          borderRadius: 999,
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          transform: [{ translateX: shakeAnimation }],
          flexShrink: 1,
        },
        style
      ]}
    >
      <Pressable
        disabled={!onPress}
        onPress={
          () => {
            if (!onPress) {
              return;
            }

            if (onPress() === false) {
              startShake();
            }
          }
        }
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          alignItems: 'center',
          flexDirection: 'row',
          flexShrink: 1,
        }}
      >
        {icon && <Icon icon={icon} textStyle={textStyle} />}
        <DefaultText style={textStyle}>{children}</DefaultText>
      </Pressable>
    </Animated.View>
  );
};

const Basics = ({children}) => {
  return (
    <View
      style={{
        zIndex: 999,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
      }}
    >
      {children}
    </View>
  );
};

export {
  Basic,
  Basics,
};
