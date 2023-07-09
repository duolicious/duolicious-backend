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

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const Avatar = ({percentage, ...props}) => {
  const {
    userId,
    imageUuid,
    navigation,
    size,
    shadow = false,
  } = props;

  const shadowStyle = shadow ? {
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
      { userId }
    );
  }, [navigation]);

  return (
    <Element
      onPress={onPress}
      style={elementStyle}
    >
      <ImageBackground
        source={imageUuid && {uri: `${IMAGES_URL}/450-${imageUuid}.jpg`}}
        style={{
          aspectRatio: 1,
          margin: 2,
          borderRadius: 999,
          borderColor: 'white',
          backgroundColor: imageUuid ? 'white' : '#f1e5ff',
          borderWidth: 2,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          ...shadowStyle,
        }}
      >
        {!imageUuid &&
          <Ionicons
            style={{fontSize: 40, color: 'rgba(119, 0, 255, 0.2)'}}
            name={'person'}
          />
        }
      </ImageBackground>
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
    </Element>
  )
};

export {
  Avatar,
};
