import { useCallback } from 'react';
import { GestureResponderEvent, Pressable } from 'react-native';
import { PhotoOrSkeleton } from './profile-card';
import { VerificationBadge } from './verification-badge';
import * as _ from 'lodash';
import { useNavigation } from '@react-navigation/native';

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
