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
import { OnlineIndicator } from './online-indicator';
import { useAppTheme } from '../app-theme/app-theme';

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
  const Element = navigation ? Pressable : View;

  const { appTheme } = useAppTheme();

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
        <View
          style={[
            styles.imageStyle,
            {
              backgroundColor: appTheme.avatarBackgroundColor,
            },
          ]}
        >
          <Ionicons
            style={{
              fontSize: 40,
              color: appTheme.avatarColor,
            }}
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
      {doUseOnline &&
        <OnlineIndicator
          personUuid={personUuid}
          size={20}
          borderWidth={2}
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
          }}
        />
      }
      {percentage !== undefined &&
        <View
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 30,
            width: 30,
            borderRadius: 999,
            borderColor: appTheme.primaryColor,
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
  },
});

export {
  Avatar,
};
