import {
  ImageBackground as RNImageBackground,
  Platform,
  Pressable,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { DefaultText } from './default-text';
import {
  IMAGES_URL,
} from '../env/env';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { listen } from '../events/events';
import { makeLinkProps } from '../util/navigation'
import { X } from "react-native-feather";
import { PageItem } from './search-tab';
import { ImageBackground as ExpoImageBackground } from 'expo-image';
import { VerificationBadge } from './verification-badge';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock'
import { ONLINE_COLOR } from '../constants/constants';
import { useOnline } from '../chat/application-layer/hooks/online';

// This component wouldn't need to exist if expo-image (and expo itself (and the
// JS eco system generally)) wasn't buggy trash. This fixes an issue on
// in expo on Android where the images flicker when being loaded in a flat list.
// The React Native ImageBackground implementation doesn't have that issue, but
// it also doesn't support blurhashes, so we need to combine them if we want to
// have blurhashes and (the appearance of) bug-free operation
const ImageBackground = (props) => {
  if (Platform.OS !== 'android') {
    return <ExpoImageBackground {...props} />;
  }

  const {
    children,
    placeholder,
    source,
    style,
    transition,
    contentFit,
  } = props;

  return (
    <ExpoImageBackground
      placeholder={placeholder}
      transition={transition}
      style={style}
      contentFit={contentFit}
    >
      <RNImageBackground
        source={source}
        style={{
          width: '100%',
          height: '100%',
        }}
        resizeMode={contentFit}
        fadeDuration={transition?.duration ?? transition ?? undefined}
      >
        {children}
      </RNImageBackground>
    </ExpoImageBackground>
  );
};

const ImageOrSkeleton_ = ({
  resolution,
  imageUuid,
  imageBlurhash,
  forceExpoImage = false,
  ...rest
}: {
  resolution: number,
  imageUuid: string | undefined | null,
  imageBlurhash: string | undefined | null,
  imageExtraExts?: string[] | null,
  showGradient?: boolean,
  forceExpoImage?: boolean,
  style?: any,
}) => {
  const {
    imageExtraExts = [],
    showGradient = true,
  } = rest;

  const uriPrefix = imageExtraExts?.length ? '' : `${resolution}-`;

  const ext = (imageExtraExts && imageExtraExts[0]) ?? 'jpg';

  const uri = imageUuid ?
    `${IMAGES_URL}/${uriPrefix}${imageUuid}.${ext}` :
    imageUuid;

  // This is a workaround for an issue where images that are only blurhashes
  // appear as blank. I'm guessing the root cause is another issue I vaguely
  // remember in React Native, where animations can be blocked by the rendering
  // of a flat list.
  const transition = !imageUuid ? { duration: 0, effect: null } : 150;

  // `ImageBackground` is a workaround that breaks gifs on prospect profiles in
  // order to fix flickering while scrolling through the search tab. That
  // workaround is to avoid using `ImageBackground` from `expo-image`
  // (AKA `ExpoImageBackground`) `expo-image` is one of the buggiest pieces of
  // software I've used in my life, though it comes with more features than
  // vanilla React Native.
  const ImageBackground_ = useMemo(
    () => forceExpoImage ? ExpoImageBackground : ImageBackground,
    [forceExpoImage]
  );

  return (
    <ImageBackground_
      source={uri && { uri: uri }}
      placeholder={imageBlurhash && { blurhash: imageBlurhash }}
      transition={transition}
      style={{
          width: '100%',
          aspectRatio: 1,
          backgroundColor: imageUuid ? undefined : '#ccc',
      }}
      contentFit="contain"
    >
      <LinearGradient
        colors={showGradient ? [
          'rgba(0, 0, 0, 0.1)',
          'transparent',
          'transparent',
          'transparent',
          'transparent',
          'rgba(0, 0, 0, 0.1)',
          'rgba(0, 0, 0, 0.3)',
          'rgba(0, 0, 0, 0.4)',
        ] : [
          'transparent',
          'transparent',
        ]}
        style={{
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {imageUuid === null && imageBlurhash === null &&
          <Ionicons
            style={{fontSize: 100, color: '#eee'}}
            name={'person'}
          />
        }
      </LinearGradient>
    </ImageBackground_>
  );
};

const ImageOrSkeleton = memo(ImageOrSkeleton_);

const ProfileCard = ({
  item,
}: {
  item: PageItem,
}) => {
  const {
    name: name,
    age: age,
    match_percentage: matchPercentage,
    profile_photo_uuid: imageUuid,
    profile_photo_blurhash: imageBlurhash,
    prospect_uuid: personUuid,
    person_messaged_prospect: personMessagedProspect,
    prospect_messaged_person: prospectMessagedPerson,
    verified: verified,
    verification_required_to_view: verificationRequired,
  } = item;

  const [isSkipped, setIsSkipped] = useState(false);

  const isOnline = useOnline(personUuid);

  const [
    personMessagedProspectState,
    setPersonMessagedProspectState,
  ] = useState(personMessagedProspect);
  const [
    prospectMessagedPersonState,
    setProspectMessagedPersonState,
  ] = useState(prospectMessagedPerson);

  const navigation = useNavigation<any>();

  const itemOnPress = useCallback((e) => {
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
          params: { personUuid, imageBlurhash },
        }
      );
    }
  }, [navigation, personUuid, verificationRequired]);

  const onHide = useCallback(() => setIsSkipped(true), [setIsSkipped]);
  const onUnhide = useCallback(() => setIsSkipped(false), [setIsSkipped]);

  const onMessageFrom = useCallback(
    () => {
      setProspectMessagedPersonState(true);
      item.prospect_messaged_person = true;
    },
    [setProspectMessagedPersonState, item]
  );

  const onMessageTo = useCallback(
    () => {
      setPersonMessagedProspectState(true);
      item.person_messaged_prospect = true;
    },
    [setPersonMessagedProspectState, item]
  );

  useEffect(
    () => listen(`skip-profile-${personUuid}`, onHide),
    [personUuid, onHide]
  );

  useEffect(
    () => listen(`unskip-profile-${personUuid}`, onUnhide),
    [personUuid, onUnhide]
  );

  useEffect(
    () => listen(`message-from-${personUuid}`, onMessageFrom),
    [personUuid, onMessageFrom]
  );

  useEffect(
    () => listen(`message-to-${personUuid}`, onMessageTo),
    [personUuid, onMessageTo]
  );

  const link = navigation && !verificationRequired && personUuid ? makeLinkProps(`/profile/${personUuid}`)
                                                                 : {};

  return (
    <Pressable
      onPress={itemOnPress}
      style={{ flex: 0.5, aspectRatio: 1, overflow: 'hidden', borderRadius: 5 }}
      {...link}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          borderBottomRightRadius: isOnline ? 24 : undefined,
          overflow: 'hidden',
        }}
      >
        <ImageOrSkeleton
          resolution={450}
          imageUuid={imageUuid}
          imageBlurhash={imageBlurhash}
        />
        <UserDetails
          name={name}
          age={age}
          matchPercentage={matchPercentage}
          verified={verified}
        />
        {!isOnline && prospectMessagedPersonState &&
          <View
            style={{
              position: 'absolute',
              bottom: 6,
              right: 26,
              width: 18,
              height: 18,
            }}
          >
            <Ionicons
              style={{ fontSize: 18, color: 'white' }}
              name="chatbubble"
            />
          </View>
        }
        {!isOnline && personMessagedProspectState &&
          <View
            style={{
              transform: [ { scaleX: -1 } ],
              position: 'absolute',
              bottom: 6,
              right: 6,
              width: 18,
              height: 18,
            }}
          >
            <Ionicons
              style={{ fontSize: 18, color: 'white' }}
              name="chatbubble"
            />
          </View>
        }
      </View>
      {isOnline && <>
        <View
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,

            borderRadius: 999,

            backgroundColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
            width: 24,
            height: 24,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: ONLINE_COLOR,
            borderRadius: 999,
            width: 16,
            height: 16,
          }}
        />
      </>}
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
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <FontAwesomeIcon
            icon={faLock}
            size={30}
            style={{color: 'white'}}
          />
          <DefaultText
            style={{
              color: 'white',
              fontWeight: '900',
              fontSize: 22,
              textAlign: 'center',
              padding: 10,
            }}
          >
            Verification Required
          </DefaultText>
          <DefaultText
            style={{
              fontSize: 12,
              color: '#ccc',
              textAlign: 'center',
              paddingHorizontal: 10,
            }}
          >
            This person only lets people with
            verified {verificationRequired} see them
          </DefaultText>
        </View>
      }
    </Pressable>
  );
};

const UserDetails = ({name, age, matchPercentage, verified, ...rest}) => {
  const {
    containerStyle,
  } = rest;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        padding: 5,
        gap: 2,
        ...containerStyle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 7,
          alignItems: 'flex-end',
        }}
      >
        <DefaultText style={{
          fontSize: 18,
          fontWeight: '600',
          color: 'white',
          overflow: 'hidden',
          flexShrink: 1,
        }}>
          {name}{age && `, ${age}`}
        </DefaultText>
        {verified &&
          <VerificationBadge
            size={18}
            style={{
              marginBottom: 2,
            }}
          />
        }
      </View>
      <DefaultText
        style={{
          fontWeight: '500',
          color: 'white',
          alignSelf: 'flex-start',
        }}
      >
        {matchPercentage}% Match
      </DefaultText>
    </View>
  );
};

export {
  ImageOrSkeleton,
  ProfileCard,
};
