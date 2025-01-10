import {
  useCallback,
  useRef,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { DefaultText } from './default-text';
import {
  IMAGES_URL,
} from '../env/env';
import Ionicons from '@expo/vector-icons/Ionicons';
import { X } from "react-native-feather";
import { ImageBackground } from "expo-image";
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock'
import { verificationOptionGroups } from '../data/option-groups';

const Avatar = ({percentage, ...props}) => {
  const {
    personId,
    personUuid,
    imageUuid,
    imageBlurhash,
    navigation,
    size,
    shadow = false,
    isSkipped = false,
    verificationRequired = null,
  } = props;

  const Element = navigation ? Pressable : View;
  const elementStyle = useRef({
    height: 90,
    width: 90,
    ...props.style,
  }).current;

  const onPress = useCallback(() => {
    if (!navigation) {
      return;
    }

    if (verificationRequired) {
      return navigation.navigate('Profile');
    } else if (personUuid) {
      return navigation.navigate(
        'Prospect Profile Screen',
        {
          screen: 'Prospect Profile',
          params: { personId, personUuid, imageBlurhash },
        }
      );
    }
  }, [navigation, personId, verificationRequired]);

  return (
    <Element
      onPress={onPress}
      style={elementStyle}
    >
      <ImageBackground
        source={imageUuid ? {
          uri: `${IMAGES_URL}/450-${imageUuid}.jpg`,
          height: 450,
          width: 450,
        } : undefined}
        placeholder={imageBlurhash && { blurhash: imageBlurhash }}
        transition={!imageUuid ? { duration: 0, effect: null } : 150}
        style={{
          flex: 1,
          aspectRatio: 1,
          borderRadius: 999,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: imageBlurhash ? undefined : '#f1e5ff',
          margin: 4,
        }}
      >
        {!imageUuid && !imageBlurhash &&
          <Ionicons
            style={{fontSize: 40, color: 'rgba(119, 0, 255, 0.2)'}}
            name={'person'}
          />
        }
        {verificationRequired &&
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              zIndex: 999,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
            }}
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
          overflow: 'hidden',
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
        {verificationRequired &&
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              zIndex: 999,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
            }}
          >
          </View>
        }
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
      {verificationRequired &&
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 5,
            borderRadius: 999,
          }}
        >
          <FontAwesomeIcon
            icon={faLock}
            size={18}
            style={{color: 'black'}}
          />
          <DefaultText
            style={{
              fontSize: 12,
              fontWeight: '900',
              textAlign: 'center',
            }}
          >
            Verify your {verificationRequired} to unlock
          </DefaultText>
        </View>
      }
    </Element>
  )
};

export {
  Avatar,
};
