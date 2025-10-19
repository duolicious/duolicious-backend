import { useCallback } from 'react';
import { GestureResponderEvent, Pressable, InteractionManager } from 'react-native';
import { PhotoOrSkeleton } from './profile-card';
import { VerificationBadge } from './verification-badge';
import * as _ from 'lodash';
import { useNavigation } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { IMAGES_URL } from '../env/env';

const EnlargeablePhoto = ({
  photoUuid,
  photoExtraExts,
  photoBlurhash,
  style,
  innerStyle,
  isPrimary,
  isVerified = false,
  onPress,
}: {
  photoUuid: string | undefined | null
  photoExtraExts?: string[] | undefined | null
  photoBlurhash: string | undefined | null
  style?: any
  innerStyle?: any
  isPrimary: boolean
  isVerified?: boolean
  onPress?: () => void
}) => {
  const navigation = useNavigation<any>();

  const internalOnPress = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();

    if (!navigation) {
      return;
    }

    if (onPress) {
      return onPress();
    }

    if (photoUuid) {
      return navigation.navigate('Gallery Screen', { photoUuid });
    }
  }, [photoUuid]);


  const prefetchEnlargedImage = useCallback(() => {
    if (!photoUuid || !!photoExtraExts?.length) return;
    const ext = (photoExtraExts && photoExtraExts[0]) || 'jpg';
    const originalUri = `${IMAGES_URL}/original-${photoUuid}.${ext}`;
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        try {
          ExpoImage.prefetch(originalUri);
        } catch (e) {
          console.warn(e);
        }
      }, 500);
    });
  }, [photoUuid, photoExtraExts?.length]);

  if (photoUuid === undefined && !isPrimary) {
    return <></>;
  }

  return (
    <Pressable
      disabled={!!photoExtraExts?.length || !photoUuid}
      onPress={internalOnPress}
      style={[
        {
          width: '100%',
          aspectRatio: 1,
        },
        style,
      ]}
    >
      <PhotoOrSkeleton
        resolution={900}
        photoExtraExts={photoExtraExts}
        photoUuid={photoUuid}
        photoBlurhash={photoBlurhash}
        showGradient={false}
        style={innerStyle}
        forceExpoImage={true}
        onLoad={prefetchEnlargedImage}
      />
      {isVerified &&
        <VerificationBadge
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
          }}
          size={28}
        />
      }
    </Pressable>
  );
};

export {
  EnlargeablePhoto,
}
