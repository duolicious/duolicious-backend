import {
  useCallback,
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
import { makeLinkProps } from '../util/navigation'
import Ionicons from '@expo/vector-icons/Ionicons';
import { X } from "react-native-feather";
import { ImageBackground } from "expo-image";
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock'
import { ONLINE_COLOR } from '../constants/constants';
import { useOnline } from '../chat/application-layer/hooks/online';

const Avatar = ({
  percentage,
  personUuid,
  photoUuid,
  photoBlurhash,
  personId,
  navigation,
  isSkipped = false,
  verificationRequired = null,
  doUseOnline = true,
}: {
  percentage: number
  personUuid: string
  photoUuid: string | null
  photoBlurhash: string | null
  personId?: number
  navigation?: any
  isSkipped?: boolean
  verificationRequired?: boolean | null
  doUseOnline?: boolean
}) => {
  const isOnline = useOnline(doUseOnline ? personUuid : null);

  const Element = navigation ? Pressable : View;

  const onPress = useCallback((e) => {
    e.preventDefault();

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
          params: { personId, personUuid, photoBlurhash },
        }
      );
    }
  }, [navigation, personId, verificationRequired]);

  const link = navigation && !verificationRequired && personUuid ? makeLinkProps(`/profile/${personUuid}`)
                                                                 : {};

  return (
    <Element
      onPress={onPress}
      style={styles.elementStyle}
      {...link}
    >
      {!Boolean(photoUuid || photoBlurhash) &&
        <View style={styles.imageStyle}>
          <Ionicons
            style={{fontSize: 40, color: 'rgba(119, 0, 255, 0.2)'}}
            name={'person'}
          />
        </View>
      }
      {Boolean(photoUuid || photoBlurhash) &&
        <ImageBackground
          source={photoUuid ? {
            uri: `${IMAGES_URL}/450-${photoUuid}.jpg`,
            height: 450,
            width: 450,
          } : undefined}
          placeholder={photoBlurhash && { blurhash: photoBlurhash }}
          transition={!photoUuid ? { duration: 0, effect: null } : 150}
          style={styles.imageStyle}
          contentFit="contain"
          placeholderContentFit="contain"
          recyclingKey={photoUuid}
        >
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
      }
      {isOnline && <>
        <View
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,

            borderRadius: 999,

            backgroundColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
            width: 20,
            height: 20,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            backgroundColor: ONLINE_COLOR,
            borderRadius: 999,
            width: 12,
            height: 12,
          }}
        />
      </>}
      {percentage !== undefined &&
        <View
          style={{
            position: 'absolute',
            left: 0,
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
      }
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

const styles = StyleSheet.create({
  elementStyle: {
    height: 90,
    width: 90,
  },
  imageStyle: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    backgroundColor: '#f1e5ff',
  },
});

export {
  Avatar,
};
