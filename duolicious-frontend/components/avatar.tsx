import {
  useCallback,
  useRef,
} from 'react';
import {
  ImageBackground,
  Pressable,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import {
  IMAGES_URL,
} from '../env/env';
import Ionicons from '@expo/vector-icons/Ionicons';
import { X } from "react-native-feather";

const Avatar = ({percentage, ...props}) => {
  const {
    personId,
    imageUuid,
    navigation,
    size,
    shadow = false,
    isSkipped = false,
  } = props;

  const shadowStyle = (shadow && !isSkipped) ? {
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  } : {};

  const Element = navigation ? Pressable : View;
  const elementStyle = useRef({
    height: 90,
    width: 90,
    ...props.style,
  }).current;

  const onPress = useCallback(() => {
    return navigation && navigation.navigate(
      'Prospect Profile Screen',
      {
        screen: 'Prospect Profile',
        params: { personId },
      }
    );
  }, [navigation, personId]);

  return (
    <Element
      onPress={onPress}
      style={elementStyle}
    >
      <View
        style={{
          aspectRatio: 1,
          borderRadius: 999,
          margin: 2,
          borderColor: 'white',
          backgroundColor: imageUuid ? 'white' : '#f1e5ff',
          borderWidth: 2,
          overflow: 'visible',
          ...shadowStyle,

        }}
      >
        <ImageBackground
          source={imageUuid && {uri: `${IMAGES_URL}/450-${imageUuid}.jpg`}}
          style={{
            flex: 1,
            aspectRatio: 1,
            borderRadius: 999,
            overflow: 'hidden',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {!imageUuid &&
            <Ionicons
              style={{fontSize: 40, color: 'rgba(119, 0, 255, 0.2)'}}
              name={'person'}
            />
          }
        </ImageBackground>
      </View>
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          height: 30,
          width: 30,
          borderRadius: 999,
          borderColor: 'white',
          borderWidth: 2,
          backgroundColor: '#70f',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DefaultText
          style={{
            color: 'white',
            textAlign: 'center',
            fontWeight: '700',
            fontSize: 10,
          }}
        >
          {percentage}%
        </DefaultText>
      </View>
      {isSkipped &&
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <X
            stroke="#70f"
            strokeWidth={3}
            height={48}
            width={48}
          />
        </View>
      }
    </Element>
  )
};

export {
  Avatar,
};
